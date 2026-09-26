import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  ExternalLink,
  Link2,
  MessageSquare,
  Pin,
  PinOff,
  Plus,
  StickyNote,
  Target as TargetIcon,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Rocket,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { CountrySelect } from '@/components/common/CountrySelect';
import { DaysLeft, ProgressBar } from '@/components/common/DaysLeft';
import { useIntakeLabel } from '@/components/common/IntakeText';
import { Markdown } from '@/components/common/Markdown';
import { MarkdownEditor } from '@/components/common/MarkdownEditor';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Avatar } from '@/components/ui/Avatar';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, Input, Select } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Spinner';
import { useCreateApplication } from '@/features/applications/api';
import { useCountryLookup } from '@/features/kb/countries';
import type { Json } from '@/lib/database.types';
import { APPLICATION_STATUSES, type TargetInterest } from '@/lib/domain';
import { describeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { cn, hostnameOf, safeHttpUrl } from '@/lib/utils';
import { useAuth } from '@/providers/AuthProvider';
import { useConfirm } from '@/providers/ConfirmProvider';
import { useFormat } from '@/providers/PreferencesProvider';
import { useToast } from '@/providers/ToastProvider';
import {
  useNotes,
  useRoomApplications,
  useRoomMutation,
  useTargets,
  type Note,
  type SharedApplication,
  type Target,
} from './api';
import { Comments } from './Comments';

export interface TabProps {
  roomId: string;
  canWrite: boolean;
  isOwner: boolean;
}

function useErrorToast() {
  const { t } = useTranslation();
  const toast = useToast();
  return (e: unknown) => toast.error(describeError(e, t));
}

// ------------------------------------------------------ shared applications --
function SharedApplicationCard({
  app,
  roomId,
  canWrite,
  isOwner,
}: TabProps & { app: SharedApplication }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const fmt = useFormat();
  const intake = useIntakeLabel();
  const countries = useCountryLookup();
  const confirm = useConfirm();
  const onError = useErrorToast();
  const [open, setOpen] = useState(false);
  const detail = useRoomApplicationsDetail(roomId, app.application_id!, open);
  const unshare = useRoomMutation(roomId, async () => {
    const { error } = await supabase
      .from('room_shared_applications')
      .delete()
      .eq('room_id', roomId)
      .eq('application_id', app.application_id!);
    if (error) throw error;
  });
  const mine = app.owner_id === user?.id;
  const total = app.requirements_total ?? 0;

  return (
    <Card>
      <CardBody className="flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <Avatar name={app.owner_name} url={app.owner_avatar_url} seed={app.owner_id} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold" dir="auto">
              {app.university_name}
            </p>
            <p className="truncate text-sm text-muted" dir="auto">
              {[
                app.program_name,
                app.degree_level && t(`enums.degree.${app.degree_level}`),
                intake(app.intake_term, app.intake_year),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="text-xs text-muted">
              {t('rooms.board.sharedBy', { name: app.owner_name || t('common.someone') })}
              {app.country_code &&
                ` · ${countries.flag(app.country_code)} ${countries.name(app.country_code)}`}
            </p>
          </div>
          {app.status && <StatusBadge status={app.status} />}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          {app.next_deadline_at && (
            <span className="flex items-center gap-1">
              {t('rooms.board.nextDeadline', { date: fmt.date(app.next_deadline_at) })}{' '}
              <DaysLeft date={app.next_deadline_at} />
            </span>
          )}
          {total > 0 && (
            <span className="flex w-40 items-center gap-2">
              <ProgressBar value={(app.requirements_done ?? 0) / total} />
              {t('rooms.board.checklist', { done: app.requirements_done ?? 0, total })}
            </span>
          )}
          {app.result_date && <span>{fmt.date(app.result_date)}</span>}
        </div>
        {app.decision_notes && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm" dir="auto">
            {app.decision_notes}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            <MessageSquare className="size-4" aria-hidden />
            {t('rooms.comments.count', { count: app.comment_count ?? 0 })}
            <ChevronDown
              className={cn('size-4 transition-transform', open && 'rotate-180')}
              aria-hidden
            />
          </Button>
          {mine && (
            <LinkButton to={`/applications/${app.application_id}`} variant="ghost" size="sm">
              {t('common.open')}
            </LinkButton>
          )}
          {(mine || isOwner) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-danger"
              onClick={async () => {
                if (
                  await confirm({
                    title: t('rooms.board.unshareConfirm'),
                    confirmLabel: t('rooms.board.unshare'),
                  })
                ) {
                  unshare.mutate(undefined, { onError });
                }
              }}
            >
              {t('rooms.board.unshare')}
            </Button>
          )}
        </div>
        {open && (
          <div className="flex flex-col gap-3">
            {detail.data && (
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted">
                    {t('applications.detail.deadlines')}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {detail.data.deadlines.map((d) => (
                      <li
                        key={d.id}
                        className={cn(
                          'flex justify-between gap-2',
                          d.is_done && 'text-muted line-through',
                        )}
                      >
                        <span dir="auto">{d.label || '—'}</span>
                        <span className="text-xs">{fmt.date(d.due_at)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted">
                    {t('applications.detail.checklist')}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {detail.data.requirements.map((r) => (
                      <li
                        key={r.id}
                        className={cn(r.is_done && 'text-muted line-through')}
                        dir="auto"
                      >
                        {r.is_done ? '✓ ' : '○ '}
                        {r.label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <Comments
              roomId={roomId}
              target={{ application_id: app.application_id! }}
              canWrite={canWrite}
              isOwner={isOwner}
            />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

interface SharedDetail {
  deadlines: { id: string; label: string; due_at: string; is_done: boolean }[];
  requirements: { id: string; label: string; is_done: boolean }[];
}

function useRoomApplicationsDetail(roomId: string, applicationId: string, enabled: boolean) {
  return useRoomPartQuery(roomId, `app-${applicationId}`, enabled, async () => {
    const { data, error } = await supabase.rpc('get_shared_application', {
      p_room_id: roomId,
      p_application_id: applicationId,
    });
    if (error) throw error;
    const value = (data ?? {}) as { [key: string]: Json };
    return {
      deadlines: (value.deadlines ?? []) as unknown as SharedDetail['deadlines'],
      requirements: (value.requirements ?? []) as unknown as SharedDetail['requirements'],
    };
  });
}

function useRoomPartQuery<T>(roomId: string, part: string, enabled: boolean, fn: () => Promise<T>) {
  return useQuery({ queryKey: ['rooms', roomId, part], queryFn: fn, enabled });
}

export function ApplicationsTab(props: TabProps) {
  const { t } = useTranslation();
  const { data, isPending } = useRoomApplications(props.roomId);
  const [group, setGroup] = useState<'status' | 'member'>('status');
  if (isPending) return <Skeleton className="h-40" />;
  const apps = data ?? [];
  if (apps.length === 0) {
    return (
      <EmptyState
        icon={Rocket}
        title={t('rooms.board.empty')}
        action={
          props.canWrite ? (
            <LinkButton to="/applications" variant="outline">
              {t('rooms.board.shareMine')}
            </LinkButton>
          ) : undefined
        }
      />
    );
  }
  const groups =
    group === 'status'
      ? APPLICATION_STATUSES.map((s) => ({
          key: s,
          label: t(`enums.status.${s}`),
          items: apps.filter((a) => a.status === s),
        }))
      : [...new Set(apps.map((a) => a.owner_id))].map((id) => {
          const items = apps.filter((a) => a.owner_id === id);
          return { key: id ?? '', label: items[0]?.owner_name || t('common.someone'), items };
        });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select
          className="w-auto"
          value={group}
          onChange={(e) => setGroup(e.target.value as 'status' | 'member')}
          aria-label={t('rooms.board.title')}
        >
          <option value="status">{t('rooms.board.groupByStatus')}</option>
          <option value="member">{t('rooms.board.groupByMember')}</option>
        </Select>
        {props.canWrite && (
          <LinkButton to="/applications" variant="outline" size="sm">
            {t('rooms.board.shareMine')}
          </LinkButton>
        )}
      </div>
      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <section key={g.key}>
            <h3 className="mb-2 text-sm font-semibold text-muted" dir="auto">
              {g.label} ({g.items.length})
            </h3>
            <div className="grid gap-3 lg:grid-cols-2">
              {g.items.map((app) => (
                <SharedApplicationCard key={app.application_id} app={app} {...props} />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}

// ------------------------------------------------------------- target list --
const INTEREST_ICONS: Record<TargetInterest, typeof ThumbsUp> = {
  interested: ThumbsUp,
  applying: Rocket,
  not_interested: ThumbsDown,
};

function TargetCard({ target, roomId, canWrite, isOwner }: TabProps & { target: Target }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const countries = useCountryLookup();
  const onError = useErrorToast();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const mine = target.room_target_votes.find((v) => v.user_id === user?.id)?.interest ?? null;
  const setInterest = useRoomMutation(roomId, async (interest: TargetInterest | null) => {
    const { error } = await supabase.rpc('set_target_interest', {
      p_target_id: target.id,
      ...(interest ? { p_interest: interest } : {}),
    });
    if (error) throw error;
  });
  const remove = useRoomMutation(roomId, async () => {
    const { error } = await supabase.from('room_targets').delete().eq('id', target.id);
    if (error) throw error;
  });
  const createApp = useCreateApplication();
  const url = safeHttpUrl(target.url);

  const addToTracker = async () => {
    try {
      let id: string;
      if (target.program_id || target.university_id) {
        const { data, error } = await supabase.rpc('add_to_tracker', {
          ...(target.program_id ? { p_program_id: target.program_id } : {}),
          ...(target.university_id && !target.program_id
            ? { p_university_id: target.university_id }
            : {}),
        });
        if (error) throw error;
        id = data;
      } else {
        id = await createApp.mutateAsync({
          application: {
            university_name: target.title,
            country_code: target.country_code,
            portal_url: url,
          },
        });
      }
      toast.success(t('kb.university.addedToTracker'));
      navigate(`/applications/${id}`);
    } catch (e) {
      onError(e);
    }
  };

  return (
    <Card>
      <CardBody className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold" dir="auto">
              {target.title}
            </p>
            <p className="text-xs text-muted">
              {target.country_code &&
                `${countries.flag(target.country_code)} ${countries.name(target.country_code)}`}
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="ms-2 inline-flex items-center gap-1 hover:text-primary"
                >
                  <ExternalLink className="size-3" aria-hidden />
                  {hostnameOf(url)}
                </a>
              )}
            </p>
          </div>
          {((target.created_by === user?.id && canWrite) || isOwner) && (
            <button
              type="button"
              className="rounded p-1.5 text-muted hover:text-danger"
              aria-label={t('common.delete')}
              onClick={() => remove.mutate(undefined, { onError })}
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
        {target.notes && <Markdown className="text-sm">{target.notes}</Markdown>}
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(INTEREST_ICONS) as TargetInterest[]).map((interest) => {
            const Icon = INTEREST_ICONS[interest];
            const count = target.room_target_votes.filter((v) => v.interest === interest).length;
            const active = mine === interest;
            return (
              <button
                key={interest}
                type="button"
                disabled={!canWrite || setInterest.isPending}
                aria-pressed={active}
                onClick={() => setInterest.mutate(active ? null : interest, { onError })}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-default',
                  active
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-border text-muted hover:text-fg',
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {t(`enums.interest.${interest}`)} · {count}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            <MessageSquare className="size-4" aria-hidden />
            {t('rooms.comments.title')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void addToTracker()}>
            <Plus className="size-4" aria-hidden />
            {t('rooms.targets.addToTracker')}
          </Button>
        </div>
        {open && (
          <Comments
            roomId={roomId}
            target={{ target_id: target.id }}
            canWrite={canWrite}
            isOwner={isOwner}
          />
        )}
      </CardBody>
    </Card>
  );
}

export function TargetsTab(props: TabProps) {
  const { t } = useTranslation();
  const onError = useErrorToast();
  const { data, isPending } = useTargets(props.roomId);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const add = useRoomMutation(props.roomId, async () => {
    const { error } = await supabase.from('room_targets').insert({
      room_id: props.roomId,
      title: title.trim(),
      url: safeHttpUrl(url.trim()),
      country_code: country,
      notes: notes.trim(),
    });
    if (error) throw error;
  });
  if (isPending) return <Skeleton className="h-40" />;
  const score = (x: Target) =>
    x.room_target_votes.filter((v) => v.interest !== 'not_interested').length * 2 -
    x.room_target_votes.filter((v) => v.interest === 'not_interested').length;
  const targets = [...(data ?? [])].sort((a, b) => score(b) - score(a));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    add.mutate(undefined, {
      onSuccess: () => {
        setTitle('');
        setUrl('');
        setNotes('');
        setCountry(null);
        setAdding(false);
      },
      onError,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {props.canWrite && (
        <div>
          <Button onClick={() => setAdding(true)}>
            <TargetIcon className="size-4" aria-hidden />
            {t('rooms.targets.add')}
          </Button>
        </div>
      )}
      {targets.length === 0 ? (
        <EmptyState icon={TargetIcon} title={t('rooms.targets.empty')} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {targets.map((target) => (
            <TargetCard key={target.id} target={target} {...props} />
          ))}
        </div>
      )}
      <Dialog open={adding} onClose={() => setAdding(false)} title={t('rooms.targets.add')}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label={t('rooms.targets.titleLabel')} htmlFor="tg-title">
            <Input
              id="tg-title"
              dir="auto"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label={t('common.country')} htmlFor="tg-country">
            <CountrySelect id="tg-country" value={country} onChange={setCountry} />
          </Field>
          <Field
            label={t('rooms.targets.urlLabel')}
            htmlFor="tg-url"
            optional
            optionalLabel={t('common.optional')}
          >
            <Input
              id="tg-url"
              type="url"
              dir="ltr"
              placeholder="https://"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>
          <Field
            label={t('rooms.targets.notesLabel')}
            htmlFor="tg-notes"
            optional
            optionalLabel={t('common.optional')}
          >
            <MarkdownEditor
              id="tg-notes"
              value={notes}
              onChange={setNotes}
              rows={3}
              maxLength={4000}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAdding(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={add.isPending} disabled={!title.trim()}>
              {t('common.add')}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

// -------------------------------------------------------------------- notes --
function NoteDialog({
  roomId,
  note,
  onClose,
}: {
  roomId: string;
  note: Note | 'note' | 'link';
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const onError = useErrorToast();
  const existing = typeof note === 'object' ? note : null;
  const kind = existing?.kind ?? (note as 'note' | 'link');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [url, setUrl] = useState(existing?.url ?? '');
  const [body, setBody] = useState(existing?.body_md ?? '');
  const save = useRoomMutation(roomId, async () => {
    const payload = { title: title.trim(), url: safeHttpUrl(url.trim()), body_md: body };
    const { error } = existing
      ? await supabase.from('notes').update(payload).eq('id', existing.id)
      : await supabase.from('notes').insert({ ...payload, room_id: roomId, kind });
    if (error) throw error;
  });
  const valid = title.trim() && (kind === 'note' || safeHttpUrl(url.trim()));
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={
        existing
          ? t('common.edit')
          : kind === 'link'
            ? t('rooms.notes.newLink')
            : t('rooms.notes.newNote')
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!valid}
            loading={save.isPending}
            onClick={() => save.mutate(undefined, { onSuccess: onClose, onError })}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t('rooms.notes.titleLabel')} htmlFor="note-title">
          <Input
            id="note-title"
            dir="auto"
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        {kind === 'link' && (
          <Field label={t('rooms.notes.urlLabel')} htmlFor="note-url">
            <Input
              id="note-url"
              type="url"
              dir="ltr"
              placeholder="https://"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>
        )}
        <Field label={t('rooms.notes.bodyLabel')} htmlFor="note-body">
          <MarkdownEditor
            id="note-body"
            value={body}
            onChange={setBody}
            rows={10}
            maxLength={50000}
          />
        </Field>
      </div>
    </Dialog>
  );
}

export function NotesTab(props: TabProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const fmt = useFormat();
  const confirm = useConfirm();
  const onError = useErrorToast();
  const { data, isPending } = useNotes(props.roomId);
  const [editing, setEditing] = useState<Note | 'note' | 'link' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const pin = useRoomMutation(props.roomId, async (note: Note) => {
    const { error } = await supabase
      .from('notes')
      .update({ is_pinned: !note.is_pinned })
      .eq('id', note.id);
    if (error) throw error;
  });
  const remove = useRoomMutation(props.roomId, async (id: string) => {
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) throw error;
  });
  if (isPending) return <Skeleton className="h-40" />;
  const notes = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      {props.canWrite && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setEditing('note')}>
            <StickyNote className="size-4" aria-hidden />
            {t('rooms.notes.newNote')}
          </Button>
          <Button variant="outline" onClick={() => setEditing('link')}>
            <Link2 className="size-4" aria-hidden />
            {t('rooms.notes.newLink')}
          </Button>
        </div>
      )}
      {notes.length === 0 ? (
        <EmptyState icon={StickyNote} title={t('rooms.notes.empty')} />
      ) : (
        notes.map((note) => {
          const url = safeHttpUrl(note.url);
          const open = openId === note.id;
          return (
            <Card key={note.id}>
              <CardBody className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-start"
                    onClick={() => setOpenId(open ? null : note.id)}
                    aria-expanded={open}
                  >
                    <p className="flex items-center gap-2 font-semibold" dir="auto">
                      {note.is_pinned && (
                        <Pin
                          className="size-4 shrink-0 text-primary"
                          aria-label={t('rooms.notes.pinned')}
                        />
                      )}
                      {note.kind === 'link' && (
                        <Link2 className="size-4 shrink-0 text-muted" aria-hidden />
                      )}
                      {note.title}
                    </p>
                    <p className="text-xs text-muted">{fmt.relative(note.updated_at)}</p>
                  </button>
                  {props.canWrite && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={note.is_pinned ? t('rooms.notes.unpin') : t('rooms.notes.pin')}
                        onClick={() => pin.mutate(note, { onError })}
                      >
                        {note.is_pinned ? (
                          <PinOff className="size-4" />
                        ) : (
                          <Pin className="size-4" />
                        )}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(note)}>
                        {t('common.edit')}
                      </Button>
                      {((note.created_by === user?.id && props.canWrite) || props.isOwner) && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t('common.delete')}
                          onClick={async () => {
                            if (
                              await confirm({
                                title: t('rooms.notes.deleteConfirm'),
                                confirmLabel: t('common.delete'),
                              })
                            ) {
                              remove.mutate(note.id, { onError });
                            }
                          }}
                        >
                          <Trash2 className="size-4 text-danger" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                    {hostnameOf(url)}
                  </a>
                )}
                {open && (
                  <>
                    <Markdown>{note.body_md}</Markdown>
                    <Comments
                      roomId={props.roomId}
                      target={{ note_id: note.id }}
                      canWrite={props.canWrite}
                      isOwner={props.isOwner}
                    />
                  </>
                )}
              </CardBody>
            </Card>
          );
        })
      )}
      {editing && (
        <NoteDialog roomId={props.roomId} note={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
