import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { DaysLeft, ProgressBar } from '@/components/common/DaysLeft';
import { useIntakeLabel } from '@/components/common/IntakeText';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useCountryLookup } from '@/features/kb/countries';
import { cn } from '@/lib/utils';
import { useFormat } from '@/providers/PreferencesProvider';
import type { ApplicationWithDetails } from './api';
import { nextDeadline, requirementProgress, type SortDir, type SortKey } from './logic';

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: 'university', label: 'applications.columns.university' },
  { key: 'country', label: 'applications.columns.country' },
  { key: 'degree', label: 'applications.columns.degree', className: 'hidden xl:table-cell' },
  { key: 'intake', label: 'applications.columns.intake' },
  { key: 'status', label: 'applications.columns.status' },
  { key: 'deadline', label: 'applications.columns.nextDeadline' },
  { key: 'progress', label: 'applications.columns.progress' },
  { key: 'updated', label: 'applications.columns.updated', className: 'hidden xl:table-cell' },
];

export function ApplicationsTable({
  apps,
  sort,
  dir,
  onSort,
}: {
  apps: ApplicationWithDetails[];
  sort: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const countries = useCountryLookup();
  const intake = useIntakeLabel();
  const navigate = useNavigate();

  return (
    <>
      {/* Phones: compact list */}
      <ul className="flex flex-col gap-2 md:hidden">
        {apps.map((app) => {
          const next = nextDeadline(app);
          const progress = requirementProgress(app);
          return (
            <li key={app.id}>
              <Link
                to={`/applications/${app.id}`}
                className="block rounded-xl border border-border bg-surface p-3 shadow-xs hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold" dir="auto">
                      {app.university_name}
                    </p>
                    <p className="truncate text-sm text-muted" dir="auto">
                      {app.program_name}
                    </p>
                  </div>
                  <StatusBadge status={app.status} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                  <span className="truncate">
                    {countries.flag(app.country_code)} {countries.name(app.country_code)}{' '}
                    {intake(app.intake_term, app.intake_year) &&
                      `· ${intake(app.intake_term, app.intake_year)}`}
                  </span>
                  {next && <DaysLeft date={next.due_at} />}
                </div>
                {progress.total > 0 && <ProgressBar value={progress.ratio} className="mt-2" />}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Tablets and up: sortable table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-2/60 text-xs text-muted">
            <tr>
              {COLUMNS.map((col) => {
                const active = sort === col.key;
                const Icon = !active ? ChevronsUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={cn('px-3 py-2.5 text-start font-medium', col.className)}
                  >
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className={cn(
                        'inline-flex items-center gap-1 hover:text-fg',
                        active && 'text-fg',
                      )}
                    >
                      {t(col.label as never)}
                      <Icon className="size-3.5" aria-hidden />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {apps.map((app) => {
              const next = nextDeadline(app);
              const progress = requirementProgress(app);
              return (
                <tr
                  key={app.id}
                  className="cursor-pointer hover:bg-surface-2/60"
                  onClick={() => navigate(`/applications/${app.id}`)}
                >
                  <td className="max-w-72 px-3 py-2.5">
                    <Link
                      to={`/applications/${app.id}`}
                      className="block truncate font-medium hover:text-primary"
                      dir="auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {app.university_name}
                    </Link>
                    <span className="block truncate text-xs text-muted" dir="auto">
                      {app.program_name}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {app.country_code
                      ? `${countries.flag(app.country_code)} ${countries.name(app.country_code)}`
                      : '—'}
                  </td>
                  <td className="hidden px-3 py-2.5 whitespace-nowrap xl:table-cell">
                    {app.degree_level ? t(`enums.degree.${app.degree_level}`) : '—'}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {intake(app.intake_term, app.intake_year) || '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {next ? (
                      <div className="flex flex-col">
                        <span>{fmt.date(next.due_at)}</span>
                        <DaysLeft date={next.due_at} />
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="w-36 px-3 py-2.5">
                    {progress.total > 0 ? (
                      <div className="flex items-center gap-2">
                        <ProgressBar value={progress.ratio} />
                        <span className="shrink-0 text-xs text-muted">
                          {t('applications.requirements.progress', {
                            done: progress.done,
                            total: progress.total,
                          })}
                        </span>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="hidden px-3 py-2.5 text-xs whitespace-nowrap text-muted xl:table-cell">
                    {fmt.relative(app.updated_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
