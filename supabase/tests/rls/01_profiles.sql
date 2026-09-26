-- Profiles: sign-up trigger, self access, role escalation, visibility.
begin;

select tests.create_user('alice');
select tests.create_user('bob');
select tests.create_user('admin');
update public.profiles set role = 'admin' where id = tests.uid('admin');

select tests.eq((select display_name from public.profiles where id = tests.uid('alice')),
                'Alice', 'sign-up trigger creates a profile with the OAuth/metadata name');

-- Alice
select tests.login('alice');
select tests.eq(tests.count($$ select * from public.profiles $$), 1::bigint,
                'a user only sees their own profile when sharing no rooms');
select tests.eq(tests.affected($$ update public.profiles set field_of_study = 'CS' where id = tests.uid('alice') $$),
                1::bigint, 'a user can update their own profile');
select tests.eq(tests.affected($$ update public.profiles set field_of_study = 'hacked' where id = tests.uid('bob') $$),
                0::bigint, 'a user cannot update someone else''s profile');
select tests.throws($$ update public.profiles set role = 'admin' where id = tests.uid('alice') $$,
                    'permission denied', 'a user cannot change their own role');
select tests.throws($$ update public.profiles set avatar_url = 'javascript:alert(1)' where id = tests.uid('alice') $$,
                    'check constraint', 'avatar_url must be https');
select tests.throws($$ update public.profiles set target_countries = array['germany'] where id = tests.uid('alice') $$,
                    'check constraint', 'target_countries must be ISO codes');
select tests.lives($$ update public.profiles set target_countries = array['DE','CA'], target_degree = 'master',
                      target_intake_term = 'fall', target_intake_year = 2027, onboarded_at = now()
                      where id = tests.uid('alice') $$,
                   'onboarding fields can be saved');
select tests.throws($$ select public.set_user_role(tests.uid('alice'), 'admin') $$,
                    'not_authorized', 'non-admins cannot call set_user_role');
select tests.throws($$ insert into public.profiles (id, display_name) values (tests.uid('bob'), 'Mallory') $$,
                    'row-level security|duplicate key', 'a user cannot create a profile for someone else');
select tests.eq((select count(*) from public.get_profile_cards(array[tests.uid('bob')])), 1::bigint,
                'profile cards expose names for attribution');

-- Anonymous visitors
select tests.login_anon();
select tests.throws($$ select * from public.profiles $$, 'permission denied',
                    'anonymous visitors cannot read profiles');

-- Admin
select tests.login('admin');
select tests.eq(tests.count($$ select * from public.profiles $$), 3::bigint,
                'admins can read all profiles');
select tests.lives($$ select public.set_user_role(tests.uid('bob'), 'admin') $$, 'admins can promote users');
select tests.logout();
select tests.eq((select role::text from public.profiles where id = tests.uid('bob')), 'admin',
                'set_user_role changed the role');

rollback;
