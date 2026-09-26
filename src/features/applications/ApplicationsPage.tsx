import { CalendarDays, Columns3, ListChecks, Plus, Table2 } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/QueryState';
import { LinkButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Spinner';
import { SegmentedControl } from '@/components/ui/Tabs';
import { useCountryLookup } from '@/features/kb/countries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { describeError } from '@/lib/errors';
import type { ApplicationStatus } from '@/lib/domain';
import { useToast } from '@/providers/ToastProvider';
import { useApplications, useUpdateStatus } from './api';
import { ApplicationsTable } from './ApplicationsTable';
import { DeadlineCalendar } from './DeadlineCalendar';
import { FiltersBar } from './FiltersBar';
import { KanbanBoard } from './KanbanBoard';
import {
  filterApplications,
  hasActiveFilters,
  parseFilters,
  sortApplications,
  writeFilters,
  type ApplicationFilters,
  type SortDir,
  type SortKey,
} from './logic';

type View = 'board' | 'table' | 'calendar';
const SORT_KEYS: SortKey[] = [
  'university',
  'country',
  'degree',
  'intake',
  'status',
  'deadline',
  'progress',
  'updated',
];

export default function ApplicationsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('applications.title'));
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { data: apps, isPending, error, refetch } = useApplications();
  const updateStatus = useUpdateStatus();
  const countries = useCountryLookup();

  const view: View =
    (['board', 'table', 'calendar'] as const).find((v) => v === params.get('view')) ?? 'board';
  const filters = parseFilters(params);
  const sort: SortKey = SORT_KEYS.find((k) => k === params.get('sort')) ?? 'deadline';
  const dir: SortDir = params.get('dir') === 'desc' ? 'desc' : 'asc';

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const setFilters = (next: ApplicationFilters) =>
    setParams(writeFilters(params, next), { replace: true });

  const visible = useMemo(() => {
    const filtered = filterApplications(apps ?? [], filters, countries.name);
    return view === 'table' ? sortApplications(filtered, sort, dir, countries.name) : filtered;
  }, [apps, filters, countries.name, view, sort, dir]);

  const move = (id: string, status: ApplicationStatus) => {
    updateStatus.mutate(
      { id, status },
      {
        onSuccess: () => toast.success(t('applications.statusChanged')),
        onError: (e) => toast.error(describeError(e, t)),
      },
    );
  };

  const onSort = (key: SortKey) => {
    const next = new URLSearchParams(params);
    next.set('sort', key);
    next.set('dir', sort === key && dir === 'asc' ? 'desc' : 'asc');
    setParams(next, { replace: true });
  };

  return (
    <div>
      <PageHeader
        title={t('applications.title')}
        description={t('applications.subtitle')}
        actions={
          <LinkButton to="/applications/new">
            <Plus className="size-4" aria-hidden />
            {t('applications.new')}
          </LinkButton>
        }
      />

      {isPending ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : apps.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={t('dashboard.emptyTitle')}
          description={t('dashboard.emptyBody')}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <LinkButton to="/applications/new">
                <Plus className="size-4" aria-hidden />
                {t('dashboard.addApplication')}
              </LinkButton>
              <LinkButton to="/countries" variant="outline">
                {t('dashboard.exploreCountries')}
              </LinkButton>
            </div>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
            <div className="flex-1">
              <FiltersBar filters={filters} onChange={setFilters} showStatus={view !== 'board'} />
            </div>
            <SegmentedControl<View>
              label={t('applications.title')}
              value={view}
              onChange={(v) => setParam('view', v === 'board' ? null : v)}
              items={[
                { value: 'board', label: t('applications.viewBoard'), icon: Columns3 },
                { value: 'table', label: t('applications.viewTable'), icon: Table2 },
                { value: 'calendar', label: t('applications.viewCalendar'), icon: CalendarDays },
              ]}
            />
          </div>

          {visible.length === 0 && hasActiveFilters(filters) ? (
            <EmptyState title={t('applications.emptyFiltered')} />
          ) : view === 'board' ? (
            <KanbanBoard apps={visible} onMove={move} />
          ) : view === 'table' ? (
            <ApplicationsTable apps={visible} sort={sort} dir={dir} onSort={onSort} />
          ) : (
            <DeadlineCalendar apps={visible} />
          )}
        </div>
      )}
    </div>
  );
}
