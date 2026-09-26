-- The first account in a project becomes admin; later accounts do not.
begin;
set local applyhub.bootstrap_admin = 'on';
select tests.create_user('founder');
select tests.create_user('second');
select tests.eq((select role::text from public.profiles where id = tests.uid('founder')), 'admin',
                'the first account becomes admin');
select tests.eq((select role::text from public.profiles where id = tests.uid('second')), 'user',
                'later accounts are regular users');
rollback;
