-- Moderation: proposals, validation, approval, rejection, withdrawal, revisions.
begin;

select tests.create_user('admin');
select tests.create_user('alice');
select tests.create_user('bob');
update public.profiles set role = 'admin' where id = tests.uid('admin');

select tests.logout();
with u as (
  insert into public.universities (country_code, name_en, city, is_placeholder)
  values ('DE', 'Example Uni', 'Berlin', true) returning id)
select tests.set('uni', id::text) from u;

-- Alice proposes a new program.
select tests.login('alice');
with p as (
  insert into public.edit_proposals (entity_type, action, payload, message)
  values ('program', 'create',
          jsonb_build_object('university_id', tests.get('uni'), 'name_en', 'MSc Data Science',
                             'degree_level', 'master', 'field', 'Data Science', 'languages', jsonb_build_array('en'),
                             'source_url', 'https://example.org/p', 'last_verified_at', '2026-09-01'),
          'From the official page')
  returning id)
select tests.set('p_create', id::text) from p;
select tests.eq(tests.value($$ select status::text from public.edit_proposals where id = tests.get('p_create')::uuid $$),
                'pending', 'proposals start pending');
select tests.throws($$ insert into public.edit_proposals (entity_type, action, payload)
                       values ('program', 'create', '{"name_en":"x","degree_level":"master","university_id":"00000000-0000-4000-8000-000000000000","is_placeholder":true}') $$,
                    'invalid_payload', 'proposals are validated on submission (foreign keys)');
select tests.throws($$ insert into public.edit_proposals (entity_type, action, payload)
                       values ('university', 'create', '{"name_en":"No source","country_code":"DE"}') $$,
                    'invalid_payload', 'proposals must include a source for real facts');
select tests.throws($$ insert into public.edit_proposals (entity_type, action, payload)
                       values ('university', 'create', '{"name_en":"x","country_code":"DE","is_placeholder":true,"is_published":false}') $$,
                    'invalid_payload', 'proposals cannot set admin-only fields');
select tests.throws($$ insert into public.edit_proposals (entity_type, action, payload, status)
                       values ('university', 'update', '{}', 'approved') $$,
                    'permission denied', 'proposers cannot set the status');
select tests.throws($$ select public.approve_edit_proposal(tests.get('p_create')::uuid) $$,
                    'not_authorized', 'users cannot approve proposals');

-- Alice proposes an edit to the university; the base snapshot is taken server-side.
with p as (
  insert into public.edit_proposals (entity_type, entity_id, action, payload, message)
  values ('university', tests.get('uni')::uuid, 'update',
          '{"city":"Munich","is_placeholder":false,"source_url":"https://example.org/u","last_verified_at":"2026-09-01"}',
          'City fix')
  returning id)
select tests.set('p_update', id::text) from p;
select tests.eq(tests.value($$ select base_snapshot ->> 'city' from public.edit_proposals where id = tests.get('p_update')::uuid $$),
                'Berlin', 'base snapshot records the current values');

select tests.login('bob');
select tests.eq(tests.count($$ select * from public.edit_proposals $$), 0::bigint, 'users cannot see others'' proposals');
select tests.eq(tests.affected($$ update public.edit_proposals set status = 'withdrawn' $$), 0::bigint,
                'users cannot withdraw others'' proposals');

-- Admin reviews.
select tests.login('admin');
select tests.eq(tests.count($$ select * from public.edit_proposals where status = 'pending' $$), 2::bigint,
                'admins see the moderation queue');
select tests.set('new_prog', public.approve_edit_proposal(tests.get('p_create')::uuid, 'Thanks!')::text);
select tests.eq(tests.value($$ select name_en from public.programs where id = tests.get('new_prog')::uuid $$),
                'MSc Data Science', 'approving a create proposal inserts the row');
select tests.eq(tests.value($$ select created_by::text from public.programs where id = tests.get('new_prog')::uuid $$),
                tests.uid('alice')::text, 'the proposer is recorded as the creator');
select tests.lives($$ select public.approve_edit_proposal(tests.get('p_update')::uuid) $$, 'admins approve edits');
select tests.eq(tests.value($$ select city from public.universities where id = tests.get('uni')::uuid $$),
                'Munich', 'approving an update proposal changes the row');
select tests.throws($$ select public.approve_edit_proposal(tests.get('p_update')::uuid) $$,
                    'not_pending', 'a proposal cannot be approved twice');
select tests.eq(tests.value($$ select count(*)::text from public.kb_revisions
                               where entity_id = tests.get('uni')::uuid and action = 'update'
                                 and proposal_id = tests.get('p_update')::uuid $$),
                '1', 'approved changes are recorded in the revision history with their proposal');

-- Rejection and withdrawal.
select tests.login('alice');
with p as (
  insert into public.edit_proposals (entity_type, entity_id, action, message)
  values ('university', tests.get('uni')::uuid, 'delete', 'Duplicate') returning id)
select tests.set('p_delete', id::text) from p;
with p as (
  insert into public.edit_proposals (entity_type, entity_id, action, payload)
  values ('university', tests.get('uni')::uuid, 'update',
          '{"name_fa":"دانشگاه نمونه","source_url":"https://example.org/u","last_verified_at":"2026-09-01"}') returning id)
select tests.set('p_withdraw', id::text) from p;
select tests.eq(tests.affected($$ update public.edit_proposals set status = 'withdrawn' where id = tests.get('p_withdraw')::uuid $$),
                1::bigint, 'proposers can withdraw pending proposals');
select tests.throws($$ update public.edit_proposals set status = 'approved' where id = tests.get('p_delete')::uuid $$,
                    'row-level security', 'proposers cannot approve their own proposals');
select tests.login('admin');
select tests.lives($$ select public.reject_edit_proposal(tests.get('p_delete')::uuid, 'Not a duplicate') $$,
                   'admins reject proposals');
select tests.eq(tests.count($$ select * from public.universities where id = tests.get('uni')::uuid $$), 1::bigint,
                'a rejected delete proposal leaves the row');

-- Revision history is public; direct admin edits are recorded too.
update public.universities set website_url = 'https://example.org' where id = tests.get('uni')::uuid;
select tests.login_anon();
select tests.ok(tests.count($$ select * from public.kb_revisions where entity_id = tests.get('uni')::uuid $$) >= 3,
                'anyone can read the revision history (insert, proposal update, admin update)');
select tests.throws($$ insert into public.kb_revisions (entity_type, entity_id, action) values ('university', gen_random_uuid(), 'insert') $$,
                    'permission denied', 'nobody can forge revisions');

rollback;
