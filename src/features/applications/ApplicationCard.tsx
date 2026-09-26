import { ArrowRightLeft, CalendarClock, MoreVertical, Share2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { DaysLeft, ProgressBar } from '@/components/common/DaysLeft';
import { useIntakeLabel } from '@/components/common/IntakeText';
import { Menu } from '@/components/ui/Menu';
import { useCountryLookup } from '@/features/kb/countries';
import { APPLICATION_STATUSES, type ApplicationStatus } from '@/lib/domain';
import { cn } from '@/lib/utils';
import type { ApplicationWithDetails } from './api';
import { nextDeadline, requirementProgress } from './logic';

export function ApplicationCard({
  app,
  onMove,
  dragHandleProps,
  dragging = false,
  className,
}: {
  app: ApplicationWithDetails;
  onMove?: (status: ApplicationStatus) => void;
  dragHandleProps?: Record<string, unknown>;
  dragging?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const countries = useCountryLookup();
  const intake = useIntakeLabel();
  const next = nextDeadline(app);
  const progress = requirementProgress(app);

  const meta: ReactNode[] = [];
  if (app.country_code)
    meta.push(`${countries.flag(app.country_code)} ${countries.name(app.country_code)}`);
  if (app.degree_level) meta.push(t(`enums.degree.${app.degree_level}`));
  const intakeText = intake(app.intake_term, app.intake_year);
  if (intakeText) meta.push(intakeText);

  return (
    <div
      className={cn(
        'group relative rounded-xl border border-border bg-surface p-3 shadow-xs transition-shadow',
        dragging ? 'rotate-1 shadow-xl ring-2 ring-primary/40' : 'hover:shadow-md',
        className,
      )}
      {...dragHandleProps}
    >
      <div className="flex items-start gap-2">
        <Link
          to={`/applications/${app.id}`}
          className="min-w-0 flex-1 after:absolute after:inset-0 after:rounded-xl"
        >
          <p className="truncate font-semibold" dir="auto">
            {app.university_name}
          </p>
          {app.program_name && (
            <p className="truncate text-sm text-muted" dir="auto">
              {app.program_name}
            </p>
          )}
        </Link>
        {onMove && (
          <div className="relative z-10 -me-1 -mt-1">
            <Menu
              triggerLabel={t('applications.moveTo')}
              trigger={<MoreVertical className="size-4" />}
              items={[
                { label: t('applications.moveTo'), icon: ArrowRightLeft, disabled: true },
                ...APPLICATION_STATUSES.filter((s) => s !== app.status).map((status) => ({
                  label: t(`enums.status.${status}`),
                  onSelect: () => onMove(status),
                })),
              ]}
            />
          </div>
        )}
      </div>

      {meta.length > 0 && <p className="mt-1.5 truncate text-xs text-muted">{meta.join(' · ')}</p>}

      {(next || progress.total > 0 || app.visibility === 'shared') && (
        <div className="mt-3 flex flex-col gap-2">
          {next && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1 text-muted">
                <CalendarClock className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate" dir="auto">
                  {next.label || t('applications.detail.deadlines')}
                </span>
              </span>
              <DaysLeft date={next.due_at} />
            </div>
          )}
          {progress.total > 0 && (
            <div className="flex items-center gap-2">
              <ProgressBar value={progress.ratio} label={t('applications.columns.progress')} />
              <span className="shrink-0 text-xs text-muted">
                {t('applications.requirements.progress', {
                  done: progress.done,
                  total: progress.total,
                })}
              </span>
            </div>
          )}
          {app.visibility === 'shared' && (
            <span className="inline-flex items-center gap-1 self-start text-xs text-primary">
              <Share2 className="size-3" aria-hidden />
              {t('enums.visibility.shared')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
