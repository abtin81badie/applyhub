-- =============================================================================
-- ApplyHub · 6. Community contributions, moderation queue and revision history
--
-- Signed-in users propose creates/edits/removals of knowledge-base rows.
-- Proposals are validated on submission (dry run inside a rolled-back
-- savepoint) and applied by an admin through approve_edit_proposal().
-- Every change to a knowledge-base table is recorded in kb_revisions by
-- triggers, including direct admin edits.
-- =============================================================================

create type public.kb_entity as enum (
  'country_guide', 'country_link', 'university', 'program',
  'program_requirement', 'program_deadline'
);
create type public.proposal_action as enum ('create', 'update', 'delete');
create type public.proposal_status as enum ('pending', 'approved', 'rejected', 'withdrawn');

create table public.edit_proposals (
  id               uuid primary key default gen_random_uuid(),
  entity_type      public.kb_entity not null,
  entity_id        uuid,
  action           public.proposal_action not null,
  payload          jsonb not null default '{}'::jsonb
                     check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 102400),
  base_snapshot    jsonb,
  message          text not null default '' check (char_length(message) <= 2000),
  status           public.proposal_status not null default 'pending',
  proposed_by      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reviewed_by      uuid references public.profiles (id) on delete set null,
  reviewed_at      timestamptz,
  review_note      text check (char_length(review_note) <= 2000),
  result_entity_id uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint edit_proposals_entity_id check ((action = 'create') = (entity_id is null))
);

comment on table public.edit_proposals is
  'Moderation queue for knowledge-base changes. payload = proposed column values; base_snapshot = row at submission time.';

create index edit_proposals_status_idx on public.edit_proposals (status, created_at);
create index edit_proposals_proposer_idx on public.edit_proposals (proposed_by, created_at desc);
create index edit_proposals_entity_idx on public.edit_proposals (entity_type, entity_id);

create trigger edit_proposals_set_updated_at before update on public.edit_proposals
  for each row execute function private.set_updated_at();

create table public.kb_revisions (
  id           bigint generated always as identity primary key,
  entity_type  public.kb_entity not null,
  entity_id    uuid not null,
  action       text not null check (action in ('insert', 'update', 'delete')),
  old_data     jsonb,
  new_data     jsonb,
  proposal_id  uuid references public.edit_proposals (id) on delete set null,
  changed_by   uuid references public.profiles (id) on delete set null,
  changed_at   timestamptz not null default now()
);

comment on table public.kb_revisions is 'Append-only history of every knowledge-base change.';

create index kb_revisions_entity_idx on public.kb_revisions (entity_type, entity_id, changed_at desc);

-- -----------------------------------------------------------------------------
-- Entity metadata: table name and the columns a proposal may set.
-- (is_published and created_by are admin/system managed.)
-- -----------------------------------------------------------------------------
create or replace function private.kb_table(p_entity public.kb_entity)
returns text
language sql immutable set search_path = ''
as $$
  select case p_entity
    when 'country_guide' then 'country_guides'
    when 'country_link' then 'country_links'
    when 'university' then 'universities'
    when 'program' then 'programs'
    when 'program_requirement' then 'program_requirements'
    when 'program_deadline' then 'program_deadlines'
  end;
$$;

create or replace function private.kb_editable_columns(p_entity public.kb_entity)
returns text[]
language sql immutable set search_path = ''
as $$
  select case p_entity
    when 'country_guide' then array[
      'country_code', 'locale', 'section', 'body_md', 'source_url', 'last_verified_at',
      'is_placeholder']
    when 'country_link' then array[
      'country_code', 'label_en', 'label_fa', 'url', 'category', 'description',
      'last_verified_at', 'is_placeholder', 'sort_order']
    when 'university' then array[
      'country_code', 'name_en', 'name_fa', 'city', 'website_url', 'institution_type',
      'description_md', 'source_url', 'last_verified_at', 'is_placeholder']
    when 'program' then array[
      'university_id', 'name_en', 'name_fa', 'degree_level', 'field', 'languages',
      'duration_months', 'tuition_amount_min', 'tuition_amount_max', 'tuition_currency',
      'tuition_period', 'application_fee_amount', 'application_fee_currency', 'website_url',
      'description_md', 'source_url', 'last_verified_at', 'is_placeholder']
    when 'program_requirement' then array[
      'program_id', 'kind', 'description', 'is_mandatory', 'source_url', 'last_verified_at',
      'is_placeholder', 'sort_order']
    when 'program_deadline' then array[
      'program_id', 'intake_term', 'intake_year', 'round_label', 'applicant_group', 'opens_at',
      'deadline_at', 'notes', 'source_url', 'last_verified_at', 'is_placeholder']
  end;
$$;

-- Applies a change to a knowledge-base table and returns the row id.
-- Only whitelisted columns present in the payload are written.
create or replace function private.apply_kb_change(
  p_entity public.kb_entity,
  p_action public.proposal_action,
  p_entity_id uuid,
  p_payload jsonb,
  p_actor uuid
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_table text := private.kb_table(p_entity);
  v_cols  text[];
  v_list  text;
  v_sel   text;
  v_id    uuid;
begin
  if p_action = 'delete' then
    execute format('delete from public.%I where id = $1 returning id', v_table)
      into v_id using p_entity_id;
    if v_id is null then
      raise exception 'not_found' using hint = 'The item no longer exists.';
    end if;
    return v_id;
  end if;

  select array_agg(k order by k) into v_cols
  from jsonb_object_keys(coalesce(p_payload, '{}'::jsonb)) as k
  where k = any (private.kb_editable_columns(p_entity));

  if v_cols is null then
    raise exception 'invalid_payload' using hint = 'No changes proposed.';
  end if;

  select string_agg(format('%I', c), ', '), string_agg(format('r.%I', c), ', ')
  into v_list, v_sel
  from unnest(v_cols) as c;

  if p_action = 'create' then
    execute format(
      'insert into public.%1$I (%2$s, created_by) select %3$s, $2 from jsonb_populate_record(null::public.%1$I, $1) as r returning id',
      v_table, v_list, v_sel)
      into v_id using p_payload, p_actor;
  else
    execute format(
      'update public.%1$I as t set (%2$s) = (select %3$s from jsonb_populate_record(t, $1) as r) where t.id = $2 returning t.id',
      v_table, v_list, v_sel)
      into v_id using p_payload, p_entity_id;
    if v_id is null then
      raise exception 'not_found' using hint = 'The item no longer exists.';
    end if;
  end if;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Proposal submission: normalize, snapshot, validate (dry run), rate limit.
-- -----------------------------------------------------------------------------
create or replace function private.edit_proposals_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_unknown text[];
  v_snap    jsonb;
begin
  if v_uid is not null then
    new.proposed_by := v_uid;
  end if;
  new.status := 'pending';
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.review_note := null;
  new.result_entity_id := null;
  new.payload := coalesce(new.payload, '{}'::jsonb);

  if v_uid is not null and (select count(*) from public.edit_proposals
                            where proposed_by = v_uid and status = 'pending') >= 30 then
    raise exception 'rate_limited'
      using hint = 'You already have 30 proposals waiting for review.';
  end if;

  select array_agg(k) into v_unknown
  from jsonb_object_keys(new.payload) as k
  where not (k = any (private.kb_editable_columns(new.entity_type)));
  if v_unknown is not null then
    raise exception 'invalid_payload'
      using hint = 'Unknown or read-only fields: ' || array_to_string(v_unknown, ', ');
  end if;

  if new.action = 'create' then
    new.base_snapshot := null;
  else
    execute format('select to_jsonb(t) from public.%I as t where t.id = $1',
                   private.kb_table(new.entity_type))
      into v_snap using new.entity_id;
    if v_snap is null then
      raise exception 'not_found' using hint = 'The item no longer exists.';
    end if;
    new.base_snapshot := v_snap;
    if new.action = 'delete' then
      new.payload := '{}'::jsonb;
    end if;
  end if;

  -- Dry run: apply the change inside a savepoint that is always rolled back,
  -- so type errors and constraint violations are reported to the proposer now.
  begin
    perform private.apply_kb_change(new.entity_type, new.action, new.entity_id,
                                    new.payload, new.proposed_by);
    raise exception 'dry_run_ok' using errcode = 'P0100';
  exception
    when sqlstate 'P0100' then
      null;
    when others then
      raise exception 'invalid_payload' using hint = sqlerrm;
  end;

  return new;
end;
$$;

create trigger edit_proposals_before_insert
  before insert on public.edit_proposals
  for each row execute function private.edit_proposals_before_insert();

-- -----------------------------------------------------------------------------
-- Revision history for every knowledge-base table.
-- -----------------------------------------------------------------------------
create or replace function private.kb_revision_trigger()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_proposal uuid := private.try_uuid(nullif(current_setting('applyhub.proposal_id', true), ''));
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'updated_at') = (to_jsonb(old) - 'updated_at') then
      return null;
    end if;
    insert into public.kb_revisions (entity_type, entity_id, action, old_data, new_data, proposal_id, changed_by)
    values (tg_argv[0]::public.kb_entity, new.id, 'update', to_jsonb(old), to_jsonb(new), v_proposal, auth.uid());
  elsif tg_op = 'INSERT' then
    insert into public.kb_revisions (entity_type, entity_id, action, old_data, new_data, proposal_id, changed_by)
    values (tg_argv[0]::public.kb_entity, new.id, 'insert', null, to_jsonb(new), v_proposal, auth.uid());
  else
    insert into public.kb_revisions (entity_type, entity_id, action, old_data, new_data, proposal_id, changed_by)
    values (tg_argv[0]::public.kb_entity, old.id, 'delete', to_jsonb(old), null, v_proposal, auth.uid());
  end if;
  return null;
end;
$$;

create trigger country_guides_revisions after insert or update or delete on public.country_guides
  for each row execute function private.kb_revision_trigger('country_guide');
create trigger country_links_revisions after insert or update or delete on public.country_links
  for each row execute function private.kb_revision_trigger('country_link');
create trigger universities_revisions after insert or update or delete on public.universities
  for each row execute function private.kb_revision_trigger('university');
create trigger programs_revisions after insert or update or delete on public.programs
  for each row execute function private.kb_revision_trigger('program');
create trigger program_requirements_revisions after insert or update or delete on public.program_requirements
  for each row execute function private.kb_revision_trigger('program_requirement');
create trigger program_deadlines_revisions after insert or update or delete on public.program_deadlines
  for each row execute function private.kb_revision_trigger('program_deadline');

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.edit_proposals enable row level security;
alter table public.kb_revisions enable row level security;

create policy "edit_proposals_select_own_or_admin" on public.edit_proposals for select to authenticated
  using (proposed_by = (select auth.uid()) or (select private.is_admin()));

create policy "edit_proposals_insert_self" on public.edit_proposals for insert to authenticated
  with check (proposed_by = (select auth.uid()) and status = 'pending');

-- Proposers may only withdraw their own pending proposals.
create policy "edit_proposals_withdraw_own" on public.edit_proposals for update to authenticated
  using (proposed_by = (select auth.uid()) and status = 'pending')
  with check (proposed_by = (select auth.uid()) and status = 'withdrawn');

create policy "kb_revisions_select_all" on public.kb_revisions for select to anon, authenticated
  using (true);

revoke all on public.edit_proposals from anon;
revoke insert, update, delete on public.edit_proposals from authenticated;
grant insert (entity_type, entity_id, action, payload, message) on public.edit_proposals to authenticated;
grant update (status) on public.edit_proposals to authenticated;

revoke insert, update, delete on public.kb_revisions from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Admin RPCs
-- -----------------------------------------------------------------------------
create or replace function public.approve_edit_proposal(p_proposal_id uuid, p_review_note text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v    public.edit_proposals;
  v_id uuid;
begin
  if not private.is_admin() then
    raise exception 'not_authorized' using hint = 'Only administrators can review proposals.';
  end if;

  select * into v from public.edit_proposals where id = p_proposal_id for update;
  if not found then
    raise exception 'not_found' using hint = 'Proposal not found.';
  end if;
  if v.status <> 'pending' then
    raise exception 'not_pending' using hint = 'This proposal was already reviewed or withdrawn.';
  end if;

  perform set_config('applyhub.proposal_id', v.id::text, true);
  v_id := private.apply_kb_change(v.entity_type, v.action, v.entity_id, v.payload, v.proposed_by);
  perform set_config('applyhub.proposal_id', '', true);

  update public.edit_proposals
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = nullif(btrim(p_review_note), ''),
      result_entity_id = v_id
  where id = v.id;

  return v_id;
end;
$$;

create or replace function public.reject_edit_proposal(p_proposal_id uuid, p_review_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_authorized' using hint = 'Only administrators can review proposals.';
  end if;

  update public.edit_proposals
  set status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = nullif(btrim(p_review_note), '')
  where id = p_proposal_id and status = 'pending';

  if not found then
    raise exception 'not_pending' using hint = 'This proposal does not exist or was already reviewed.';
  end if;
end;
$$;

revoke execute on function public.approve_edit_proposal(uuid, text) from public, anon;
revoke execute on function public.reject_edit_proposal(uuid, text) from public, anon;
grant execute on function public.approve_edit_proposal(uuid, text) to authenticated;
grant execute on function public.reject_edit_proposal(uuid, text) to authenticated;
