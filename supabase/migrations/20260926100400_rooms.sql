-- =============================================================================
-- ApplyHub · 4. Rooms (collaborative spaces)
--
-- rooms, room_members, room_invites, room_shared_applications, room_targets,
-- room_target_votes, notes, comments, attachments, activity_log,
-- the private `room-files` storage bucket and the Realtime publication.
--
-- Access model
--   read   : room members only
--   write  : editors and owners (viewers are read-only)
--   manage : owners (members, invites, room settings, deletion)
-- Membership rows are only created by create_room() and join_room().
-- =============================================================================

create type public.room_role as enum ('owner', 'editor', 'viewer');
create type public.target_interest as enum ('interested', 'applying', 'not_interested');
create type public.note_kind as enum ('note', 'link');

-- -----------------------------------------------------------------------------
-- Invite codes: 12 characters of Crockford base32 (60 random bits).
-- -----------------------------------------------------------------------------
create or replace function private.generate_invite_code()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  -- Skip the UUID version byte (6); byte 8 still has 6 random low bits.
  byte_idx constant int[] := array[0, 1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14];
  raw  bytea := uuid_send(gen_random_uuid());
  i    int;
  code text := '';
begin
  foreach i in array byte_idx loop
    code := code || substr(alphabet, (get_byte(raw, i) % 32) + 1, 1);
  end loop;
  return code;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.rooms (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 1 and 100),
  description  text not null default '' check (char_length(description) <= 2000),
  country_code text references public.countries (code) on update cascade on delete set null,
  intake_term  public.intake_term,
  intake_year  smallint check (intake_year between 2000 and 2100),
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index rooms_created_by_idx on public.rooms (created_by, created_at);

create table public.room_members (
  room_id   uuid not null references public.rooms (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      public.room_role not null default 'viewer',
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index room_members_user_idx on public.room_members (user_id);

create table public.room_invites (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms (id) on delete cascade,
  code       text not null unique default private.generate_invite_code(),
  role       public.room_role not null default 'editor' check (role <> 'owner'),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  expires_at timestamptz,
  max_uses   integer check (max_uses between 1 and 1000),
  use_count  integer not null default 0 check (use_count >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index room_invites_room_idx on public.room_invites (room_id, created_at desc);
create index room_invites_creator_idx on public.room_invites (created_by, created_at);

create table public.room_shared_applications (
  room_id        uuid not null references public.rooms (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  shared_by      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  shared_at      timestamptz not null default now(),
  primary key (room_id, application_id)
);

create index room_shared_applications_app_idx on public.room_shared_applications (application_id);

create table public.room_targets (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.rooms (id) on delete cascade,
  -- Optional knowledge-base links (foreign keys added in the KB migration).
  university_id uuid,
  program_id    uuid,
  title         text not null check (char_length(btrim(title)) between 1 and 200),
  country_code  text references public.countries (code) on update cascade on delete set null,
  url           text check (private.is_http_url(url)),
  notes         text not null default '' check (char_length(notes) <= 4000),
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index room_targets_room_idx on public.room_targets (room_id, created_at desc);

create table public.room_target_votes (
  target_id  uuid not null references public.room_targets (id) on delete cascade,
  room_id    uuid not null references public.rooms (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  interest   public.target_interest not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (target_id, user_id)
);

create index room_target_votes_room_idx on public.room_target_votes (room_id);

create table public.notes (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms (id) on delete cascade,
  kind       public.note_kind not null default 'note',
  title      text not null check (char_length(btrim(title)) between 1 and 200),
  body_md    text not null default '' check (char_length(body_md) <= 50000),
  url        text check (private.is_http_url(url)),
  is_pinned  boolean not null default false,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_link_has_url check (kind = 'note' or url is not null)
);

create index notes_room_idx on public.notes (room_id, is_pinned desc, updated_at desc);

create table public.attachments (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 512),
  file_name    text not null check (char_length(btrim(file_name)) between 1 and 255),
  mime_type    text not null default 'application/octet-stream' check (char_length(mime_type) <= 255),
  size_bytes   bigint not null check (size_bytes between 0 and 10485760),
  description  text not null default '' check (char_length(description) <= 1000),
  uploaded_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint attachments_path_in_room check (split_part(storage_path, '/', 1) = room_id::text)
);

create index attachments_room_idx on public.attachments (room_id, created_at desc);

create table public.comments (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references public.rooms (id) on delete cascade,
  application_id uuid references public.applications (id) on delete cascade,
  note_id        uuid references public.notes (id) on delete cascade,
  target_id      uuid references public.room_targets (id) on delete cascade,
  attachment_id  uuid references public.attachments (id) on delete cascade,
  parent_id      uuid references public.comments (id) on delete cascade,
  body           text not null check (char_length(btrim(body)) between 1 and 5000),
  author_id      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint comments_one_target check (num_nonnulls(application_id, note_id, target_id, attachment_id) = 1)
);

create index comments_room_idx on public.comments (room_id, created_at);
create index comments_application_idx on public.comments (application_id) where application_id is not null;
create index comments_note_idx on public.comments (note_id) where note_id is not null;
create index comments_target_idx on public.comments (target_id) where target_id is not null;
create index comments_attachment_idx on public.comments (attachment_id) where attachment_id is not null;

create table public.activity_log (
  id          bigint generated always as identity primary key,
  room_id     uuid not null references public.rooms (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null check (char_length(action) <= 64),
  entity_type text check (char_length(entity_type) <= 32),
  entity_id   uuid,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.activity_log is 'Room activity feed. Written only by triggers/RPCs; streamed through Realtime.';

create index activity_log_room_idx on public.activity_log (room_id, created_at desc);
create index activity_log_entity_idx on public.activity_log (room_id, entity_type, entity_id);

create trigger rooms_set_updated_at before update on public.rooms
  for each row execute function private.set_updated_at();
create trigger room_targets_set_updated_at before update on public.room_targets
  for each row execute function private.set_updated_at();
create trigger room_target_votes_set_updated_at before update on public.room_target_votes
  for each row execute function private.set_updated_at();
create trigger notes_set_updated_at before update on public.notes
  for each row execute function private.set_updated_at();
create trigger comments_set_updated_at before update on public.comments
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER: they read room_members without RLS,
-- which avoids recursive policies).
-- -----------------------------------------------------------------------------
create or replace function private.my_room_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select room_id from public.room_members where user_id = (select auth.uid());
$$;

create or replace function private.room_role_of(p_room_id uuid)
returns public.room_role
language sql stable security definer set search_path = ''
as $$
  select role from public.room_members
  where room_id = p_room_id and user_id = (select auth.uid());
$$;

create or replace function private.is_room_member(p_room_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.room_members
                 where room_id = p_room_id and user_id = (select auth.uid()));
$$;

create or replace function private.can_edit_room(p_room_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.room_members
                 where room_id = p_room_id and user_id = (select auth.uid())
                   and role in ('owner', 'editor'));
$$;

create or replace function private.is_room_owner(p_room_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.room_members
                 where room_id = p_room_id and user_id = (select auth.uid())
                   and role = 'owner');
$$;

create or replace function private.shares_room_with(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.room_members mine
    join public.room_members theirs on theirs.room_id = mine.room_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id
  );
$$;

create or replace function private.application_title(p_university text, p_program text)
returns text
language sql immutable set search_path = ''
as $$
  select left(concat_ws(' — ', nullif(btrim(p_university), ''), nullif(btrim(p_program), '')), 300);
$$;

-- Room members can now see each other's profiles.
drop policy "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_comembers_admin"
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_admin())
    or private.shares_room_with(id)
  );

-- -----------------------------------------------------------------------------
-- Activity log writer
-- -----------------------------------------------------------------------------
create or replace function private.log_activity(
  p_room_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.activity_log (room_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_room_id, auth.uid(), p_action, p_entity_type, p_entity_id,
          coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- True while the room row still exists (false during a cascading room delete,
-- when child triggers must not write new rows that reference the room).
create or replace function private.room_exists(p_room_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.rooms where id = p_room_id);
$$;

create or replace function private.normalize_invite_code(p_code text)
returns text
language sql immutable set search_path = ''
as $$
  select translate(upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g')), 'OIL', '011');
$$;

create or replace function private.room_invites_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  new.code := private.generate_invite_code();
  new.use_count := 0;
  new.revoked_at := null;
  if v_uid is not null then
    new.created_by := v_uid;
    if (select count(*) from public.room_invites
        where created_by = v_uid and created_at > now() - interval '1 hour') >= 10 then
      raise exception 'rate_limited'
        using hint = 'You can create up to 10 invite links per hour.';
    end if;
    if (select count(*) from public.room_invites
        where room_id = new.room_id and created_at > now() - interval '1 day') >= 50 then
      raise exception 'rate_limited'
        using hint = 'This room reached its daily limit of 50 invite links.';
    end if;
  end if;
  return new;
end;
$$;

create trigger room_invites_before_insert
  before insert on public.room_invites
  for each row execute function private.room_invites_before_insert();

create or replace function private.room_invites_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.log_activity(new.room_id, 'invite.created', 'invite', new.id,
                               jsonb_build_object('role', new.role));
  return null;
end;
$$;

create trigger room_invites_after_insert
  after insert on public.room_invites
  for each row execute function private.room_invites_after_insert();

-- -----------------------------------------------------------------------------
-- Membership invariants and side effects
-- -----------------------------------------------------------------------------
create or replace function private.room_members_ensure_owner()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if private.room_exists(old.room_id)
     and not exists (select 1 from public.room_members
                     where room_id = old.room_id and role = 'owner') then
    raise exception 'last_owner'
      using hint = 'A room needs at least one owner. Promote another member first, or delete the room.';
  end if;
  return null;
end;
$$;

create trigger room_members_ensure_owner
  after update of role or delete on public.room_members
  for each row execute function private.room_members_ensure_owner();

create or replace function private.room_members_after_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
begin
  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      select display_name into v_name from public.profiles where id = new.user_id;
      perform private.log_activity(new.room_id, 'member.role_changed', 'member', new.user_id,
                                   jsonb_build_object('target_name', v_name, 'role', new.role));
    end if;
    return null;
  end if;

  -- DELETE: skip side effects while the whole room is being deleted.
  if not private.room_exists(old.room_id) then
    return null;
  end if;

  -- A member who leaves (or is removed) takes their shared applications and votes along.
  delete from public.room_shared_applications rsa
  using public.applications a
  where rsa.room_id = old.room_id
    and rsa.application_id = a.id
    and a.user_id = old.user_id;

  delete from public.room_target_votes
  where room_id = old.room_id and user_id = old.user_id;

  if old.user_id = auth.uid() then
    perform private.log_activity(old.room_id, 'member.left', 'member', old.user_id);
  else
    select display_name into v_name from public.profiles where id = old.user_id;
    perform private.log_activity(old.room_id, 'member.removed', 'member', old.user_id,
                                 jsonb_build_object('target_name', v_name));
  end if;
  return null;
end;
$$;

create trigger room_members_after_change
  after update or delete on public.room_members
  for each row execute function private.room_members_after_change();

create or replace function private.rooms_after_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (new.name, new.description, new.country_code, new.intake_term, new.intake_year)
     is distinct from
     (old.name, old.description, old.country_code, old.intake_term, old.intake_year) then
    perform private.log_activity(new.id, 'room.updated', 'room', new.id,
                                 jsonb_build_object('name', new.name));
  end if;
  return null;
end;
$$;

create trigger rooms_after_update
  after update on public.rooms
  for each row execute function private.rooms_after_update();

-- -----------------------------------------------------------------------------
-- Sharing applications into rooms
-- -----------------------------------------------------------------------------
create or replace function private.room_shared_applications_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  a public.applications;
begin
  select * into a from public.applications where id = new.application_id;
  if a.visibility = 'private' then
    update public.applications set visibility = 'shared' where id = a.id;
  end if;
  perform private.log_activity(
    new.room_id, 'application.shared', 'application', new.application_id,
    jsonb_build_object('title', private.application_title(a.university_name, a.program_name),
                       'status', a.status));
  return null;
end;
$$;

create trigger room_shared_applications_after_insert
  after insert on public.room_shared_applications
  for each row execute function private.room_shared_applications_after_insert();

-- Unsharing forgets the room's history about that application (privacy).
create or replace function private.room_shared_applications_after_delete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.room_exists(old.room_id) then
    return null;
  end if;
  delete from public.activity_log
  where room_id = old.room_id and entity_type = 'application' and entity_id = old.application_id;
  delete from public.comments
  where room_id = old.room_id and application_id = old.application_id;
  return null;
end;
$$;

create trigger room_shared_applications_after_delete
  after delete on public.room_shared_applications
  for each row execute function private.room_shared_applications_after_delete();

create or replace function private.applications_after_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
begin
  -- "private" is a master switch: remove every room share.
  if new.visibility = 'private' and old.visibility <> 'private' then
    delete from public.room_shared_applications where application_id = new.id;
  end if;

  if new.status is distinct from old.status and new.visibility = 'shared' then
    for r in select room_id from public.room_shared_applications where application_id = new.id loop
      perform private.log_activity(
        r.room_id, 'application.status_changed', 'application', new.id,
        jsonb_build_object('title', private.application_title(new.university_name, new.program_name),
                           'from', old.status, 'to', new.status));
    end loop;
  end if;
  return null;
end;
$$;

create trigger applications_after_update
  after update on public.applications
  for each row execute function private.applications_after_update();

-- -----------------------------------------------------------------------------
-- Target list, votes, notes, comments, attachments: triggers
-- -----------------------------------------------------------------------------
create or replace function private.room_targets_after_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_activity(new.room_id, 'target.added', 'target', new.id,
                                 jsonb_build_object('title', new.title));
  elsif tg_op = 'DELETE' and private.room_exists(old.room_id) then
    delete from public.activity_log
    where room_id = old.room_id and entity_type = 'target' and entity_id = old.id
      and action = 'target.interest';
    perform private.log_activity(old.room_id, 'target.removed', 'target', old.id,
                                 jsonb_build_object('title', old.title));
  end if;
  return null;
end;
$$;

create trigger room_targets_after_change
  after insert or delete on public.room_targets
  for each row execute function private.room_targets_after_change();

create or replace function private.room_target_votes_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- room_id is derived from the target, never trusted from the client.
  select room_id into new.room_id from public.room_targets where id = new.target_id;
  if new.room_id is null then
    raise exception 'not_found' using hint = 'Target does not exist.';
  end if;
  if tg_op = 'INSERT' and auth.uid() is not null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

create trigger room_target_votes_before_write
  before insert or update on public.room_target_votes
  for each row execute function private.room_target_votes_before_write();

create or replace function private.room_target_votes_after_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_title text;
begin
  if tg_op = 'UPDATE' and new.interest = old.interest then
    return null;
  end if;
  select title into v_title from public.room_targets where id = new.target_id;
  -- Keep the feed readable: one interest entry per member and target.
  delete from public.activity_log
  where room_id = new.room_id and action = 'target.interest'
    and entity_id = new.target_id and actor_id = new.user_id;
  perform private.log_activity(new.room_id, 'target.interest', 'target', new.target_id,
                               jsonb_build_object('title', v_title, 'interest', new.interest));
  return null;
end;
$$;

create trigger room_target_votes_after_write
  after insert or update on public.room_target_votes
  for each row execute function private.room_target_votes_after_write();

create or replace function private.notes_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.updated_by := auth.uid();
    if tg_op = 'INSERT' then
      new.created_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

create trigger notes_before_write
  before insert or update on public.notes
  for each row execute function private.notes_before_write();

create or replace function private.notes_after_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_activity(new.room_id, 'note.created', 'note', new.id,
                                 jsonb_build_object('title', new.title, 'kind', new.kind));
  elsif tg_op = 'UPDATE' then
    if (new.title, new.body_md, new.url) is distinct from (old.title, old.body_md, old.url) then
      -- Collapse bursts of edits by the same person into one feed entry.
      delete from public.activity_log
      where room_id = new.room_id and action = 'note.updated' and entity_id = new.id
        and actor_id = auth.uid() and created_at > now() - interval '15 minutes';
      perform private.log_activity(new.room_id, 'note.updated', 'note', new.id,
                                   jsonb_build_object('title', new.title, 'kind', new.kind));
    end if;
  elsif tg_op = 'DELETE' and private.room_exists(old.room_id) then
    perform private.log_activity(old.room_id, 'note.deleted', 'note', old.id,
                                 jsonb_build_object('title', old.title, 'kind', old.kind));
  end if;
  return null;
end;
$$;

create trigger notes_after_change
  after insert or update or delete on public.notes
  for each row execute function private.notes_after_change();

create or replace function private.comments_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.author_id := auth.uid();
  end if;

  if new.application_id is not null and not exists (
       select 1 from public.room_shared_applications
       where room_id = new.room_id and application_id = new.application_id) then
    raise exception 'invalid_target' using hint = 'That application is not shared in this room.';
  elsif new.note_id is not null and not exists (
       select 1 from public.notes where id = new.note_id and room_id = new.room_id) then
    raise exception 'invalid_target' using hint = 'That note is not in this room.';
  elsif new.target_id is not null and not exists (
       select 1 from public.room_targets where id = new.target_id and room_id = new.room_id) then
    raise exception 'invalid_target' using hint = 'That target is not in this room.';
  elsif new.attachment_id is not null and not exists (
       select 1 from public.attachments where id = new.attachment_id and room_id = new.room_id) then
    raise exception 'invalid_target' using hint = 'That file is not in this room.';
  end if;

  if new.parent_id is not null and not exists (
       select 1 from public.comments c
       where c.id = new.parent_id
         and c.room_id = new.room_id
         and c.parent_id is null
         and c.application_id is not distinct from new.application_id
         and c.note_id is not distinct from new.note_id
         and c.target_id is not distinct from new.target_id
         and c.attachment_id is not distinct from new.attachment_id) then
    raise exception 'invalid_parent' using hint = 'Replies must belong to a top-level comment on the same item.';
  end if;
  return new;
end;
$$;

create trigger comments_before_insert
  before insert on public.comments
  for each row execute function private.comments_before_insert();

create or replace function private.comments_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_type  text;
  v_id    uuid;
  v_title text;
begin
  if new.application_id is not null then
    v_type := 'application';
    v_id := new.application_id;
    select private.application_title(university_name, program_name) into v_title
    from public.applications where id = new.application_id;
  elsif new.note_id is not null then
    v_type := 'note';
    v_id := new.note_id;
    select title into v_title from public.notes where id = new.note_id;
  elsif new.target_id is not null then
    v_type := 'target';
    v_id := new.target_id;
    select title into v_title from public.room_targets where id = new.target_id;
  else
    v_type := 'attachment';
    v_id := new.attachment_id;
    select file_name into v_title from public.attachments where id = new.attachment_id;
  end if;
  perform private.log_activity(new.room_id, 'comment.created', v_type, v_id,
                               jsonb_build_object('title', v_title, 'comment_id', new.id,
                                                  'excerpt', left(new.body, 140)));
  return null;
end;
$$;

create trigger comments_after_insert
  after insert on public.comments
  for each row execute function private.comments_after_insert();

create or replace function private.attachments_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.uploaded_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger attachments_before_insert
  before insert on public.attachments
  for each row execute function private.attachments_before_insert();

create or replace function private.attachments_after_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_activity(new.room_id, 'file.uploaded', 'attachment', new.id,
                                 jsonb_build_object('title', new.file_name, 'size', new.size_bytes));
  elsif private.room_exists(old.room_id) then
    perform private.log_activity(old.room_id, 'file.deleted', 'attachment', old.id,
                                 jsonb_build_object('title', old.file_name));
  end if;
  return null;
end;
$$;

create trigger attachments_after_change
  after insert or delete on public.attachments
  for each row execute function private.attachments_after_change();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_invites enable row level security;
alter table public.room_shared_applications enable row level security;
alter table public.room_targets enable row level security;
alter table public.room_target_votes enable row level security;
alter table public.notes enable row level security;
alter table public.attachments enable row level security;
alter table public.comments enable row level security;
alter table public.activity_log enable row level security;

-- rooms: members read; owners update/delete; creation via create_room().
create policy "rooms_select_members" on public.rooms for select to authenticated
  using (id in (select private.my_room_ids()));
create policy "rooms_update_owners" on public.rooms for update to authenticated
  using (private.is_room_owner(id)) with check (private.is_room_owner(id));
create policy "rooms_delete_owners" on public.rooms for delete to authenticated
  using (private.is_room_owner(id));

-- room_members: members read; owners change roles / remove; anyone can leave.
create policy "room_members_select_members" on public.room_members for select to authenticated
  using (room_id in (select private.my_room_ids()));
create policy "room_members_update_owners" on public.room_members for update to authenticated
  using (private.is_room_owner(room_id)) with check (private.is_room_owner(room_id));
create policy "room_members_delete_self_or_owner" on public.room_members for delete to authenticated
  using (user_id = (select auth.uid()) or private.is_room_owner(room_id));

-- room_invites: owners only.
create policy "room_invites_select_owners" on public.room_invites for select to authenticated
  using (private.is_room_owner(room_id));
create policy "room_invites_insert_owners" on public.room_invites for insert to authenticated
  with check (private.is_room_owner(room_id) and created_by = (select auth.uid()));
create policy "room_invites_update_owners" on public.room_invites for update to authenticated
  using (private.is_room_owner(room_id)) with check (private.is_room_owner(room_id));
create policy "room_invites_delete_owners" on public.room_invites for delete to authenticated
  using (private.is_room_owner(room_id));

-- room_shared_applications: members read; the application owner shares
-- (needs editor/owner role); the application owner or a room owner unshares.
create policy "room_shared_applications_select_members" on public.room_shared_applications
  for select to authenticated
  using (room_id in (select private.my_room_ids()));
create policy "room_shared_applications_insert_own_app" on public.room_shared_applications
  for insert to authenticated
  with check (
    shared_by = (select auth.uid())
    and private.can_edit_room(room_id)
    and exists (select 1 from public.applications a
                where a.id = application_id and a.user_id = (select auth.uid()))
  );
create policy "room_shared_applications_delete_owner" on public.room_shared_applications
  for delete to authenticated
  using (
    exists (select 1 from public.applications a
            where a.id = application_id and a.user_id = (select auth.uid()))
    or private.is_room_owner(room_id)
  );

-- room_targets
create policy "room_targets_select_members" on public.room_targets for select to authenticated
  using (room_id in (select private.my_room_ids()));
create policy "room_targets_insert_editors" on public.room_targets for insert to authenticated
  with check (private.can_edit_room(room_id) and created_by = (select auth.uid()));
create policy "room_targets_update_editors" on public.room_targets for update to authenticated
  using (private.can_edit_room(room_id)) with check (private.can_edit_room(room_id));
create policy "room_targets_delete_creator_or_owner" on public.room_targets for delete to authenticated
  using ((created_by = (select auth.uid()) and private.can_edit_room(room_id))
         or private.is_room_owner(room_id));

-- room_target_votes: one row per member and target.
create policy "room_target_votes_select_members" on public.room_target_votes for select to authenticated
  using (room_id in (select private.my_room_ids()));
create policy "room_target_votes_insert_self" on public.room_target_votes for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_edit_room(room_id));
create policy "room_target_votes_update_self" on public.room_target_votes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.can_edit_room(room_id));
create policy "room_target_votes_delete_self" on public.room_target_votes for delete to authenticated
  using (user_id = (select auth.uid()));

-- notes: editors create and edit; creator (still an editor) or owner deletes.
create policy "notes_select_members" on public.notes for select to authenticated
  using (room_id in (select private.my_room_ids()));
create policy "notes_insert_editors" on public.notes for insert to authenticated
  with check (private.can_edit_room(room_id) and created_by = (select auth.uid()));
create policy "notes_update_editors" on public.notes for update to authenticated
  using (private.can_edit_room(room_id)) with check (private.can_edit_room(room_id));
create policy "notes_delete_creator_or_owner" on public.notes for delete to authenticated
  using ((created_by = (select auth.uid()) and private.can_edit_room(room_id))
         or private.is_room_owner(room_id));

-- attachments
create policy "attachments_select_members" on public.attachments for select to authenticated
  using (room_id in (select private.my_room_ids()));
create policy "attachments_insert_editors" on public.attachments for insert to authenticated
  with check (private.can_edit_room(room_id) and uploaded_by = (select auth.uid()));
create policy "attachments_update_uploader" on public.attachments for update to authenticated
  using (uploaded_by = (select auth.uid()) and private.can_edit_room(room_id))
  with check (uploaded_by = (select auth.uid()) and private.can_edit_room(room_id));
create policy "attachments_delete_uploader_or_owner" on public.attachments for delete to authenticated
  using (uploaded_by = (select auth.uid()) or private.is_room_owner(room_id));

-- comments
create policy "comments_select_members" on public.comments for select to authenticated
  using (room_id in (select private.my_room_ids()));
create policy "comments_insert_editors" on public.comments for insert to authenticated
  with check (private.can_edit_room(room_id) and author_id = (select auth.uid()));
create policy "comments_update_author" on public.comments for update to authenticated
  using (author_id = (select auth.uid()) and private.can_edit_room(room_id))
  with check (author_id = (select auth.uid()) and private.can_edit_room(room_id));
create policy "comments_delete_author_or_owner" on public.comments for delete to authenticated
  using (author_id = (select auth.uid()) or private.is_room_owner(room_id));

-- activity_log: members read; written only by SECURITY DEFINER code.
create policy "activity_log_select_members" on public.activity_log for select to authenticated
  using (room_id in (select private.my_room_ids()));

-- -----------------------------------------------------------------------------
-- Grants (column-level: ids, rooms and authors are immutable from the API)
-- -----------------------------------------------------------------------------
revoke all on public.rooms, public.room_members, public.room_invites,
              public.room_shared_applications, public.room_targets, public.room_target_votes,
              public.notes, public.attachments, public.comments, public.activity_log
  from anon;
revoke insert, update on public.rooms, public.room_members, public.room_invites,
              public.room_shared_applications, public.room_targets, public.room_target_votes,
              public.notes, public.attachments, public.comments, public.activity_log
  from authenticated;
revoke delete on public.activity_log from authenticated;

grant update (name, description, country_code, intake_term, intake_year)
  on public.rooms to authenticated;
grant update (role) on public.room_members to authenticated;

grant insert (room_id, role, expires_at, max_uses) on public.room_invites to authenticated;
grant update (revoked_at) on public.room_invites to authenticated;

grant insert (room_id, application_id) on public.room_shared_applications to authenticated;

grant insert (id, room_id, university_id, program_id, title, country_code, url, notes)
  on public.room_targets to authenticated;
grant update (university_id, program_id, title, country_code, url, notes)
  on public.room_targets to authenticated;

grant insert (target_id, interest) on public.room_target_votes to authenticated;
grant update (interest) on public.room_target_votes to authenticated;

grant insert (id, room_id, kind, title, body_md, url, is_pinned) on public.notes to authenticated;
grant update (title, body_md, url, is_pinned) on public.notes to authenticated;

grant insert (id, room_id, storage_path, file_name, mime_type, size_bytes, description)
  on public.attachments to authenticated;
grant update (description) on public.attachments to authenticated;

grant insert (id, room_id, application_id, note_id, target_id, attachment_id, parent_id, body)
  on public.comments to authenticated;
grant update (body) on public.comments to authenticated;

-- -----------------------------------------------------------------------------
-- RPCs
-- -----------------------------------------------------------------------------

-- Create a room and become its owner (max 20 new rooms per user per day).
create or replace function public.create_room(
  p_name text,
  p_description text default '',
  p_country_code text default null,
  p_intake_term public.intake_term default null,
  p_intake_year integer default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_room uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if (select count(*) from public.rooms
      where created_by = v_uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'rate_limited' using hint = 'You can create up to 20 rooms per day.';
  end if;

  insert into public.rooms (name, description, country_code, intake_term, intake_year, created_by)
  values (btrim(p_name), coalesce(btrim(p_description), ''), nullif(p_country_code, ''),
          p_intake_term, p_intake_year::smallint, v_uid)
  returning id into v_room;

  insert into public.room_members (room_id, user_id, role) values (v_room, v_uid, 'owner');
  perform private.log_activity(v_room, 'room.created', 'room', v_room,
                               jsonb_build_object('name', btrim(p_name)));
  return v_room;
end;
$$;

-- My rooms with my role and a few counters (RLS applies: SECURITY INVOKER).
create or replace function public.list_my_rooms()
returns table (
  id uuid,
  name text,
  description text,
  country_code text,
  intake_term public.intake_term,
  intake_year smallint,
  created_at timestamptz,
  updated_at timestamptz,
  my_role public.room_role,
  member_count integer,
  shared_count integer,
  target_count integer,
  last_activity_at timestamptz
)
language sql stable security invoker set search_path = ''
as $$
  select r.id, r.name, r.description, r.country_code, r.intake_term, r.intake_year,
         r.created_at, r.updated_at, m.role,
         (select count(*)::int from public.room_members x where x.room_id = r.id),
         (select count(*)::int from public.room_shared_applications x where x.room_id = r.id),
         (select count(*)::int from public.room_targets x where x.room_id = r.id),
         (select max(a.created_at) from public.activity_log a where a.room_id = r.id)
  from public.rooms r
  join public.room_members m on m.room_id = r.id and m.user_id = (select auth.uid())
  order by coalesce((select max(a.created_at) from public.activity_log a where a.room_id = r.id),
                    r.updated_at) desc;
$$;

-- Owners: revoke all active links and create a fresh one.
create or replace function public.regenerate_room_invite(
  p_room_id uuid,
  p_role public.room_role default 'editor',
  p_expires_at timestamptz default null,
  p_max_uses integer default null
)
returns public.room_invites
language plpgsql security invoker set search_path = ''
as $$
declare
  v public.room_invites;
begin
  if not private.is_room_owner(p_room_id) then
    raise exception 'not_authorized' using hint = 'Only room owners can manage invites.';
  end if;
  update public.room_invites set revoked_at = now()
  where room_id = p_room_id and revoked_at is null;
  insert into public.room_invites (room_id, role, expires_at, max_uses)
  values (p_room_id, p_role, p_expires_at, p_max_uses)
  returning * into v;
  return v;
end;
$$;

-- Invite landing page. Room details are only revealed for valid codes (or to members).
create or replace function public.get_invite_preview(p_code text)
returns table (
  room_id uuid,
  room_name text,
  room_description text,
  role public.room_role,
  expires_at timestamptz,
  member_count integer,
  is_member boolean,
  is_valid boolean
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_inv    public.room_invites;
  v_room   public.rooms;
  v_member boolean;
  v_valid  boolean;
begin
  select * into v_inv from public.room_invites
  where code = private.normalize_invite_code(p_code);
  if not found then
    return;
  end if;

  select * into v_room from public.rooms where id = v_inv.room_id;
  v_member := exists (select 1 from public.room_members m
                      where m.room_id = v_inv.room_id and m.user_id = auth.uid());
  v_valid := v_inv.revoked_at is null
             and (v_inv.expires_at is null or v_inv.expires_at > now())
             and (v_inv.max_uses is null or v_inv.use_count < v_inv.max_uses);

  room_id := v_room.id;
  is_member := v_member;
  is_valid := v_valid;
  if v_valid or v_member then
    room_name := v_room.name;
    room_description := v_room.description;
    role := v_inv.role;
    expires_at := v_inv.expires_at;
    member_count := (select count(*)::int from public.room_members m where m.room_id = v_room.id);
  end if;
  return next;
end;
$$;

-- Join a room with an invite code. Returns the room id.
create or replace function public.join_room(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.room_invites;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_inv from public.room_invites
  where code = private.normalize_invite_code(p_code)
  for update;

  if not found
     or v_inv.revoked_at is not null
     or (v_inv.expires_at is not null and v_inv.expires_at <= now())
     or (v_inv.max_uses is not null and v_inv.use_count >= v_inv.max_uses) then
    raise exception 'invite_invalid' using hint = 'This invite link is invalid, expired or revoked.';
  end if;

  if exists (select 1 from public.room_members
             where room_id = v_inv.room_id and user_id = v_uid) then
    return v_inv.room_id;
  end if;

  insert into public.room_members (room_id, user_id, role) values (v_inv.room_id, v_uid, v_inv.role);
  update public.room_invites set use_count = use_count + 1 where id = v_inv.id;
  perform private.log_activity(v_inv.room_id, 'member.joined', 'member', v_uid,
                               jsonb_build_object('role', v_inv.role));
  return v_inv.room_id;
end;
$$;

-- Set exactly which rooms an application is shared with (empty = private).
create or replace function public.set_application_sharing(p_application_id uuid, p_room_ids uuid[])
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_rooms uuid[] := coalesce(p_room_ids, '{}');
begin
  if not exists (select 1 from public.applications
                 where id = p_application_id and user_id = auth.uid()) then
    raise exception 'not_found' using hint = 'Application not found.';
  end if;

  delete from public.room_shared_applications
  where application_id = p_application_id and not (room_id = any (v_rooms));

  if cardinality(v_rooms) = 0 then
    update public.applications set visibility = 'private' where id = p_application_id;
  else
    update public.applications set visibility = 'shared' where id = p_application_id;
    insert into public.room_shared_applications (room_id, application_id)
    select distinct r, p_application_id from unnest(v_rooms) as r
    on conflict (room_id, application_id) do nothing;
  end if;
end;
$$;

-- Shared-applications board: safe columns only (never the private notes).
create or replace function public.get_room_applications(p_room_id uuid)
returns table (
  application_id uuid,
  owner_id uuid,
  owner_name text,
  owner_avatar_url text,
  country_code text,
  university_id uuid,
  university_name text,
  program_id uuid,
  program_name text,
  degree_level public.degree_level,
  intake_term public.intake_term,
  intake_year smallint,
  status public.application_status,
  submitted_at date,
  result_date date,
  decision_notes text,
  portal_url text,
  application_fee_amount numeric,
  application_fee_currency text,
  tuition_amount numeric,
  tuition_currency text,
  tuition_period public.tuition_period,
  funding_info text,
  shared_at timestamptz,
  updated_at timestamptz,
  next_deadline_at timestamptz,
  next_deadline_label text,
  requirements_done integer,
  requirements_total integer,
  comment_count integer
)
language sql stable security definer set search_path = ''
as $$
  select a.id, a.user_id, p.display_name, p.avatar_url, a.country_code, a.university_id,
         a.university_name, a.program_id, a.program_name, a.degree_level, a.intake_term,
         a.intake_year, a.status, a.submitted_at, a.result_date, a.decision_notes, a.portal_url,
         a.application_fee_amount, a.application_fee_currency, a.tuition_amount,
         a.tuition_currency, a.tuition_period, a.funding_info, rsa.shared_at, a.updated_at,
         nd.due_at, nd.label,
         coalesce(rq.done, 0), coalesce(rq.total, 0),
         (select count(*)::int from public.comments c
          where c.room_id = rsa.room_id and c.application_id = a.id)
  from public.room_shared_applications rsa
  join public.applications a on a.id = rsa.application_id and a.visibility = 'shared'
  join public.room_members owner_m on owner_m.room_id = rsa.room_id and owner_m.user_id = a.user_id
  left join public.profiles p on p.id = a.user_id
  left join lateral (
    select d.due_at, d.label from public.deadlines d
    where d.application_id = a.id and not d.is_done and d.due_at >= now()
    order by d.due_at limit 1
  ) nd on true
  left join lateral (
    select count(*) filter (where r.is_done)::int as done, count(*)::int as total
    from public.application_requirements r where r.application_id = a.id
  ) rq on true
  where rsa.room_id = p_room_id
    and private.is_room_member(p_room_id)
  order by rsa.shared_at desc;
$$;

-- One shared application with its deadlines and checklist (safe columns only).
create or replace function public.get_shared_application(p_room_id uuid, p_application_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'application', jsonb_build_object(
      'id', a.id, 'owner_id', a.user_id, 'owner_name', p.display_name,
      'owner_avatar_url', p.avatar_url, 'country_code', a.country_code,
      'university_id', a.university_id, 'university_name', a.university_name,
      'program_id', a.program_id, 'program_name', a.program_name,
      'degree_level', a.degree_level, 'intake_term', a.intake_term, 'intake_year', a.intake_year,
      'status', a.status, 'submitted_at', a.submitted_at, 'result_date', a.result_date,
      'decision_notes', a.decision_notes, 'portal_url', a.portal_url,
      'application_fee_amount', a.application_fee_amount,
      'application_fee_currency', a.application_fee_currency,
      'tuition_amount', a.tuition_amount, 'tuition_currency', a.tuition_currency,
      'tuition_period', a.tuition_period, 'funding_info', a.funding_info,
      'shared_at', rsa.shared_at, 'updated_at', a.updated_at),
    'deadlines', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'label', d.label, 'due_at', d.due_at,
                                          'is_done', d.is_done) order by d.due_at)
      from public.deadlines d where d.application_id = a.id), '[]'::jsonb),
    'requirements', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'label', r.label,
                                          'is_done', r.is_done) order by r.sort_order, r.created_at)
      from public.application_requirements r where r.application_id = a.id), '[]'::jsonb)
  )
  from public.room_shared_applications rsa
  join public.applications a on a.id = rsa.application_id and a.visibility = 'shared'
  join public.room_members owner_m on owner_m.room_id = rsa.room_id and owner_m.user_id = a.user_id
  left join public.profiles p on p.id = a.user_id
  where rsa.room_id = p_room_id
    and rsa.application_id = p_application_id
    and private.is_room_member(p_room_id);
$$;

-- Set or clear (NULL) my interest marker on a target.
create or replace function public.set_target_interest(
  p_target_id uuid,
  p_interest public.target_interest default null
)
returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  if p_interest is null then
    delete from public.room_target_votes
    where target_id = p_target_id and user_id = auth.uid();
  else
    insert into public.room_target_votes (target_id, interest)
    values (p_target_id, p_interest)
    on conflict (target_id, user_id) do update set interest = excluded.interest;
  end if;
end;
$$;

-- Function privileges: RPCs are for signed-in users, except the invite preview.
revoke execute on function public.create_room(text, text, text, public.intake_term, integer) from public, anon;
revoke execute on function public.list_my_rooms() from public, anon;
revoke execute on function public.regenerate_room_invite(uuid, public.room_role, timestamptz, integer) from public, anon;
revoke execute on function public.get_invite_preview(text) from public;
revoke execute on function public.join_room(text) from public, anon;
revoke execute on function public.set_application_sharing(uuid, uuid[]) from public, anon;
revoke execute on function public.get_room_applications(uuid) from public, anon;
revoke execute on function public.get_shared_application(uuid, uuid) from public, anon;
revoke execute on function public.set_target_interest(uuid, public.target_interest) from public, anon;

grant execute on function public.create_room(text, text, text, public.intake_term, integer) to authenticated;
grant execute on function public.list_my_rooms() to authenticated;
grant execute on function public.regenerate_room_invite(uuid, public.room_role, timestamptz, integer) to authenticated;
grant execute on function public.get_invite_preview(text) to anon, authenticated;
grant execute on function public.join_room(text) to authenticated;
grant execute on function public.set_application_sharing(uuid, uuid[]) to authenticated;
grant execute on function public.get_room_applications(uuid) to authenticated;
grant execute on function public.get_shared_application(uuid, uuid) to authenticated;
grant execute on function public.set_target_interest(uuid, public.target_interest) to authenticated;

-- -----------------------------------------------------------------------------
-- Storage: private bucket for room files. Object path: <room_id>/<uuid>-<name>
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'room-files', 'room-files', false, 10485760,
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'text/plain', 'text/markdown', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "room_files_select_members" on storage.objects for select to authenticated
  using (bucket_id = 'room-files'
         and private.is_room_member(private.try_uuid((storage.foldername(name))[1])));

create policy "room_files_insert_editors" on storage.objects for insert to authenticated
  with check (bucket_id = 'room-files'
              and private.can_edit_room(private.try_uuid((storage.foldername(name))[1])));

create policy "room_files_delete_uploader_or_owner" on storage.objects for delete to authenticated
  using (bucket_id = 'room-files'
         and (owner_id = (select auth.uid())::text
              or private.is_room_owner(private.try_uuid((storage.foldername(name))[1]))));

-- -----------------------------------------------------------------------------
-- Realtime: stream new activity rows to room members (RLS is enforced per subscriber).
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

alter publication supabase_realtime add table public.activity_log;
