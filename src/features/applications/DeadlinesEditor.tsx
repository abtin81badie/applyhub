import { CalendarPlus, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DateInput } from '@/components/common/DateInput';
import { DaysLeft } from '@/components/common/DaysLeft';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Textarea } from '@/components/ui/Input';
import { combineIsoDate, splitIsoDateTime } from '@/lib/dates';
import { describeError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { useFormat } from '@/providers/PreferencesProvider';
import { useToast } from '@/providers/ToastProvider';
import {
  useDeleteDeadline,
  useSaveDeadline,
  type ApplicationWithDetails,
  type Deadline,
} from './api';

function DeadlineDialog({
  open,
  onClose,
  applicationId,
  deadline,
}: {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  deadline: Deadline | null;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const save = useSaveDeadline(applicationId);
  const initial = splitIsoDateTime(deadline?.due_at);
  const [label, setLabel] = useState(deadline?.label ?? '');
  const [date, setDate] = useState<string | null>(initial.date);
  const [time, setTime] = useState(initial.time);
  const [notes, setNotes] = useState(deadline?.notes ?? '');
  const [dateError, setDateError] = useState(false);

  const submit = () => {
    if (!date) {
      setDateError(true);
      return;
    }
    save.mutate(
      {
        id: deadline?.id,
        label: label.trim(),
        due_at: combineIsoDate(date, time),
        notes: notes.trim() || null,
      },
      {
        onSuccess: onClose,
        onError: (error) => toast.error(describeError(error, t)),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={deadline ? t('common.edit') : t('applications.deadlines.add')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t('applications.deadlines.label')} htmlFor="dl-label">
          <Input
            id="dl-label"
            dir="auto"
            maxLength={120}
            placeholder={t('applications.deadlines.labelPlaceholder')}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <Field
            label={t('applications.deadlines.dueAt')}
            htmlFor="dl-date"
            error={dateError ? t('validation.required') : null}
          >
            <DateInput
              id="dl-date"
              value={date}
              invalid={dateError}
              clearable={false}
              onChange={(v) => {
                setDate(v);
                setDateError(false);
              }}
            />
          </Field>
          <Field label={t('applications.deadlines.time')} htmlFor="dl-time">
            <Input
              id="dl-time"
              type="time"
              dir="ltr"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>
        </div>
        <Field
          label={t('common.notes')}
          htmlFor="dl-notes"
          optional
          optionalLabel={t('common.optional')}
        >
          <Textarea
            id="dl-notes"
            dir="auto"
            rows={2}
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>
    </Dialog>
  );
}

export function DeadlinesEditor({ app }: { app: ApplicationWithDetails }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const toast = useToast();
  const save = useSaveDeadline(app.id);
  const remove = useDeleteDeadline(app.id);
  const [editing, setEditing] = useState<Deadline | 'new' | null>(null);
  const onError = (error: unknown) => toast.error(describeError(error, t));

  return (
    <Card>
      <CardHeader
        title={t('applications.detail.deadlines')}
        actions={
          <Button variant="ghost" size="sm" onClick={() => setEditing('new')}>
            <CalendarPlus className="size-4" aria-hidden />
            {t('applications.deadlines.add')}
          </Button>
        }
      />
      <CardBody>
        {app.deadlines.length === 0 ? (
          <p className="text-sm text-muted">{t('applications.deadlines.empty')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {app.deadlines.map((d) => (
              <li key={d.id} className="group flex items-center gap-3 py-2.5">
                <input
                  type="checkbox"
                  className="size-4 shrink-0 cursor-pointer accent-[var(--primary)]"
                  checked={d.is_done}
                  aria-label={t('applications.deadlines.done')}
                  onChange={(e) =>
                    save.mutate(
                      { id: d.id, label: d.label, due_at: d.due_at, is_done: e.target.checked },
                      { onError },
                    )
                  }
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn('text-sm font-medium', d.is_done && 'text-muted line-through')}
                    dir="auto"
                  >
                    {d.label || t('applications.detail.deadlines')}
                  </p>
                  <p className="text-xs text-muted">{fmt.dateTime(d.due_at)}</p>
                  {d.notes && (
                    <p className="mt-0.5 text-xs text-muted" dir="auto">
                      {d.notes}
                    </p>
                  )}
                </div>
                <DaysLeft date={d.due_at} done={d.is_done} />
                <div className="flex opacity-60 group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => setEditing(d)}
                    className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg"
                    aria-label={`${t('common.edit')}: ${d.label}`}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove.mutate(d.id, { onError })}
                    className="rounded-md p-1.5 text-muted hover:bg-danger-soft hover:text-danger"
                    aria-label={`${t('common.delete')}: ${d.label}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      {editing && (
        <DeadlineDialog
          open
          onClose={() => setEditing(null)}
          applicationId={app.id}
          deadline={editing === 'new' ? null : editing}
        />
      )}
    </Card>
  );
}
