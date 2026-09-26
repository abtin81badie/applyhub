-- Rooms: membership, invites, roles, sharing, content, activity, storage.
begin;

select tests.create_user('olivia');  -- owner
select tests.create_user('eddie');   -- editor
select tests.create_user('vera');    -- viewer
select tests.create_user('oscar');   -- outsider

-- ---------------------------------------------------------------- creation --
select tests.login('olivia');
select tests.set('room', public.create_room('Germany MSc 2027', 'Our group', 'DE', 'winter', 2027)::text);
select tests.eq(tests.value($$ select role::text from public.room_members
                              where room_id = tests.get('room')::uuid and user_id = tests.uid('olivia') $$),
                'owner', 'create_room makes the creator an owner');
select tests.throws($$ insert into public.rooms (name) values ('sneaky') $$, 'permission denied',
                    'rooms cannot be inserted directly (only via create_room)');
select tests.throws($$ insert into public.room_members (room_id, user_id, role)
                       values (tests.get('room')::uuid, tests.uid('oscar'), 'owner') $$,
                    'permission denied', 'memberships cannot be inserted directly');

-- ----------------------------------------------------------------- invites --
select tests.set('editor_code', (select code from public.regenerate_room_invite(tests.get('room')::uuid, 'editor', null, null)));
select tests.ok(tests.get('editor_code') ~ '^[0-9A-HJKMNP-TV-Z]{12}$', 'invite codes are 12 Crockford base32 chars');
select tests.set('viewer_code', (select code from public.room_invites
                                  where room_id = tests.get('room')::uuid and revoked_at is null));
-- regenerate revoked the previous link; create a separate viewer link directly
select tests.lives($$ insert into public.room_invites (room_id, role, max_uses)
                      values (tests.get('room')::uuid, 'viewer', 1) $$, 'owners can create invite links');
select tests.set('viewer_code', (select code from public.room_invites
                                  where room_id = tests.get('room')::uuid and role = 'viewer'));
select tests.throws($$ insert into public.room_invites (room_id, role) values (tests.get('room')::uuid, 'owner') $$,
                    'check constraint', 'invites cannot grant the owner role');

select tests.login('eddie');
select tests.eq(tests.count($$ select * from public.rooms $$), 0::bigint, 'non-members cannot see the room');
select tests.eq((select is_valid from public.get_invite_preview(tests.get('editor_code'))), true,
                'invite preview reports a valid code');
select tests.eq((select room_name from public.get_invite_preview(lower(tests.get('editor_code')))), 'Germany MSc 2027',
                'invite codes are case-insensitive and reveal the room name');
select tests.eq(public.join_room(tests.get('editor_code')), tests.get('room')::uuid, 'eddie joins with the editor link');
select tests.eq(tests.count($$ select * from public.rooms $$), 1::bigint, 'members can see the room');
select tests.throws($$ insert into public.room_invites (room_id, role) values (tests.get('room')::uuid, 'viewer') $$,
                    'row-level security', 'editors cannot create invites');
select tests.eq(tests.count($$ select * from public.room_invites $$), 0::bigint, 'editors cannot read invite codes');
select tests.eq(tests.count($$ select * from public.profiles $$), 2::bigint,
                'members can see profiles of people in their rooms');

select tests.login('vera');
select tests.eq(public.join_room(tests.get('viewer_code')), tests.get('room')::uuid, 'vera joins with the viewer link');

select tests.login('oscar');
select tests.throws($$ select public.join_room(tests.get('viewer_code')) $$, 'invite_invalid',
                    'a link with max_uses = 1 cannot be used twice');
select tests.throws($$ select public.join_room('ZZZZZZZZZZZZ') $$, 'invite_invalid', 'unknown codes are rejected');
select tests.eq((select is_valid from public.get_invite_preview(tests.get('viewer_code'))), false,
                'preview marks used-up links as invalid');
select tests.eq((select room_name from public.get_invite_preview(tests.get('viewer_code'))), null::text,
                'preview hides room details for invalid links');

select tests.login_anon();
select tests.eq((select room_name from public.get_invite_preview(tests.get('editor_code'))), 'Germany MSc 2027',
                'anonymous visitors can preview a valid invite');
select tests.throws($$ select public.join_room(tests.get('editor_code')) $$, 'permission denied',
                    'anonymous visitors cannot join rooms');

-- expired and revoked links
select tests.logout();
insert into public.room_invites (room_id, role, expires_at) values (tests.get('room')::uuid, 'viewer', now() - interval '1 minute');
select tests.set('expired_code', (select code from public.room_invites where expires_at < now() limit 1));
select tests.login('oscar');
select tests.throws($$ select public.join_room(tests.get('expired_code')) $$, 'invite_invalid', 'expired links are rejected');

-- invite rate limit: 10 per user per hour
select tests.login('olivia');
select tests.throws($$ insert into public.room_invites (room_id, role)
                       select tests.get('room')::uuid, 'viewer' from generate_series(1, 12) $$,
                    'rate_limited', 'invite creation is rate limited');

-- ----------------------------------------------------------------- sharing --
select tests.login('eddie');
with x as (
  insert into public.applications (university_name, program_name, status, notes, decision_notes)
  values ('TU Example', 'MSc Informatics', 'preparing', 'my secret notes', 'fingers crossed')
  returning id)
select tests.set('eddie_app', id::text) from x;
select tests.lives($$ select public.set_application_sharing(tests.get('eddie_app')::uuid, array[tests.get('room')::uuid]) $$,
                   'editors can share their application into the room');
select tests.eq(tests.value($$ select visibility::text from public.applications where id = tests.get('eddie_app')::uuid $$),
                'shared', 'sharing switches visibility to shared');

select tests.login('vera');
select tests.eq(tests.count($$ select * from public.get_room_applications(tests.get('room')::uuid) $$), 1::bigint,
                'viewers see shared applications through the room RPC');
select tests.eq(tests.count($$ select * from public.applications $$), 0::bigint,
                'room members cannot read the applications table directly');
select tests.eq(tests.value($$ select (public.get_shared_application(tests.get('room')::uuid, tests.get('eddie_app')::uuid)
                                -> 'application') ? 'notes' $$)::boolean,
                false, 'private notes are never exposed to the room');
select tests.eq(tests.value($$ select public.get_shared_application(tests.get('room')::uuid, tests.get('eddie_app')::uuid)
                                -> 'application' ->> 'decision_notes' $$),
                'fingers crossed', 'decision notes are shared');
with x as (
  insert into public.applications (university_name) values ('Vera Uni') returning id)
select tests.set('vera_app', id::text) from x;
select tests.throws($$ select public.set_application_sharing(tests.get('vera_app')::uuid, array[tests.get('room')::uuid]) $$,
                    'row-level security', 'viewers cannot share applications into the room');
select tests.throws($$ select public.set_application_sharing(tests.get('eddie_app')::uuid, array[]::uuid[]) $$,
                    'not_found', 'members cannot change sharing of someone else''s application');

select tests.login('oscar');
select tests.eq(tests.count($$ select * from public.get_room_applications(tests.get('room')::uuid) $$), 0::bigint,
                'outsiders get nothing from the room RPC');
select tests.eq(public.get_shared_application(tests.get('room')::uuid, tests.get('eddie_app')::uuid), null::jsonb,
                'outsiders cannot read a shared application');

-- ----------------------------------------------------------------- content --
select tests.login('eddie');
with x as (
  insert into public.notes (room_id, title, body_md) values (tests.get('room')::uuid, 'Tips', '# Hello')
  returning id)
select tests.set('note', id::text) from x;
with x as (
  insert into public.room_targets (room_id, title) values (tests.get('room')::uuid, 'TU Example — MSc')
  returning id)
select tests.set('target', id::text) from x;
select tests.lives($$ select public.set_target_interest(tests.get('target')::uuid, 'applying') $$,
                   'editors can mark interest');
select tests.lives($$ select public.set_target_interest(tests.get('target')::uuid, 'interested') $$,
                   'interest can be changed');
select tests.eq(tests.count($$ select * from public.room_target_votes $$), 1::bigint, 'one vote row per member');
select tests.lives($$ insert into public.comments (room_id, application_id, body)
                      values (tests.get('room')::uuid, tests.get('eddie_app')::uuid, 'Good luck!') $$,
                   'editors can comment on shared applications');
select tests.lives($$ insert into public.comments (room_id, note_id, body)
                      values (tests.get('room')::uuid, tests.get('note')::uuid, 'Thanks') $$,
                   'editors can comment on notes');
select tests.throws($$ insert into public.comments (room_id, application_id, body)
                       values (tests.get('room')::uuid, tests.get('vera_app')::uuid, 'x') $$,
                    'invalid_target', 'comments must target an application shared in the room');
select tests.throws($$ insert into public.comments (room_id, note_id, target_id, body)
                       values (tests.get('room')::uuid, tests.get('note')::uuid, tests.get('target')::uuid, 'x') $$,
                    'check constraint', 'a comment has exactly one target');
select tests.throws($$ update public.notes set room_id = gen_random_uuid() $$, 'permission denied',
                    'notes cannot be moved to another room');

select tests.login('vera');
select tests.throws($$ insert into public.notes (room_id, title) values (tests.get('room')::uuid, 'nope') $$,
                    'row-level security', 'viewers cannot create notes');
select tests.eq(tests.affected($$ update public.notes set title = 'vandalized' $$), 0::bigint,
                'viewers cannot edit notes');
select tests.throws($$ insert into public.room_targets (room_id, title) values (tests.get('room')::uuid, 'nope') $$,
                    'row-level security', 'viewers cannot add targets');
select tests.throws($$ select public.set_target_interest(tests.get('target')::uuid, 'interested') $$,
                    'row-level security', 'viewers cannot vote');
select tests.throws($$ insert into public.comments (room_id, note_id, body) values (tests.get('room')::uuid, tests.get('note')::uuid, 'hi') $$,
                    'row-level security', 'viewers cannot comment');
select tests.eq(tests.count($$ select * from public.notes $$), 1::bigint, 'viewers can read notes');
select tests.eq(tests.count($$ select * from public.comments $$), 2::bigint, 'viewers can read comments');
select tests.throws($$ insert into public.activity_log (room_id, action) values (tests.get('room')::uuid, 'fake') $$,
                    'permission denied', 'clients cannot write to the activity log');
select tests.ok(tests.count($$ select * from public.activity_log where action = 'application.shared' $$) = 1,
                'sharing was logged in the activity feed');

select tests.login('oscar');
select tests.eq(tests.count($$ select * from public.notes $$), 0::bigint, 'outsiders cannot read notes');
select tests.eq(tests.count($$ select * from public.activity_log $$), 0::bigint, 'outsiders cannot read activity');
select tests.eq(tests.count($$ select * from public.room_members $$), 0::bigint, 'outsiders cannot list members');

-- ---------------------------------------------------------- status/unshare --
select tests.login('eddie');
update public.applications set status = 'submitted' where id = tests.get('eddie_app')::uuid;
select tests.eq(tests.count($$ select * from public.activity_log where action = 'application.status_changed' $$), 1::bigint,
                'status changes of shared applications appear in the feed');
update public.applications set visibility = 'private' where id = tests.get('eddie_app')::uuid;
select tests.eq(tests.count($$ select * from public.room_shared_applications $$), 0::bigint,
                'making an application private removes all room shares');
select tests.eq(tests.count($$ select * from public.activity_log where entity_type = 'application' $$), 0::bigint,
                'unsharing forgets the room history of that application');
select tests.eq(tests.count($$ select * from public.comments where application_id is not null $$), 0::bigint,
                'unsharing removes comments about that application');

-- ----------------------------------------------------------------- storage --
select tests.login('eddie');
select tests.lives(format($$ insert into storage.objects (bucket_id, name, owner_id) values ('room-files', '%s/abc-file.pdf', '%s') $$,
                          tests.get('room'), tests.uid('eddie')),
                   'editors can upload into the room folder');
select tests.throws($$ insert into storage.objects (bucket_id, name) values ('room-files', 'not-a-uuid/file.pdf') $$,
                    'row-level security', 'uploads outside a room folder are rejected');
select tests.lives(format($$ insert into public.attachments (room_id, storage_path, file_name, size_bytes) values ('%s', '%s/abc-file.pdf', 'file.pdf', 1234) $$,
                          tests.get('room'), tests.get('room')),
                   'editors can register the uploaded file');
select tests.throws(format($$ insert into public.attachments (room_id, storage_path, file_name, size_bytes) values ('%s', 'elsewhere/x.pdf', 'x.pdf', 1) $$,
                           tests.get('room')),
                    'check constraint', 'attachment paths must live in the room folder');
select tests.login('vera');
select tests.eq(tests.count($$ select * from storage.objects where bucket_id = 'room-files' $$), 1::bigint,
                'viewers can read room files (for signed URLs)');
select tests.throws(format($$ insert into storage.objects (bucket_id, name) values ('room-files', '%s/v.pdf') $$, tests.get('room')),
                    'row-level security', 'viewers cannot upload');
select tests.eq(tests.affected($$ delete from storage.objects $$), 0::bigint, 'viewers cannot delete files');
select tests.login('oscar');
select tests.eq(tests.count($$ select * from storage.objects where bucket_id = 'room-files' $$), 0::bigint,
                'outsiders cannot read room files');

-- ------------------------------------------------------- members/ownership --
select tests.login('eddie');
select tests.eq(tests.affected($$ update public.room_members set role = 'owner' where user_id = tests.uid('eddie') $$),
                0::bigint, 'editors cannot promote themselves');
select tests.eq(tests.affected($$ delete from public.room_members where user_id = tests.uid('vera') $$),
                0::bigint, 'editors cannot remove other members');

select tests.login('olivia');
select tests.throws($$ delete from public.room_members where user_id = tests.uid('olivia') $$,
                    'last_owner', 'the last owner cannot leave');
select tests.eq(tests.affected($$ delete from public.room_members where user_id = tests.uid('vera') $$),
                1::bigint, 'owners can remove members');
select tests.eq(tests.count($$ select * from public.activity_log where action = 'member.removed' $$), 1::bigint,
                'member removal is logged');
select tests.eq(tests.affected($$ update public.room_members set role = 'owner' where user_id = tests.uid('eddie') $$),
                1::bigint, 'owners can promote members');
select tests.eq(tests.affected($$ delete from public.room_members where user_id = tests.uid('olivia') $$),
                1::bigint, 'an owner can leave when another owner remains');

select tests.login('vera');
select tests.eq(tests.count($$ select * from public.rooms $$), 0::bigint, 'removed members lose access');

select tests.login('eddie');
select tests.eq(tests.affected($$ delete from public.rooms where id = tests.get('room')::uuid $$), 1::bigint,
                'owners can delete the room (cascades cleanly)');
select tests.logout();
select tests.eq((select count(*) from public.activity_log where room_id = tests.get('room')::uuid), 0::bigint,
                'room deletion removes its activity');
select tests.eq((select count(*) from public.applications where id = tests.get('eddie_app')::uuid), 1::bigint,
                'members keep their applications after the room is deleted');

rollback;
