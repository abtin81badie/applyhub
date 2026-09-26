-- =============================================================================
-- ApplyHub · 1. Profiles & auth hooks
-- =============================================================================

create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  display_name        text not null default ''
                        check (char_length(display_name) <= 80),
  avatar_url          text
                        check (avatar_url is null
                               or (avatar_url ~* '^https://[^\s]+$' and char_length(avatar_url) <= 2048)),
  field_of_study      text check (char_length(field_of_study) <= 120),
  target_degree       public.degree_level,
  target_intake_term  public.intake_term,
  target_intake_year  smallint check (target_intake_year between 2000 and 2100),
  target_countries    text[] not null default '{}'
                        check (cardinality(target_countries) <= 30
                               and array_to_string(target_countries, ',') ~ '^([A-Z]{2}(,[A-Z]{2})*)?$'),
  role                public.user_role not null default 'user',
  onboarded_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.profiles is 'Public-facing profile for each auth user. role is admin-managed.';
comment on column public.profiles.role is 'user | admin. Not updatable by clients (column grants); see set_user_role().';

create index profiles_role_idx on public.profiles (role) where role <> 'user';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Role helpers
-- -----------------------------------------------------------------------------
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- Create a profile for every new auth user (email, magic link or OAuth).
-- Never blocks sign-up: failures are logged and the app lazily upserts.
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text;
  v_avatar text;
begin
  v_name := coalesce(
    nullif(btrim(meta ->> 'display_name'), ''),
    nullif(btrim(meta ->> 'full_name'), ''),
    nullif(btrim(meta ->> 'name'), ''),
    nullif(btrim(meta ->> 'user_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    ''
  );
  v_avatar := coalesce(meta ->> 'avatar_url', meta ->> 'picture');
  if v_avatar is not null
     and (v_avatar !~* '^https://[^\s]+$' or char_length(v_avatar) > 2048) then
    v_avatar := null;
  end if;

  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, left(v_name, 80), v_avatar)
  on conflict (id) do nothing;

  return new;
exception
  when others then
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Phase 3 (rooms) widens this to people you share a room with.
create policy "profiles_select_self_or_admin"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

-- Fallback when the sign-up trigger could not create the row.
create policy "profiles_insert_self"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()) and role = 'user');

create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No DELETE policy: profiles are removed by the auth.users cascade.

revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant insert (id, display_name, avatar_url, field_of_study, target_degree,
              target_intake_term, target_intake_year, target_countries, onboarded_at)
  on public.profiles to authenticated;
grant update (display_name, avatar_url, field_of_study, target_degree,
              target_intake_term, target_intake_year, target_countries, onboarded_at)
  on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- RPC: name + avatar for a list of users (e.g. contributors in public history)
-- -----------------------------------------------------------------------------
create or replace function public.get_profile_cards(p_ids uuid[])
returns table (id uuid, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.avatar_url
  from public.profiles p
  where p.id = any (p_ids[1:200]);
$$;

comment on function public.get_profile_cards(uuid[]) is
  'Display name and avatar only, for up to 200 ids. Safe for anonymous callers.';

revoke execute on function public.get_profile_cards(uuid[]) from public;
grant execute on function public.get_profile_cards(uuid[]) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- RPC: admins change roles (the SQL editor can also update profiles.role).
-- -----------------------------------------------------------------------------
create or replace function public.set_user_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_authorized' using hint = 'Only administrators can change roles.';
  end if;
  if p_user_id = auth.uid() and p_role <> 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'last_admin' using hint = 'Promote another administrator first.';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
  if not found then
    raise exception 'not_found' using hint = 'No such user.';
  end if;
end;
$$;

revoke execute on function public.set_user_role(uuid, public.user_role) from public, anon;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;
