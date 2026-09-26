import { CalendarRange, ChevronLeft, ChevronRight, ListOrdered } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { DaysLeft } from '@/components/common/DaysLeft';
import { StatusBadge, StatusDot } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SegmentedControl } from '@/components/ui/Tabs';
import {
  addMonths,
  dateToCalendarDate,
  formatDayNumber,
  isSameDay,
  monthGrid,
  toIsoDate,
  weekdayNames,
} from '@/lib/dates';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/providers/PreferencesProvider';
import type { ApplicationWithDetails } from './api';
import { collectDeadlines, type DeadlineItem } from './logic';

function DeadlineRow({ item }: { item: DeadlineItem }) {
  const { fmt } = usePreferences();
  const { t } = useTranslation();
  return (
    <li>
      <Link
        to={`/applications/${item.app.id}`}
        className={cn(
          'flex items-center gap-3 rounded-lg border border-border bg-surface p-3 hover:border-primary/40',
          item.deadline.is_done && 'opacity-60',
        )}
      >
        <div className="w-24 shrink-0 text-center">
          <p className="text-sm font-semibold">{fmt.date(item.deadline.due_at, 'short')}</p>
          <DaysLeft date={item.deadline.due_at} done={item.deadline.is_done} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium" dir="auto">
            {item.app.university_name}
          </p>
          <p className="truncate text-xs text-muted" dir="auto">
            {[item.deadline.label || t('applications.detail.deadlines'), item.app.program_name]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <StatusBadge status={item.app.status} className="hidden sm:inline-flex" />
      </Link>
    </li>
  );
}

export function DeadlineCalendar({ apps }: { apps: ApplicationWithDetails[] }) {
  const { t } = useTranslation();
  const { locale, calendar, fmt } = usePreferences();
  const [mode, setMode] = useState<'month' | 'timeline'>('month');
  const [view, setView] = useState(() => {
    const c = dateToCalendarDate(new Date(), calendar);
    return { year: c.year, month: c.month };
  });
  // Re-anchor the visible month when the calendar system changes.
  const [lastCalendar, setLastCalendar] = useState(calendar);
  if (lastCalendar !== calendar) {
    setLastCalendar(calendar);
    const c = dateToCalendarDate(new Date(), calendar);
    setView({ year: c.year, month: c.month });
  }

  const items = useMemo(() => collectDeadlines(apps), [apps]);
  const byDay = useMemo(() => {
    const map = new Map<string, DeadlineItem[]>();
    for (const item of items) {
      const key = toIsoDate(new Date(item.deadline.due_at));
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [items]);

  const cells = monthGrid(view.year, view.month, calendar);
  const inMonthKeys = new Set(cells.filter((c) => c.inMonth).map((c) => toIsoDate(c.date)));
  const monthItems = items.filter((item) =>
    inMonthKeys.has(toIsoDate(new Date(item.deadline.due_at))),
  );
  const today = new Date();
  const weekdays = weekdayNames({ locale, calendar });

  const upcoming = items.filter((i) => new Date(i.deadline.due_at) >= today || !i.deadline.is_done);
  const past = items.filter((i) => !upcoming.includes(i));
  const upcomingByMonth = new Map<string, DeadlineItem[]>();
  for (const item of upcoming) {
    const c = dateToCalendarDate(new Date(item.deadline.due_at), calendar);
    const key = `${c.year}-${c.month}`;
    upcomingByMonth.set(key, [...(upcomingByMonth.get(key) ?? []), item]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label={t('applications.viewCalendar')}
          value={mode}
          onChange={setMode}
          items={[
            { value: 'month', label: t('applications.calendar.month'), icon: CalendarRange },
            { value: 'timeline', label: t('applications.calendar.timeline'), icon: ListOrdered },
          ]}
        />
        {mode === 'month' && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setView((v) => addMonths(v, -1))}
              aria-label={t('applications.calendar.prevMonth')}
            >
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </Button>
            <span className="min-w-36 text-center font-semibold">
              {fmt.monthYear(view.year, view.month)}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setView((v) => addMonths(v, 1))}
              aria-label={t('applications.calendar.nextMonth')}
            >
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const c = dateToCalendarDate(new Date(), calendar);
                setView({ year: c.year, month: c.month });
              }}
            >
              {t('applications.calendar.today')}
            </Button>
          </div>
        )}
      </div>

      {mode === 'month' ? (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="grid grid-cols-7 border-b border-border bg-surface-2/60 text-center text-xs font-medium text-muted">
              {weekdays.map((day, i) => (
                <div key={i} className="py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map(({ date, inMonth }) => {
                const key = toIsoDate(date);
                const dayItems = byDay.get(key) ?? [];
                const isToday = isSameDay(date, today);
                return (
                  <div
                    key={key}
                    className={cn(
                      'min-h-14 border-e border-b border-border p-1 sm:min-h-24 sm:p-1.5',
                      !inMonth && 'bg-surface-2/40 text-muted/60',
                    )}
                  >
                    <div
                      className={cn(
                        'mb-1 grid size-6 place-items-center rounded-full text-xs',
                        isToday && 'bg-primary font-semibold text-primary-fg',
                      )}
                    >
                      {formatDayNumber(date, { locale, calendar })}
                    </div>
                    {/* Phones: dots; larger screens: labels */}
                    <div className="flex flex-wrap gap-0.5 sm:hidden">
                      {dayItems.slice(0, 4).map((item) => (
                        <StatusDot key={item.deadline.id} status={item.app.status} />
                      ))}
                    </div>
                    <ul className="hidden flex-col gap-0.5 sm:flex">
                      {dayItems.slice(0, 3).map((item) => (
                        <li key={item.deadline.id}>
                          <Link
                            to={`/applications/${item.app.id}`}
                            title={`${item.app.university_name} · ${item.deadline.label}`}
                            className={cn(
                              'flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] hover:bg-surface-2',
                              item.deadline.is_done && 'line-through opacity-60',
                            )}
                          >
                            <StatusDot status={item.app.status} className="shrink-0" />
                            <span className="truncate" dir="auto">
                              {item.app.university_name}
                            </span>
                          </Link>
                        </li>
                      ))}
                      {dayItems.length > 3 && (
                        <li className="px-1 text-[11px] text-muted">
                          +{fmt.number(dayItems.length - 3)}
                        </li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
          {monthItems.length === 0 ? (
            <p className="text-center text-sm text-muted">
              {t('applications.calendar.noDeadlines')}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {monthItems.map((item) => (
                <DeadlineRow key={item.deadline.id} item={item} />
              ))}
            </ul>
          )}
        </>
      ) : items.length === 0 ? (
        <EmptyState icon={CalendarRange} title={t('applications.calendar.noDeadlines')} />
      ) : (
        <div className="flex flex-col gap-6">
          {[...upcomingByMonth.entries()].map(([key, group]) => {
            const [y, m] = key.split('-').map(Number);
            return (
              <section key={key}>
                <h3 className="mb-2 text-sm font-semibold text-muted">{fmt.monthYear(y!, m!)}</h3>
                <ul className="flex flex-col gap-2 border-s-2 border-primary/30 ps-3">
                  {group.map((item) => (
                    <DeadlineRow key={item.deadline.id} item={item} />
                  ))}
                </ul>
              </section>
            );
          })}
          {past.length > 0 && (
            <details className="rounded-xl border border-border bg-surface p-3">
              <summary className="cursor-pointer text-sm font-medium text-muted">
                {t('applications.calendar.past')} ({fmt.number(past.length)})
              </summary>
              <ul className="mt-3 flex flex-col gap-2">
                {past.map((item) => (
                  <DeadlineRow key={item.deadline.id} item={item} />
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
