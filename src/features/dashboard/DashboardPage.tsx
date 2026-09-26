import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ListChecks,
  Plus,
  Send,
  Trophy,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { DaysLeft, ProgressBar } from '@/components/common/DaysLeft';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/QueryState';
import { StatusBadge, StatusDot } from '@/components/common/StatusBadge';
import { LinkButton } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Spinner';
import { useApplications } from '@/features/applications/api';
import { computeStats, type DeadlineItem } from '@/features/applications/logic';
import { useProfile } from '@/features/profile/api';
import { RecentRoomActivity } from '@/features/rooms/RecentRoomActivity';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { APPLICATION_STATUSES } from '@/lib/domain';
import { useFormat } from '@/providers/PreferencesProvider';

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Send;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <Card>
      <CardBody className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
        </div>
      </CardBody>
    </Card>
  );
}

function DeadlineList({ items, overdue = false }: { items: DeadlineItem[]; overdue?: boolean }) {
  const fmt = useFormat();
  const { t } = useTranslation();
  return (
    <ul className="flex flex-col divide-y divide-border">
      {items.map(({ app, deadline }) => (
        <li key={deadline.id}>
          <Link
            to={`/applications/${app.id}`}
            className="flex items-center gap-3 py-2.5 hover:text-primary"
          >
            {overdue ? (
              <AlertTriangle className="size-4 shrink-0 text-danger" aria-hidden />
            ) : (
              <CalendarClock className="size-4 shrink-0 text-muted" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" dir="auto">
                {app.university_name}
              </p>
              <p className="truncate text-xs text-muted" dir="auto">
                {[
                  deadline.label || t('applications.detail.deadlines'),
                  fmt.date(deadline.due_at),
                ].join(' · ')}
              </p>
            </div>
            <DaysLeft date={deadline.due_at} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('dashboard.title'));
  const fmt = useFormat();
  const { data: profile } = useProfile();
  const { data: apps, isPending, error, refetch } = useApplications();

  const header = (
    <PageHeader
      title={
        profile?.display_name
          ? t('dashboard.greeting', { name: profile.display_name })
          : t('dashboard.title')
      }
      description={t('dashboard.subtitle')}
      actions={
        <LinkButton to="/applications/new">
          <Plus className="size-4" aria-hidden />
          {t('dashboard.addApplication')}
        </LinkButton>
      }
    />
  );

  if (isPending) {
    return (
      <div>
        {header}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const stats = computeStats(apps);
  const maxCount = Math.max(1, ...Object.values(stats.byStatus));

  return (
    <div>
      {header}
      {stats.total === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={t('dashboard.emptyTitle')}
          description={t('dashboard.emptyBody')}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <LinkButton to="/applications/new">{t('dashboard.addApplication')}</LinkButton>
              <LinkButton to="/countries" variant="outline">
                {t('dashboard.exploreCountries')}
              </LinkButton>
            </div>
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={ListChecks}
              label={t('dashboard.totalApplications')}
              value={fmt.number(stats.total)}
            />
            <StatCard
              icon={Send}
              label={t('dashboard.submitted')}
              value={fmt.number(stats.submitted)}
            />
            <StatCard
              icon={Trophy}
              label={t('dashboard.admitted')}
              value={fmt.number(stats.admitted)}
            />
            <StatCard
              icon={CheckCircle2}
              label={t('dashboard.acceptanceRate')}
              value={
                stats.acceptanceRate === null
                  ? '—'
                  : fmt.number(stats.acceptanceRate, { style: 'percent' })
              }
              hint={
                stats.acceptanceRate === null
                  ? t('dashboard.noDecisions')
                  : t('dashboard.acceptanceRateHint', { count: stats.decided })
              }
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title={t('dashboard.upcomingDeadlines')} />
              <CardBody>
                {stats.overdue.length > 0 && (
                  <div className="mb-3 rounded-lg border border-danger/25 bg-danger-soft px-3">
                    <p className="pt-2 text-xs font-semibold text-danger">
                      {t('dashboard.overdue')}
                    </p>
                    <DeadlineList items={stats.overdue} overdue />
                  </div>
                )}
                {stats.upcoming.length === 0 ? (
                  <p className="text-sm text-muted">{t('dashboard.noUpcomingDeadlines')}</p>
                ) : (
                  <DeadlineList items={stats.upcoming} />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title={t('dashboard.byStatus')} />
              <CardBody className="flex flex-col gap-2.5">
                {APPLICATION_STATUSES.map((status) => (
                  <Link
                    key={status}
                    to={`/applications?view=table&status=${status}`}
                    className="group flex items-center gap-3 text-sm"
                  >
                    <span className="flex w-36 shrink-0 items-center gap-2 truncate group-hover:text-primary">
                      <StatusDot status={status} />
                      {t(`enums.status.${status}`)}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <span
                        className="block h-full rounded-full bg-primary/70"
                        style={{ width: `${(stats.byStatus[status] / maxCount) * 100}%` }}
                      />
                    </span>
                    <span className="w-6 text-end text-xs text-muted">
                      {fmt.number(stats.byStatus[status])}
                    </span>
                  </Link>
                ))}
                {stats.requirementsTotal > 0 && (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="mb-2 text-sm font-medium">
                      {t('dashboard.requirementsProgress')}
                    </p>
                    <ProgressBar value={stats.requirementsDone / stats.requirementsTotal} />
                    <p className="mt-1 text-xs text-muted">
                      {t('dashboard.requirementsDone', {
                        done: stats.requirementsDone,
                        total: stats.requirementsTotal,
                      })}
                    </p>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title={t('dashboard.recentActivity')} />
              <CardBody>
                <RecentRoomActivity />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title={t('nav.applications')} />
              <CardBody>
                <ul className="flex flex-col divide-y divide-border">
                  {apps.slice(0, 6).map((app) => (
                    <li key={app.id}>
                      <Link
                        to={`/applications/${app.id}`}
                        className="flex items-center justify-between gap-2 py-2 hover:text-primary"
                      >
                        <span className="truncate text-sm" dir="auto">
                          {app.university_name}
                        </span>
                        <StatusBadge status={app.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
