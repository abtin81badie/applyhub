-- =============================================================================
-- ApplyHub · 5. Public knowledge base
--
-- country_guides (one row per guide section and language), country_links,
-- universities, programs, program_requirements, program_deadlines.
--
-- Every factual row carries source_url + last_verified_at. A CHECK constraint
-- forbids storing a real (non-placeholder) fact without both. The UI shows a
-- warning badge when last_verified_at is older than 6 months.
--
-- Anyone (including anonymous visitors) can read published rows. Only admins
-- write directly; everyone else goes through edit_proposals (moderation).
-- =============================================================================

create type public.guide_section as enum (
  'overview', 'application_process', 'timeline', 'required_documents',
  'language_requirements', 'tuition_scholarships', 'visa_process', 'cost_of_living'
);

create type public.applicant_group as enum ('all', 'domestic', 'eu_eea', 'international');

-- -----------------------------------------------------------------------------
create table public.country_guides (
  id               uuid primary key default gen_random_uuid(),
  country_code     text not null references public.countries (code) on update cascade on delete cascade,
  locale           text not null check (locale in ('fa', 'en')),
  section          public.guide_section not null,
  body_md          text not null default '' check (char_length(body_md) <= 50000),
  source_url       text check (private.is_http_url(source_url)),
  last_verified_at date,
  is_placeholder   boolean not null default false,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (country_code, locale, section),
  constraint country_guides_sourced
    check (is_placeholder or (source_url is not null and last_verified_at is not null))
);

create table public.country_links (
  id               uuid primary key default gen_random_uuid(),
  country_code     text not null references public.countries (code) on update cascade on delete cascade,
  label_en         text not null check (char_length(btrim(label_en)) between 1 and 200),
  label_fa         text check (char_length(label_fa) <= 200),
  url              text not null check (private.is_http_url(url)),
  category         text not null default 'other'
                     check (category in ('admissions', 'visa', 'scholarships', 'language',
                                         'recognition', 'living', 'other')),
  description      text not null default '' check (char_length(description) <= 1000),
  last_verified_at date,
  is_placeholder   boolean not null default false,
  sort_order       integer not null default 0,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint country_links_verified check (is_placeholder or last_verified_at is not null)
);

create index country_links_country_idx on public.country_links (country_code, sort_order);

create table public.universities (
  id               uuid primary key default gen_random_uuid(),
  country_code     text not null references public.countries (code) on update cascade,
  name_en          text not null check (char_length(btrim(name_en)) between 1 and 200),
  name_fa          text check (char_length(name_fa) <= 200),
  city             text check (char_length(city) <= 100),
  website_url      text check (private.is_http_url(website_url)),
  institution_type text check (institution_type in ('public', 'private')),
  description_md   text not null default '' check (char_length(description_md) <= 20000),
  source_url       text check (private.is_http_url(source_url)),
  last_verified_at date,
  is_placeholder   boolean not null default false,
  is_published     boolean not null default true,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint universities_sourced
    check (is_placeholder or (source_url is not null and last_verified_at is not null))
);

create index universities_country_idx on public.universities (country_code, name_en);
create index universities_city_idx on public.universities (country_code, city);

create table public.programs (
  id                       uuid primary key default gen_random_uuid(),
  university_id            uuid not null references public.universities (id) on delete cascade,
  name_en                  text not null check (char_length(btrim(name_en)) between 1 and 200),
  name_fa                  text check (char_length(name_fa) <= 200),
  degree_level             public.degree_level not null,
  field                    text not null default '' check (char_length(field) <= 120),
  languages                text[] not null default '{}'
                             check (cardinality(languages) <= 10
                                    and array_to_string(languages, ',') ~ '^([a-z]{2}(,[a-z]{2})*)?$'),
  duration_months          smallint check (duration_months between 1 and 120),
  tuition_amount_min       numeric(12, 2) check (tuition_amount_min >= 0),
  tuition_amount_max       numeric(12, 2) check (tuition_amount_max >= 0),
  tuition_currency         text check (private.is_currency(tuition_currency)),
  tuition_period           public.tuition_period,
  application_fee_amount   numeric(12, 2) check (application_fee_amount >= 0),
  application_fee_currency text check (private.is_currency(application_fee_currency)),
  website_url              text check (private.is_http_url(website_url)),
  description_md           text not null default '' check (char_length(description_md) <= 20000),
  source_url               text check (private.is_http_url(source_url)),
  last_verified_at         date,
  is_placeholder           boolean not null default false,
  is_published             boolean not null default true,
  created_by               uuid references public.profiles (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint programs_tuition_range
    check (tuition_amount_min is null or tuition_amount_max is null
           or tuition_amount_min <= tuition_amount_max),
  constraint programs_sourced
    check (is_placeholder or (source_url is not null and last_verified_at is not null))
);

create index programs_university_idx on public.programs (university_id);
create index programs_degree_field_idx on public.programs (degree_level, field);

create table public.program_requirements (
  id               uuid primary key default gen_random_uuid(),
  program_id       uuid not null references public.programs (id) on delete cascade,
  kind             public.requirement_kind not null default 'other',
  description      text not null check (char_length(btrim(description)) between 1 and 500),
  is_mandatory     boolean not null default true,
  source_url       text check (private.is_http_url(source_url)),
  last_verified_at date,
  is_placeholder   boolean not null default false,
  sort_order       integer not null default 0,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint program_requirements_sourced
    check (is_placeholder or (source_url is not null and last_verified_at is not null))
);

create index program_requirements_program_idx on public.program_requirements (program_id, sort_order);

create table public.program_deadlines (
  id               uuid primary key default gen_random_uuid(),
  program_id       uuid not null references public.programs (id) on delete cascade,
  intake_term      public.intake_term,
  intake_year      smallint check (intake_year between 2000 and 2100),
  round_label      text not null default '' check (char_length(round_label) <= 120),
  applicant_group  public.applicant_group not null default 'all',
  opens_at         timestamptz,
  deadline_at      timestamptz not null,
  notes            text not null default '' check (char_length(notes) <= 2000),
  source_url       text check (private.is_http_url(source_url)),
  last_verified_at date,
  is_placeholder   boolean not null default false,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint program_deadlines_order check (opens_at is null or opens_at <= deadline_at),
  constraint program_deadlines_sourced
    check (is_placeholder or (source_url is not null and last_verified_at is not null))
);

create index program_deadlines_program_idx on public.program_deadlines (program_id, deadline_at);

create trigger country_guides_set_updated_at before update on public.country_guides
  for each row execute function private.set_updated_at();
create trigger country_links_set_updated_at before update on public.country_links
  for each row execute function private.set_updated_at();
create trigger universities_set_updated_at before update on public.universities
  for each row execute function private.set_updated_at();
create trigger programs_set_updated_at before update on public.programs
  for each row execute function private.set_updated_at();
create trigger program_requirements_set_updated_at before update on public.program_requirements
  for each row execute function private.set_updated_at();
create trigger program_deadlines_set_updated_at before update on public.program_deadlines
  for each row execute function private.set_updated_at();

-- Links from the tracker and room target lists into the knowledge base.
alter table public.applications
  add constraint applications_university_id_fkey
    foreign key (university_id) references public.universities (id) on delete set null,
  add constraint applications_program_id_fkey
    foreign key (program_id) references public.programs (id) on delete set null;

alter table public.room_targets
  add constraint room_targets_university_id_fkey
    foreign key (university_id) references public.universities (id) on delete set null,
  add constraint room_targets_program_id_fkey
    foreign key (program_id) references public.programs (id) on delete set null;

create index room_targets_university_idx on public.room_targets (university_id);
create index room_targets_program_idx on public.room_targets (program_id);

-- -----------------------------------------------------------------------------
-- Directory view used by the country page filters (city, field, language,
-- tuition range). security_invoker => RLS of the underlying tables applies.
-- Tuition is normalized to an approximate yearly amount for filtering.
-- -----------------------------------------------------------------------------
create view public.university_directory
with (security_invoker = true)
as
select
  u.id,
  u.country_code,
  u.name_en,
  u.name_fa,
  u.city,
  u.website_url,
  u.institution_type,
  u.source_url,
  u.last_verified_at,
  u.is_placeholder,
  u.updated_at,
  coalesce(agg.program_count, 0)::int as program_count,
  coalesce(agg.fields, '{}'::text[]) as fields,
  coalesce(agg.languages, '{}'::text[]) as languages,
  coalesce(agg.degree_levels, '{}'::public.degree_level[]) as degree_levels,
  agg.min_yearly_tuition,
  agg.max_yearly_tuition,
  agg.tuition_currency,
  lower(concat_ws(' ', u.name_en, u.name_fa, u.city, array_to_string(agg.fields, ' '))) as search_text
from public.universities u
left join lateral (
  select
    count(*) as program_count,
    array_agg(distinct p.field order by p.field) filter (where p.field <> '') as fields,
    (select array_agg(distinct l order by l)
       from public.programs p2, unnest(p2.languages) as l
      where p2.university_id = u.id and p2.is_published) as languages,
    array_agg(distinct p.degree_level) as degree_levels,
    min(case p.tuition_period
          when 'semester' then p.tuition_amount_min * 2
          when 'total' then case when coalesce(p.duration_months, 0) > 0
                                 then round(p.tuition_amount_min * 12 / p.duration_months, 2)
                                 else p.tuition_amount_min end
          else p.tuition_amount_min end) as min_yearly_tuition,
    max(case p.tuition_period
          when 'semester' then coalesce(p.tuition_amount_max, p.tuition_amount_min) * 2
          when 'total' then case when coalesce(p.duration_months, 0) > 0
                                 then round(coalesce(p.tuition_amount_max, p.tuition_amount_min) * 12 / p.duration_months, 2)
                                 else coalesce(p.tuition_amount_max, p.tuition_amount_min) end
          else coalesce(p.tuition_amount_max, p.tuition_amount_min) end) as max_yearly_tuition,
    (array_agg(p.tuition_currency) filter (where p.tuition_currency is not null))[1] as tuition_currency
  from public.programs p
  where p.university_id = u.id and p.is_published
) agg on true;

comment on view public.university_directory is
  'Universities with aggregated program facets for filtering. Tuition normalized to ~per-year.';

-- -----------------------------------------------------------------------------
-- RLS: public read of published content, admin-only writes.
-- -----------------------------------------------------------------------------
alter table public.country_guides enable row level security;
alter table public.country_links enable row level security;
alter table public.universities enable row level security;
alter table public.programs enable row level security;
alter table public.program_requirements enable row level security;
alter table public.program_deadlines enable row level security;

create policy "country_guides_select_all" on public.country_guides for select to anon, authenticated
  using (true);
create policy "country_links_select_all" on public.country_links for select to anon, authenticated
  using (true);
create policy "universities_select_published" on public.universities for select to anon, authenticated
  using (is_published or (select private.is_admin()));
create policy "programs_select_published" on public.programs for select to anon, authenticated
  using (
    (is_published and exists (select 1 from public.universities u where u.id = university_id))
    or (select private.is_admin())
  );
create policy "program_requirements_select_visible" on public.program_requirements for select to anon, authenticated
  using (exists (select 1 from public.programs p where p.id = program_id));
create policy "program_deadlines_select_visible" on public.program_deadlines for select to anon, authenticated
  using (exists (select 1 from public.programs p where p.id = program_id));

do $$
declare
  t text;
begin
  foreach t in array array['country_guides', 'country_links', 'universities', 'programs',
                           'program_requirements', 'program_deadlines'] loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.is_admin()))',
      t || '_admin_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',
      t || '_admin_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select private.is_admin()))',
      t || '_admin_delete', t);
    execute format('revoke insert, update, delete on public.%I from anon', t);
  end loop;
end;
$$;

grant select on public.university_directory to anon, authenticated;

-- -----------------------------------------------------------------------------
-- RPC: one-click "add to tracker" from a program (or a university).
-- SECURITY INVOKER: reads public KB rows and writes the caller's own rows.
-- -----------------------------------------------------------------------------
create or replace function public.add_to_tracker(
  p_program_id uuid default null,
  p_university_id uuid default null,
  p_locale text default 'en'
)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_prog    public.programs;
  v_uni     public.universities;
  v_app     uuid;
  v_notes   text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if p_program_id is not null then
    select * into v_prog from public.programs where id = p_program_id;
    if not found then
      raise exception 'not_found' using hint = 'Program not found.';
    end if;
    select * into v_uni from public.universities where id = v_prog.university_id;
  elsif p_university_id is not null then
    select * into v_uni from public.universities where id = p_university_id;
  end if;
  if v_uni.id is null then
    raise exception 'not_found' using hint = 'University not found.';
  end if;

  v_notes := concat_ws(E'\n',
    case when coalesce(v_prog.is_placeholder, false) or v_uni.is_placeholder
         then '⚠️ Imported from placeholder example data — replace with real, verified information.' end,
    'Imported from the ApplyHub knowledge base. Always verify details on the official source:',
    coalesce(v_prog.source_url, v_prog.website_url, v_uni.source_url, v_uni.website_url));

  insert into public.applications (
    user_id, country_code, university_id, university_name, program_id, program_name,
    degree_level, portal_url, application_fee_amount, application_fee_currency,
    tuition_amount, tuition_currency, tuition_period, notes)
  values (
    v_uid, v_uni.country_code, v_uni.id,
    case when p_locale = 'fa' then coalesce(nullif(v_uni.name_fa, ''), v_uni.name_en) else v_uni.name_en end,
    v_prog.id,
    coalesce(case when p_locale = 'fa' then coalesce(nullif(v_prog.name_fa, ''), v_prog.name_en)
                  else v_prog.name_en end, ''),
    v_prog.degree_level, coalesce(v_prog.website_url, v_uni.website_url),
    v_prog.application_fee_amount, v_prog.application_fee_currency,
    v_prog.tuition_amount_min, v_prog.tuition_currency, v_prog.tuition_period, v_notes)
  returning id into v_app;

  if v_prog.id is not null then
    insert into public.application_requirements (application_id, kind, label, sort_order)
    select v_app, r.kind, left(r.description, 300), row_number() over (order by r.sort_order, r.created_at)
    from public.program_requirements r
    where r.program_id = v_prog.id;

    insert into public.deadlines (application_id, label, due_at, notes)
    select v_app,
           left(concat_ws(' · ', nullif(d.round_label, ''),
                          case when d.applicant_group <> 'all' then d.applicant_group::text end), 120),
           d.deadline_at,
           left(concat_ws(E'\n', nullif(d.notes, ''), 'Source: ' || d.source_url), 2000)
    from public.program_deadlines d
    where d.program_id = v_prog.id and d.deadline_at >= now();
  end if;

  return v_app;
end;
$$;

revoke execute on function public.add_to_tracker(uuid, uuid, text) from public, anon;
grant execute on function public.add_to_tracker(uuid, uuid, text) to authenticated;
