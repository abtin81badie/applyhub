-- =============================================================================
-- ApplyHub · 0. Foundation
-- Private schema for SECURITY DEFINER helpers, shared enums and triggers.
--
-- Conventions used by every migration:
--   * RLS is enabled on every table; policies are explicit per command.
--   * Functions that bypass RLS live in schema `private`, which PostgREST does
--     not expose, and always pin `search_path = ''`.
--   * Clients get column-level UPDATE (and sometimes INSERT) grants so that
--     ownership / foreign-key columns are immutable from the API.
--   * Errors meant for the UI are raised with a short machine-readable
--     message (e.g. 'rate_limited') and a human-readable HINT.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

comment on schema private is
  'ApplyHub internal helpers (SECURITY DEFINER). Not exposed through the Data API.';

-- -----------------------------------------------------------------------------
-- Enums shared by several features
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('user', 'admin');
create type public.degree_level as enum ('bachelor', 'master', 'phd', 'other');
create type public.intake_term as enum ('fall', 'winter', 'spring', 'summer');
create type public.tuition_period as enum ('year', 'semester', 'total');
create type public.requirement_kind as enum (
  'language_test', 'gpa', 'cv', 'sop', 'lor', 'portfolio', 'gre', 'gmat',
  'pre_evaluation', 'transcript', 'degree_certificate', 'passport',
  'research_proposal', 'writing_sample', 'interview', 'application_form',
  'fee_payment', 'other'
);

-- -----------------------------------------------------------------------------
-- Generic helpers
-- -----------------------------------------------------------------------------

-- Keeps updated_at current on every UPDATE.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Casts text to uuid, returning NULL instead of raising on malformed input
-- (used by storage policies that parse object paths).
create or replace function private.try_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_value::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

-- Validates an optional http(s) URL of reasonable length.
create or replace function private.is_http_url(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_value is null
      or (p_value ~* '^https?://[^\s/$.?#][^\s]*$' and char_length(p_value) <= 2048);
$$;

-- Validates an ISO 4217 currency code (or NULL).
create or replace function private.is_currency(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_value is null or p_value ~ '^[A-Z]{3}$';
$$;
