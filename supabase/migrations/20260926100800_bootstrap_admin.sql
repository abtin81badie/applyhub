-- =============================================================================
-- ApplyHub · 8. Bootstrap the first administrator
--
-- The first account created in a fresh project becomes an admin
-- automatically, so the project owner can moderate right after signing up.
-- No credentials are stored anywhere: sign up in the app with your own e-mail.
-- Later admins are added by an admin (set_user_role) or with SQL:
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'you@example.com');
-- Set `alter database postgres set applyhub.bootstrap_admin = 'off'` to disable.
-- =============================================================================

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name   text;
  v_avatar text;
begin
  v_name := coalesce(
    nullif(btrim(meta ->> 'display_name'), ''),
    nullif(btrim(meta ->> 'full_name'), ''),
    nullif(btrim(meta ->> 'name'), ''),
    nullif(btrim(meta ->> 'user_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    ''
  );
  v_avatar := coalesce(meta ->> 'avatar_url', meta ->> 'picture');
  if v_avatar is not null
     and (v_avatar !~* '^https://[^\s]+$' or char_length(v_avatar) > 2048) then
    v_avatar := null;
  end if;

  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, left(v_name, 80), v_avatar)
  on conflict (id) do nothing;

  -- First account in the project becomes the administrator.
  if coalesce(current_setting('applyhub.bootstrap_admin', true), 'on') <> 'off'
     and not exists (select 1 from public.profiles where role = 'admin') then
    update public.profiles set role = 'admin' where id = new.id;
  end if;

  return new;
exception
  when others then
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end;
$$;

-- Projects that already have users but no admin: promote the oldest account.
update public.profiles
set role = 'admin'
where id = (select id from public.profiles order by created_at limit 1)
  and not exists (select 1 from public.profiles where role = 'admin')
  and coalesce(current_setting('applyhub.bootstrap_admin', true), 'on') <> 'off';
