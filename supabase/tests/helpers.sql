-- =============================================================================
-- Tiny SQL test harness used by supabase/tests/rls/*.sql
--
--   select tests.create_user('alice');          -- auth user + profile
--   select tests.login('alice');                -- act as alice (role authenticated)
--   select tests.login_anon();                  -- act as an anonymous visitor
--   select tests.logout();                      -- back to the superuser
--   select tests.eq(tests.count($$ ... $$), 1::bigint, 'description');
--   select tests.throws($$ ... $$, 'row-level security', 'description');
--
-- Every test file runs in a transaction that is rolled back at the end.
-- =============================================================================
create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

create table if not exists tests.users (
  name text primary key,
  id   uuid not null
);
grant select on tests.users to anon, authenticated;

create or replace function tests.create_user(p_name text)
returns uuid
language plpgsql security definer
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data)
  values (v_id, p_name || '@test.local', 'authenticated', 'authenticated',
          jsonb_build_object('full_name', initcap(p_name)));
  insert into tests.users (name, id) values (p_name, v_id)
  on conflict (name) do update set id = excluded.id;
  return v_id;
end;
$$;

create or replace function tests.uid(p_name text)
returns uuid
language sql stable security definer
as $$
  select id from tests.users where name = p_name;
$$;

create or replace function tests.login(p_name text)
returns void
language plpgsql
as $$
declare
  v_id uuid := tests.uid(p_name);
begin
  if v_id is null then
    raise exception 'tests.login: unknown user %', p_name;
  end if;
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function tests.login_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end;
$$;

create or replace function tests.logout()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function tests.ok(p_condition boolean, p_description text)
returns void
language plpgsql
as $$
begin
  if p_condition is not true then
    raise exception 'FAIL: %', p_description;
  end if;
  raise notice 'ok - %', p_description;
end;
$$;

create or replace function tests.eq(p_actual anyelement, p_expected anyelement, p_description text)
returns void
language plpgsql
as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL: % (expected %, got %)', p_description, p_expected, p_actual;
  end if;
  raise notice 'ok - %', p_description;
end;
$$;

-- Number of rows returned by a query (RLS of the current role applies).
create or replace function tests.count(p_sql text)
returns bigint
language plpgsql
as $$
declare
  n bigint;
begin
  execute format('select count(*) from (%s) as q', p_sql) into n;
  return n;
end;
$$;

-- Number of rows affected by an INSERT/UPDATE/DELETE (RLS silently filters).
create or replace function tests.affected(p_sql text)
returns bigint
language plpgsql
as $$
declare
  n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function tests.value(p_sql text)
returns text
language plpgsql
as $$
declare
  v text;
begin
  execute p_sql into v;
  return v;
end;
$$;

create or replace function tests.throws(p_sql text, p_pattern text, p_description text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception
    when others then
      if sqlerrm ~* p_pattern then
        raise notice 'ok - %', p_description;
        return;
      end if;
      raise exception 'FAIL: % (expected error matching "%", got: %)', p_description, p_pattern, sqlerrm;
  end;
  raise exception 'FAIL: % (expected error matching "%", but the statement succeeded)', p_description, p_pattern;
end;
$$;

create or replace function tests.lives(p_sql text, p_description text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception
    when others then
      raise exception 'FAIL: % (unexpected error: %)', p_description, sqlerrm;
  end;
  raise notice 'ok - %', p_description;
end;
$$;

-- Named values shared between statements of a test file.
create table if not exists tests.vars (
  name  text primary key,
  value text
);
grant select on tests.vars to anon, authenticated;

create or replace function tests.set(p_name text, p_value text)
returns text
language sql security definer
as $$
  insert into tests.vars (name, value) values (p_name, p_value)
  on conflict (name) do update set value = excluded.value
  returning value;
$$;

create or replace function tests.get(p_name text)
returns text
language sql stable security definer
as $$
  select value from tests.vars where name = p_name;
$$;
