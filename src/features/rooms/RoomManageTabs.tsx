import {
  Copy,
  Download,
  FileUp,
  LogOut,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserMinus,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ROOM_ROLES, type RoomRole } from '@/lib/domain';
import { describeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { formatBytes } from '@/lib/utils';
import { useAuth } from '@/providers/AuthProvider';
import { useConfirm } from '@/providers/ConfirmProvider';
import { useFormat, usePreferences } from '@/providers/PreferencesProvider';
import { useToast } from '@/providers/ToastProvider';
import {
  BUCKET,
  MAX_FILE_BYTES,
  inviteLink,
  signedFileUrl,
  useAttachments,
  useInvites,
  useRoomMembers,
  useRoomMutation,
  type Room,
} from './api';
import { useRoomActivity } from './activity';
import { ActivityItem } from './ActivityItem';
import type { TabProps } from './RoomContentTabs';

const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

function useErrorToast() {
  const { t } = useTranslation();
  const toast = useToast();
  return (e: unknown) => toast.error(describeError(e, t));
}

// -------------------------------------------------------------------- files --
export function FilesTab({ roomId, canWrite, isOwner }: TabProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { locale } = usePreferences();
  const fmt = useFormat();
  const toast = useToast();
  const onError = useErrorToast();
  const { data, isPending } = useAttachments(roomId);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [ack, setAck] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useRoomMutation(roomId, async () => {
    if (!file) return;
    const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(-120);
    const path = `${roomId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const { error } = await supabase.from('attachments').insert({
      room_id: roomId,
      storage_path: path,
      file_name: file.name.slice(0, 255),
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
      description: description.trim(),
    });
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw error;
    }
  });
  const remove = useRoomMutation(roomId, async (a: { id: string; storage_path: string }) => {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([a.storage_path]);
    if (storageError) throw storageError;
    const { error } = await supabase.from('attachments').delete().eq('id', a.id);
    if (error) throw error;
  });
  const confirm = useConfirm();

  const choose = (f: File | null) => {
    if (f && f.size > MAX_FILE_BYTES) return toast.error(t('rooms.files.tooLarge'));
    if (f && !ALLOWED_TYPES.includes(f.type)) return toast.error(t('rooms.files.badType'));
    setFile(f);
  };

  return (
    <div className="flex flex-col gap-4">
      <Alert tone="warning" title={t('rooms.files.privacyWarningTitle')}>
        {t('rooms.files.privacyWarning')}
      </Alert>
      {canWrite && (
        <Card>
          <CardBody className="flex flex-col gap-3">
            <input
              ref={inputRef}
              type="file"
              className="text-sm file:me-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm"
              accept={ALLOWED_TYPES.join(',')}
              onChange={(e) => choose(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted">{t('rooms.files.maxSize')}</p>
            <Field label={t('rooms.files.descriptionLabel')} htmlFor="file-desc">
              <Input
                id="file-desc"
                dir="auto"
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <Checkbox
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              label={t('rooms.files.acknowledge')}
            />
            <Button
              className="self-start"
              disabled={!file || !ack}
              loading={upload.isPending}
              onClick={() =>
                upload.mutate(undefined, {
                  onSuccess: () => {
                    toast.success(t('rooms.files.uploaded'));
                    setFile(null);
                    setDescription('');
                    setAck(false);
                    if (inputRef.current) inputRef.current.value = '';
                  },
                  onError,
                })
              }
            >
              <FileUp className="size-4" aria-hidden />
              {t('rooms.files.upload')}
            </Button>
          </CardBody>
        </Card>
      )}
      {isPending ? (
        <Skeleton className="h-24" />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={FileUp} title={t('rooms.files.empty')} />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {(data ?? []).map((a) => (
              <li key={a.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" dir="auto">
                    {a.file_name}
                  </p>
                  <p className="truncate text-xs text-muted" dir="auto">
                    {[
                      formatBytes(a.size_bytes, locale === 'fa' ? 'fa-IR' : 'en'),
                      fmt.relative(a.created_at),
                      a.description,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('common.download')}
                  title={t('rooms.files.linkExpires')}
                  onClick={() => {
                    signedFileUrl(a.storage_path)
                      .then((url) => window.open(url, '_blank', 'noopener'))
                      .catch(onError);
                  }}
                >
                  <Download className="size-4" />
                </Button>
                {(a.uploaded_by === user?.id || isOwner) && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('common.delete')}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: t('rooms.files.deleteConfirm'),
                          confirmLabel: t('common.delete'),
                        })
                      ) {
                        remove.mutate(a, { onError });
                      }
                    }}
                  >
                    <Trash2 className="size-4 text-danger" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- activity --
export function ActivityTab({
  roomId,
  live,
}: {
  roomId: string;
  live: 'connecting' | 'live' | 'offline';
}) {
  const { t } = useTranslation();
  const { data, isPending } = useRoomActivity(roomId);
  return (
    <Card>
      <CardHeader
        title={t('rooms.activity.title')}
        actions={
          <Badge tone={live === 'live' ? 'success' : live === 'offline' ? 'warning' : 'neutral'}>
            {live === 'live'
              ? `● ${t('rooms.activity.live')}`
              : live === 'offline'
                ? t('rooms.activity.offline')
                : t('rooms.activity.connecting')}
          </Badge>
        }
      />
      <CardBody>
        {isPending ? (
          <Skeleton className="h-32" />
        ) : (data ?? []).length === 0 ? (
          <p className="text-sm text-muted">{t('rooms.activity.empty')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {(data ?? []).map((row) => (
              <ActivityItem key={row.id} row={row} />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

// ------------------------------------------------------------------ members --
function InvitesCard({ roomId }: { roomId: string }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const toast = useToast();
  const onError = useErrorToast();
  const { data: invites = [] } = useInvites(roomId, true);
  const [role, setRole] = useState<RoomRole>('editor');
  const [hours, setHours] = useState('168');
  const [maxUses, setMaxUses] = useState('');

  const options = () => ({
    p_role: role,
    ...(hours
      ? { p_expires_at: new Date(Date.now() + Number(hours) * 3600_000).toISOString() }
      : {}),
    ...(maxUses ? { p_max_uses: Number(maxUses) } : {}),
  });
  const create = useRoomMutation(roomId, async () => {
    const o = options();
    const { error } = await supabase.from('room_invites').insert({
      room_id: roomId,
      role: o.p_role,
      expires_at: o.p_expires_at ?? null,
      max_uses: o.p_max_uses ?? null,
    });
    if (error) throw error;
  });
  const regenerate = useRoomMutation(roomId, async () => {
    const { error } = await supabase.rpc('regenerate_room_invite', {
      p_room_id: roomId,
      ...options(),
    });
    if (error) throw error;
  });
  const revoke = useRoomMutation(roomId, async (id: string) => {
    const { error } = await supabase
      .from('room_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  });
  const copy = (code: string) => {
    void navigator.clipboard
      .writeText(inviteLink(code))
      .then(() => toast.success(t('common.copied')));
  };

  return (
    <Card>
      <CardHeader title={t('rooms.invites.title')} description={t('rooms.invites.explain')} />
      <CardBody className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t('rooms.invites.role')} htmlFor="inv-role">
            <Select
              id="inv-role"
              value={role}
              onChange={(e) => setRole(e.target.value as RoomRole)}
            >
              <option value="editor">{t('enums.roomRole.editor')}</option>
              <option value="viewer">{t('enums.roomRole.viewer')}</option>
            </Select>
          </Field>
          <Field label={t('rooms.invites.expiresIn')} htmlFor="inv-exp">
            <Select id="inv-exp" value={hours} onChange={(e) => setHours(e.target.value)}>
              <option value="24">{t('rooms.invites.hours', { count: 24 })}</option>
              <option value="168">{t('rooms.invites.days', { count: 7 })}</option>
              <option value="720">{t('rooms.invites.days', { count: 30 })}</option>
              <option value="">{t('rooms.invites.never')}</option>
            </Select>
          </Field>
          <Field label={t('rooms.invites.maxUses')} htmlFor="inv-max">
            <Select id="inv-max" value={maxUses} onChange={(e) => setMaxUses(e.target.value)}>
              <option value="">{t('rooms.invites.unlimited')}</option>
              {[1, 5, 10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {fmt.number(n)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button loading={create.isPending} onClick={() => create.mutate(undefined, { onError })}>
            {t('rooms.invites.generate')}
          </Button>
          {invites.length > 0 && (
            <Button
              variant="outline"
              loading={regenerate.isPending}
              onClick={() =>
                regenerate.mutate(undefined, {
                  onSuccess: () => toast.success(t('rooms.invites.regenerated')),
                  onError,
                })
              }
            >
              <RefreshCw className="size-4" aria-hidden />
              {t('rooms.invites.regenerate')}
            </Button>
          )}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">{t('rooms.invites.activeInvites')}</p>
          {invites.length === 0 ? (
            <p className="text-sm text-muted">{t('rooms.invites.noInvites')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-sm"
                >
                  <code className="ltr-island rounded bg-surface-2 px-2 py-1 font-mono text-xs">
                    {inv.code}
                  </code>
                  <Badge>{t(`enums.roomRole.${inv.role}`)}</Badge>
                  <span className="text-xs text-muted">
                    {inv.max_uses
                      ? t('rooms.invites.uses', { used: inv.use_count, max: inv.max_uses })
                      : t('rooms.invites.usesUnlimited', { used: inv.use_count })}
                    {' · '}
                    {inv.expires_at
                      ? t('rooms.invites.expires', { date: fmt.dateTime(inv.expires_at) })
                      : t('rooms.invites.noExpiry')}
                  </span>
                  <span className="ms-auto flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => copy(inv.code)}>
                      <Copy className="size-3.5" aria-hidden />
                      {t('rooms.invites.copyLink')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      onClick={() => revoke.mutate(inv.id, { onError })}
                    >
                      {t('rooms.invites.revoke')}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function SettingsCard({ room }: { room: Room }) {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const onError = useErrorToast();
  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description);
  const save = useRoomMutation(room.id, async () => {
    const { error } = await supabase
      .from('rooms')
      .update({ name: name.trim(), description: description.trim() })
      .eq('id', room.id);
    if (error) throw error;
  });
  const destroy = useRoomMutation(room.id, async () => {
    const { data: files } = await supabase
      .from('attachments')
      .select('storage_path')
      .eq('room_id', room.id);
    if (files && files.length > 0)
      await supabase.storage.from(BUCKET).remove(files.map((f) => f.storage_path));
    const { error } = await supabase.from('rooms').delete().eq('id', room.id);
    if (error) throw error;
  });

  return (
    <Card>
      <CardHeader title={t('rooms.settings.title')} />
      <CardBody className="flex flex-col gap-4">
        <Field label={t('rooms.form.name')} htmlFor="rs-name">
          <Input
            id="rs-name"
            dir="auto"
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={t('rooms.form.description')} htmlFor="rs-desc">
          <Textarea
            id="rs-desc"
            dir="auto"
            rows={3}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Button
          className="self-start"
          disabled={!name.trim()}
          loading={save.isPending}
          onClick={() =>
            save.mutate(undefined, {
              onSuccess: () => toast.success(t('rooms.form.updated')),
              onError,
            })
          }
        >
          {t('common.save')}
        </Button>
        <div className="rounded-lg border border-danger/30 p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-danger">
            <ShieldAlert className="size-4" aria-hidden />
            {t('rooms.settings.dangerZone')}
          </p>
          <Button
            variant="danger"
            loading={destroy.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: t('rooms.settings.deleteRoom'),
                body: t('rooms.settings.deleteConfirm', { name: room.name }),
                typeToConfirm: room.name,
                typeToConfirmLabel: t('rooms.settings.typeName'),
                confirmLabel: t('common.delete'),
              });
              if (!ok) return;
              destroy.mutate(undefined, {
                onSuccess: () => {
                  toast.success(t('rooms.settings.deleted'));
                  navigate('/rooms', { replace: true });
                },
                onError,
              });
            }}
          >
            <Trash2 className="size-4" aria-hidden />
            {t('rooms.settings.deleteRoom')}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export function MembersTab({ room, isOwner }: { room: Room; isOwner: boolean }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const fmt = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const onError = useErrorToast();
  const { data: members = [], isPending } = useRoomMembers(room.id);
  const setRole = useRoomMutation(
    room.id,
    async ({ userId, role }: { userId: string; role: RoomRole }) => {
      const { error } = await supabase
        .from('room_members')
        .update({ role })
        .eq('room_id', room.id)
        .eq('user_id', userId);
      if (error) throw error;
    },
  );
  const removeMember = useRoomMutation(room.id, async (userId: string) => {
    const { error } = await supabase
      .from('room_members')
      .delete()
      .eq('room_id', room.id)
      .eq('user_id', userId);
    if (error) throw error;
  });

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader title={t('rooms.members.title')} />
        <CardBody>
          {isPending ? (
            <Skeleton className="h-24" />
          ) : (
            <ul className="divide-y divide-border">
              {members.map((m) => {
                const me = m.user_id === user?.id;
                return (
                  <li key={m.user_id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <Avatar
                      name={m.profile?.display_name}
                      url={m.profile?.avatar_url}
                      seed={m.user_id}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" dir="auto">
                        {m.profile?.display_name || t('common.someone')}{' '}
                        {me && `(${t('common.you')})`}
                      </p>
                      <p className="text-xs text-muted">
                        {t('rooms.members.joined', { date: fmt.date(m.joined_at) })}
                      </p>
                    </div>
                    {isOwner ? (
                      <Select
                        className="w-32"
                        aria-label={t('rooms.members.changeRole')}
                        value={m.role}
                        onChange={(e) =>
                          setRole.mutate(
                            { userId: m.user_id, role: e.target.value as RoomRole },
                            {
                              onSuccess: () => toast.success(t('rooms.members.roleUpdated')),
                              onError,
                            },
                          )
                        }
                      >
                        {ROOM_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {t(`enums.roomRole.${r}`)}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Badge tone={m.role === 'owner' ? 'primary' : 'neutral'}>
                        {t(`enums.roomRole.${m.role}`)}
                      </Badge>
                    )}
                    {isOwner && !me && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('rooms.members.remove')}
                        onClick={async () => {
                          const name = m.profile?.display_name || t('common.someone');
                          if (
                            await confirm({
                              title: t('rooms.members.remove'),
                              body: t('rooms.members.removeConfirm', { name }),
                            })
                          ) {
                            removeMember.mutate(m.user_id, { onError });
                          }
                        }}
                      >
                        <UserMinus className="size-4 text-danger" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={async () => {
              if (
                !(await confirm({
                  title: t('rooms.members.leave'),
                  body: t('rooms.members.leaveConfirm'),
                }))
              )
                return;
              removeMember.mutate(user!.id, {
                onSuccess: () => navigate('/rooms', { replace: true }),
                onError,
              });
            }}
          >
            <LogOut className="size-4 rtl:rotate-180" aria-hidden />
            {t('rooms.members.leave')}
          </Button>
        </CardBody>
      </Card>
      {isOwner && <InvitesCard roomId={room.id} />}
      {isOwner && <SettingsCard room={room} />}
    </div>
  );
}
