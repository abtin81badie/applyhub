import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CountrySelect } from '@/components/common/CountrySelect';
import { StatusDot } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { APPLICATION_STATUSES, DEGREE_LEVELS, yearOptions, type DegreeLevel } from '@/lib/domain';
import { cn } from '@/lib/utils';
import { useFormat } from '@/providers/PreferencesProvider';
import { EMPTY_FILTERS, hasActiveFilters, type ApplicationFilters } from './logic';

export function FiltersBar({
  filters,
  onChange,
  showStatus = true,
}: {
  filters: ApplicationFilters;
  onChange: (filters: ApplicationFilters) => void;
  showStatus?: boolean;
}) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [open, setOpen] = useState(() => hasActiveFilters({ ...filters, q: '' }));
  const active = hasActiveFilters(filters);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <Input
            type="search"
            dir="auto"
            value={filters.q}
            onChange={(e) => onChange({ ...filters, q: e.target.value })}
            placeholder={t('applications.searchPlaceholder')}
            aria-label={t('common.search')}
            className="ps-9"
          />
        </div>
        <Button
          variant={open ? 'secondary' : 'outline'}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={t('common.filters')}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          <span className="hidden sm:inline">{t('common.filters')}</span>
        </Button>
        {active && (
          <Button variant="ghost" onClick={() => onChange(EMPTY_FILTERS)}>
            <X className="size-4" aria-hidden />
            <span className="hidden sm:inline">{t('common.clearFilters')}</span>
          </Button>
        )}
      </div>

      {open && (
        <div className="grid gap-3 rounded-xl border border-border bg-surface p-3 sm:grid-cols-3">
          <CountrySelect
            aria-label={t('applications.filterCountry')}
            value={filters.country}
            placeholder={`${t('applications.filterCountry')}: ${t('common.all')}`}
            onChange={(country) => onChange({ ...filters, country })}
          />
          <Select
            aria-label={t('applications.filterDegree')}
            value={filters.degree ?? ''}
            onChange={(e) =>
              onChange({ ...filters, degree: (e.target.value || null) as DegreeLevel | null })
            }
          >
            <option value="">
              {t('applications.filterDegree')}: {t('common.all')}
            </option>
            {DEGREE_LEVELS.map((d) => (
              <option key={d} value={d}>
                {t(`enums.degree.${d}`)}
              </option>
            ))}
          </Select>
          <Select
            aria-label={t('applications.filterIntake')}
            value={filters.year ?? ''}
            onChange={(e) =>
              onChange({ ...filters, year: e.target.value ? Number(e.target.value) : null })
            }
          >
            <option value="">
              {t('applications.filterIntake')}: {t('common.all')}
            </option>
            {yearOptions().map((y) => (
              <option key={y} value={y}>
                {fmt.number(y, { useGrouping: false })}
              </option>
            ))}
          </Select>
          {showStatus && (
            <fieldset className="sm:col-span-3">
              <legend className="mb-2 text-xs font-medium text-muted">
                {t('applications.filterStatus')}
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {APPLICATION_STATUSES.map((status) => {
                  const selected = filters.statuses.includes(status);
                  return (
                    <button
                      key={status}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        onChange({
                          ...filters,
                          statuses: selected
                            ? filters.statuses.filter((s) => s !== status)
                            : [...filters.statuses, status],
                        })
                      }
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                        selected
                          ? 'border-primary bg-primary-soft text-primary'
                          : 'border-border text-muted hover:text-fg',
                      )}
                    >
                      <StatusDot status={status} />
                      {t(`enums.status.${status}`)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
        </div>
      )}
    </div>
  );
}
