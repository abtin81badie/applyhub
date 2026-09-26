import { ListPlus, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ProgressBar } from '@/components/common/DaysLeft';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { DEFAULT_REQUIREMENTS, REQUIREMENT_KINDS, type RequirementKind } from '@/lib/domain';
import { describeError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { useToast } from '@/providers/ToastProvider';
import {
  useAddRequirements,
  useDeleteRequirement,
  useUpdateRequirement,
  type ApplicationWithDetails,
} from './api';
import { requirementProgress } from './logic';

export function RequirementsChecklist({ app }: { app: ApplicationWithDetails }) {
  const { t } = useTranslation();
  const toast = useToast();
  const add = useAddRequirements(app.id);
  const update = useUpdateRequirement(app.id);
  const remove = useDeleteRequirement(app.id);
  const [kind, setKind] = useState<RequirementKind>('other');
  const [label, setLabel] = useState('');
  const progress = requirementProgress(app);
  const items = app.application_requirements;
  const onError = (error: unknown) => toast.error(describeError(error, t));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = label.trim() || t(`enums.requirement.${kind}`);
    add.mutate([{ kind, label: text, sort_order: items.length + 1 }], {
      onSuccess: () => {
        setLabel('');
        setKind('other');
      },
      onError,
    });
  };

  const addDefaults = () => {
    const existing = new Set(items.map((i) => i.kind));
    const missing = DEFAULT_REQUIREMENTS.filter((k) => !existing.has(k));
    add.mutate(
      missing.map((k, i) => ({
        kind: k,
        label: t(`enums.requirement.${k}`),
        sort_order: items.length + i + 1,
      })),
      { onError },
    );
  };

  return (
    <Card>
      <CardHeader
        title={t('applications.detail.checklist')}
        description={
          progress.total > 0
            ? t('applications.requirements.progress', {
                done: progress.done,
                total: progress.total,
              })
            : undefined
        }
        actions={
          <Button variant="ghost" size="sm" onClick={addDefaults} loading={add.isPending}>
            <ListPlus className="size-4" aria-hidden />
            <span className="hidden sm:inline">{t('applications.requirements.addDefaults')}</span>
          </Button>
        }
      />
      <CardBody className="flex flex-col gap-3">
        {progress.total > 0 && (
          <ProgressBar value={progress.ratio} label={t('applications.columns.progress')} />
        )}
        {items.length === 0 ? (
          <p className="text-sm text-muted">{t('applications.requirements.empty')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="group flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  className="size-4 shrink-0 cursor-pointer accent-[var(--primary)]"
                  checked={item.is_done}
                  aria-label={
                    item.is_done
                      ? t('applications.requirements.markNotDone')
                      : t('applications.requirements.markDone')
                  }
                  onChange={(e) =>
                    update.mutate(
                      { id: item.id, patch: { is_done: e.target.checked } },
                      { onError },
                    )
                  }
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn('text-sm', item.is_done && 'text-muted line-through')}
                    dir="auto"
                  >
                    {item.label}
                  </p>
                  {item.kind !== 'other' && item.label !== t(`enums.requirement.${item.kind}`) && (
                    <p className="text-xs text-muted">{t(`enums.requirement.${item.kind}`)}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove.mutate(item.id, { onError })}
                  className="rounded-md p-1.5 text-muted opacity-60 group-hover:opacity-100 hover:bg-danger-soft hover:text-danger focus-visible:opacity-100"
                  aria-label={`${t('common.delete')}: ${item.label}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          onSubmit={submit}
          className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row"
        >
          <Select
            aria-label={t('applications.requirements.kind')}
            value={kind}
            onChange={(e) => setKind(e.target.value as RequirementKind)}
            className="sm:w-48"
          >
            {REQUIREMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`enums.requirement.${k}`)}
              </option>
            ))}
          </Select>
          <Input
            dir="auto"
            aria-label={t('applications.requirements.label')}
            placeholder={t('applications.requirements.labelPlaceholder')}
            maxLength={300}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button type="submit" variant="secondary" loading={add.isPending}>
            <Plus className="size-4" aria-hidden />
            {t('common.add')}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
