-- Tracker: applications, requirements and deadlines are owner-only.
begin;

select tests.create_user('alice');
select tests.create_user('bob');

select tests.login('alice');
select tests.lives($$ insert into public.applications (id, university_name, program_name, country_code, status)
                      values ('11111111-1111-4111-8111-111111111111', 'Uni A', 'MSc CS', 'DE', 'planning') $$,
                   'alice can create an application (user_id defaults to her)');
select tests.eq(tests.value($$ select user_id::text from public.applications where id = '11111111-1111-4111-8111-111111111111' $$),
                tests.uid('alice')::text, 'user_id defaults to auth.uid()');
select tests.lives($$ insert into public.application_requirements (application_id, kind, label)
                      values ('11111111-1111-4111-8111-111111111111', 'sop', 'Statement of purpose') $$,
                   'alice can add a requirement');
select tests.lives($$ insert into public.deadlines (application_id, label, due_at)
                      values ('11111111-1111-4111-8111-111111111111', 'Round 1', now() + interval '10 days') $$,
                   'alice can add a deadline');
select tests.throws($$ insert into public.applications (university_name, user_id) values ('Uni X', tests.uid('bob')) $$,
                    'row-level security', 'alice cannot create an application owned by bob');
select tests.throws($$ update public.applications set user_id = tests.uid('bob') $$,
                    'permission denied', 'user_id is immutable (column grant)');
select tests.throws($$ insert into public.applications (university_name, portal_url) values ('Uni Y', 'javascript:alert(1)') $$,
                    'check constraint', 'portal_url must be http(s)');
select tests.throws($$ insert into public.applications (university_name, application_fee_currency) values ('Uni Y', 'euro') $$,
                    'check constraint', 'currency must be an ISO code');

-- Bob cannot see or touch Alice's data.
select tests.login('bob');
select tests.eq(tests.count($$ select * from public.applications $$), 0::bigint, 'bob sees no applications');
select tests.eq(tests.count($$ select * from public.application_requirements $$), 0::bigint, 'bob sees no requirements');
select tests.eq(tests.count($$ select * from public.deadlines $$), 0::bigint, 'bob sees no deadlines');
select tests.eq(tests.affected($$ update public.applications set status = 'rejected' $$), 0::bigint,
                'bob cannot update alice''s application');
select tests.eq(tests.affected($$ delete from public.applications $$), 0::bigint,
                'bob cannot delete alice''s application');
select tests.throws($$ insert into public.deadlines (application_id, due_at)
                       values ('11111111-1111-4111-8111-111111111111', now()) $$,
                    'row-level security', 'bob cannot add a deadline to alice''s application');
select tests.throws($$ insert into public.application_requirements (application_id, label)
                       values ('11111111-1111-4111-8111-111111111111', 'x') $$,
                    'row-level security', 'bob cannot add a requirement to alice''s application');

-- Anonymous visitors see nothing.
select tests.login_anon();
select tests.throws($$ select * from public.applications $$, 'permission denied',
                    'anonymous visitors cannot read applications');

-- Alice can move a requirement only between her own applications, and delete cascades.
select tests.login('alice');
select tests.throws($$ update public.application_requirements set application_id = gen_random_uuid() $$,
                    'permission denied', 'application_id of a requirement is immutable');
select tests.eq(tests.affected($$ delete from public.applications where id = '11111111-1111-4111-8111-111111111111' $$),
                1::bigint, 'alice can delete her application');
select tests.eq(tests.count($$ select * from public.deadlines $$), 0::bigint, 'deadlines cascade on delete');

rollback;
