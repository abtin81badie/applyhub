-- Knowledge base: public read, admin-only writes, sourced facts, add_to_tracker.
begin;

select tests.create_user('admin');
select tests.create_user('alice');
update public.profiles set role = 'admin' where id = tests.uid('admin');

-- Admin publishes a university + program with sourced facts.
select tests.login('admin');
with u as (
  insert into public.universities (country_code, name_en, name_fa, city, source_url, last_verified_at)
  values ('DE', 'Test University', 'دانشگاه آزمایشی', 'Berlin', 'https://example.org/uni', current_date)
  returning id)
select tests.set('uni', id::text) from u;
with p as (
  insert into public.programs (university_id, name_en, degree_level, field, languages,
                               tuition_amount_min, tuition_currency, tuition_period,
                               source_url, last_verified_at)
  values (tests.get('uni')::uuid, 'MSc Testing', 'master', 'Computer Science', array['en','de'],
          1500, 'EUR', 'semester', 'https://example.org/prog', current_date)
  returning id)
select tests.set('prog', id::text) from p;
insert into public.program_requirements (program_id, kind, description, source_url, last_verified_at)
values (tests.get('prog')::uuid, 'language_test', 'IELTS 6.5', 'https://example.org/req', current_date);
insert into public.program_deadlines (program_id, round_label, deadline_at, source_url, last_verified_at)
values (tests.get('prog')::uuid, 'Main round', now() + interval '60 days', 'https://example.org/dl', current_date),
       (tests.get('prog')::uuid, 'Old round', now() - interval '60 days', 'https://example.org/dl', current_date);
select tests.throws($$ insert into public.universities (country_code, name_en) values ('DE', 'Unsourced U') $$,
                    'universities_sourced', 'real facts require source_url and last_verified_at');
select tests.lives($$ insert into public.universities (country_code, name_en, is_placeholder) values ('DE', 'Example U', true) $$,
                   'placeholders may omit the source');
select tests.throws($$ insert into public.program_deadlines (program_id, deadline_at) values (tests.get('prog')::uuid, now()) $$,
                    'program_deadlines_sourced', 'deadlines require a source');

-- Anonymous visitors can read published content.
select tests.login_anon();
select tests.ok(tests.count($$ select * from public.countries $$) > 30, 'anonymous visitors can list countries');
select tests.eq(tests.count($$ select * from public.universities where name_en = 'Test University' $$), 1::bigint,
                'anonymous visitors can read universities');
select tests.eq(tests.count($$ select * from public.program_requirements where program_id = tests.get('prog')::uuid $$), 1::bigint,
                'anonymous visitors can read requirements');
select tests.eq(tests.value($$ select min_yearly_tuition::text from public.university_directory where id = tests.get('uni')::uuid $$),
                '3000.00', 'directory view normalizes semester tuition to yearly');
select tests.eq(tests.value($$ select array_to_string(languages, ',') from public.university_directory where id = tests.get('uni')::uuid $$),
                'de,en', 'directory view aggregates languages');
select tests.throws($$ insert into public.universities (country_code, name_en, is_placeholder) values ('DE', 'x', true) $$,
                    'permission denied', 'anonymous visitors cannot write');

-- Regular users cannot write directly.
select tests.login('alice');
select tests.throws($$ insert into public.universities (country_code, name_en, is_placeholder) values ('DE', 'x', true) $$,
                    'row-level security', 'users cannot insert universities directly');
select tests.eq(tests.affected($$ update public.programs set name_en = 'hacked' $$), 0::bigint,
                'users cannot edit programs directly');
select tests.eq(tests.affected($$ delete from public.universities $$), 0::bigint,
                'users cannot delete universities');
select tests.eq(tests.affected($$ update public.countries set name_en = 'x' $$), 0::bigint,
                'users cannot edit countries');

-- Unpublished rows are hidden from non-admins.
select tests.logout();
update public.universities set is_published = false where id = tests.get('uni')::uuid;
select tests.login('alice');
select tests.eq(tests.count($$ select * from public.universities where id = tests.get('uni')::uuid $$), 0::bigint,
                'unpublished universities are hidden');
select tests.eq(tests.count($$ select * from public.programs where id = tests.get('prog')::uuid $$), 0::bigint,
                'programs of unpublished universities are hidden');
select tests.logout();
update public.universities set is_published = true where id = tests.get('uni')::uuid;

-- One-click add to tracker.
select tests.login('alice');
select tests.set('app', public.add_to_tracker(tests.get('prog')::uuid, null, 'fa')::text);
select tests.eq(tests.value($$ select university_name from public.applications where id = tests.get('app')::uuid $$),
                'دانشگاه آزمایشی', 'add_to_tracker uses the Persian name when requested');
select tests.eq(tests.value($$ select tuition_amount::text || ' ' || tuition_currency || ' ' || tuition_period
                               from public.applications where id = tests.get('app')::uuid $$),
                '1500.00 EUR semester', 'add_to_tracker copies tuition');
select tests.eq(tests.count($$ select * from public.application_requirements where application_id = tests.get('app')::uuid $$),
                1::bigint, 'add_to_tracker copies requirements');
select tests.eq(tests.count($$ select * from public.deadlines where application_id = tests.get('app')::uuid $$),
                1::bigint, 'add_to_tracker copies only upcoming deadlines');
select tests.lives($$ select public.add_to_tracker(null, tests.get('uni')::uuid) $$,
                   'add_to_tracker works with only a university');
select tests.throws($$ select public.add_to_tracker(null, null) $$, 'not_found', 'add_to_tracker needs a target');

rollback;
