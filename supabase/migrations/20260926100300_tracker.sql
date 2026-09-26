-- =============================================================================
-- ApplyHub · 3. Personal application tracker
-- applications, application_requirements, deadlines — owner-only tables.
-- Room members never read these tables directly; they use the room RPCs
-- defined in the rooms migration, which expose a fixed set of safe columns.
-- =============================================================================

create type public.application_status as enum (
  'researching', 'planning', 'preparing', 'submitted', 'interview',
  'admitted', 'rejected', 'waitlisted', 'withdrawn'
);

create type public.application_visibility as enum ('private', 'shared');

create table public.applications (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null default auth.uid()
                             references public.profiles (id) on delete cascade,
  country_code             text references public.countries (code)
                             on update cascade on delete set null,
  -- Optional links to the knowledge base (foreign keys added in the KB migration).
  university_id            uuid,
  program_id               uuid,
  university_name          text not null check (char_length(btrim(university_name)) between 1 and 200),
  program_name             text not null default '' check (char_length(program_name) <= 200),
  degree_level             public.degree_level,
  intake_term              public.intake_term,
  intake_year              smallint check (intake_year between 2000 and 2100),
  portal_url               text check (private.is_http_url(portal_url)),
  status                   public.application_status not null default 'researching',
  submitted_at             date,
  application_fee_amount   numeric(12, 2) check (application_fee_amount >= 0),
  application_fee_currency text check (private.is_currency(application_fee_currency)),
  tuition_amount           numeric(12, 2) check (tuition_amount >= 0),
  tuition_currency         text check (private.is_currency(tuition_currency)),
  tuition_period           public.tuition_period,
  funding_info             text check (char_length(funding_info) <= 4000),
  result_date              date,
  decision_notes           text check (char_length(decision_notes) <= 4000),
  notes                    text check (char_length(notes) <= 20000),
  visibility               public.application_visibility not null default 'private',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table public.applications is 'A user''s application to one program. Owner-only; shared views go through room RPCs.';
comment on column public.applications.notes is 'Private free-form notes. Never exposed to rooms.';
comment on column public.applications.visibility is 'private = hidden from all rooms (shares are removed); shared = visible in rooms listed in room_shared_applications.';

create index applications_user_status_idx on public.applications (user_id, status);
create index applications_country_idx on public.applications (country_code);
create index applications_university_idx on public.applications (university_id);
create index applications_program_idx on public.applications (program_id);

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
create table public.application_requirements (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  kind           public.requirement_kind not null default 'other',
  label          text not null check (char_length(btrim(label)) between 1 and 300),
  is_done        boolean not null default false,
  notes          text check (char_length(notes) <= 2000),
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index application_requirements_app_idx
  on public.application_requirements (application_id, sort_order);

create trigger application_requirements_set_updated_at
  before update on public.application_requirements
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Application deadlines (several rounds per application are allowed).
create table public.deadlines (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  label          text not null default '' check (char_length(label) <= 120),
  due_at         timestamptz not null,
  is_done        boolean not null default false,
  notes          text check (char_length(notes) <= 2000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.deadlines is 'Deadlines of a tracked application (one row per round). Stored in UTC.';

create index deadlines_app_idx on public.deadlines (application_id, due_at);
create index deadlines_due_idx on public.deadlines (due_at) where not is_done;

create trigger deadlines_set_updated_at
  before update on public.deadlines
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS: owner only
-- -----------------------------------------------------------------------------
alter table public.applications enable row level security;
alter table public.application_requirements enable row level security;
alter table public.deadlines enable row level security;

create policy "applications_select_own"
  on public.applications for select to authenticated
  using (user_id = (select auth.uid()));

create policy "applications_insert_own"
  on public.applications for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "applications_update_own"
  on public.applications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "applications_delete_own"
  on public.applications for delete to authenticated
  using (user_id = (select auth.uid()));

-- Child rows follow their parent application (RLS on applications applies
-- inside the EXISTS, so only the owner's applications are visible).
create policy "application_requirements_owner_all"
  on public.application_requirements for all to authenticated
  using (exists (select 1 from public.applications a
                 where a.id = application_id and a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.applications a
                      where a.id = application_id and a.user_id = (select auth.uid())));

create policy "deadlines_owner_all"
  on public.deadlines for all to authenticated
  using (exists (select 1 from public.applications a
                 where a.id = application_id and a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.applications a
                      where a.id = application_id and a.user_id = (select auth.uid())));

-- Column grants: ids, owners and parents are immutable from the API.
revoke all on public.applications, public.application_requirements, public.deadlines from anon;
revoke insert, update on public.applications, public.application_requirements, public.deadlines
  from authenticated;

grant insert (id, user_id, country_code, university_id, program_id, university_name, program_name,
              degree_level, intake_term, intake_year, portal_url, status, submitted_at,
              application_fee_amount, application_fee_currency, tuition_amount, tuition_currency,
              tuition_period, funding_info, result_date, decision_notes, notes, visibility)
  on public.applications to authenticated;
grant update (country_code, university_id, program_id, university_name, program_name,
              degree_level, intake_term, intake_year, portal_url, status, submitted_at,
              application_fee_amount, application_fee_currency, tuition_amount, tuition_currency,
              tuition_period, funding_info, result_date, decision_notes, notes, visibility)
  on public.applications to authenticated;

grant insert (id, application_id, kind, label, is_done, notes, sort_order)
  on public.application_requirements to authenticated;
grant update (kind, label, is_done, notes, sort_order)
  on public.application_requirements to authenticated;

grant insert (id, application_id, label, due_at, is_done, notes)
  on public.deadlines to authenticated;
grant update (label, due_at, is_done, notes)
  on public.deadlines to authenticated;
