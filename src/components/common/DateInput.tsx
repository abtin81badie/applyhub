import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addMonths,
  dateToCalendarDate,
  formatDayNumber,
  isSameDay,
  monthGrid,
  toDate,
  toIsoDate,
  weekdayNames,
} from '@/lib/dates';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/providers/PreferencesProvider';

/**
 * Calendar-aware date picker. The grid follows the user's calendar
 * preference (Solar Hijri or Gregorian); the value is always an ISO
 * "YYYY-MM-DD" string (or null).
 */
export function DateInput({
  id,
  value,
  onChange,
  placeholder,
  invalid,
  disabled,
  clearable = true,
}: {
  id?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  clearable?: boolean;
}) {
  const { t } = useTranslation();
  const { locale, calendar, fmt } = usePreferences();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const selected = toDate(value);
  const [view, setView] = useState(() => {
    const c = dateToCalendarDate(selected ?? new Date(), calendar);
    return { year: c.year, month: c.month };
  });

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openPicker = () => {
    const c = dateToCalendarDate(selected ?? new Date(), calendar);
    setView({ year: c.year, month: c.month });
    setOpen(true);
  };

  const cells = monthGrid(view.year, view.month, calendar);
  const weekdays = weekdayNames({ locale, calendar });
  const today = new Date();
  const fmtOpts = { locale, calendar };

  return (
    <div ref={rootRef} className="relative">
      <div className="flex gap-1">
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? popoverId : undefined}
          aria-invalid={invalid || undefined}
          onClick={() => (open ? setOpen(false) : openPicker())}
          className={cn(
            'flex h-10 w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 text-start text-sm shadow-xs',
            'focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-60',
            invalid && 'border-danger',
          )}
        >
          <CalendarDays className="size-4 shrink-0 text-muted" aria-hidden />
          <span className={cn('truncate', !selected && 'text-muted/70')}>
            {selected ? fmt.date(selected, 'long') : (placeholder ?? t('date.pick'))}
          </span>
        </button>
        {clearable && selected && !disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="grid size-10 shrink-0 place-items-center rounded-lg border border-border text-muted hover:bg-surface-2 hover:text-fg"
            aria-label={t('date.clear')}
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {open && (
        <div
          id={popoverId}
          role="dialog"
          aria-label={t('date.pick')}
          className="absolute start-0 top-full z-50 mt-1 w-72 rounded-xl border border-border bg-surface p-3 shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setView((v) => addMonths(v, -1))}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg"
              aria-label={t('date.prevMonth')}
            >
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </button>
            <span className="text-sm font-semibold">{fmt.monthYear(view.year, view.month)}</span>
            <button
              type="button"
              onClick={() => setView((v) => addMonths(v, 1))}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg"
              aria-label={t('date.nextMonth')}
            >
              <ChevronRight className="size-4 rtl:rotate-180" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-muted">
            {weekdays.map((day, index) => (
              <span key={index} className="py-1">
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map(({ date, inMonth }) => {
              const isSelected = selected ? isSameDay(date, selected) : false;
              const isToday = isSameDay(date, today);
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => {
                    onChange(toIsoDate(date));
                    setOpen(false);
                  }}
                  aria-pressed={isSelected}
                  aria-label={fmt.date(date, 'long')}
                  className={cn(
                    'aspect-square rounded-lg text-sm transition-colors',
                    inMonth ? 'text-fg' : 'text-muted/50',
                    isSelected ? 'bg-primary text-primary-fg' : 'hover:bg-surface-2',
                    isToday && !isSelected && 'ring-1 ring-primary',
                  )}
                >
                  {formatDayNumber(date, fmtOpts)}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft"
              onClick={() => {
                onChange(toIsoDate(today));
                setOpen(false);
              }}
            >
              {t('date.today')}
            </button>
            {clearable && (
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-2"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                {t('date.clear')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
