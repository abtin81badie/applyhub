import { jalaaliMonthLength, toGregorian, toJalaali } from 'jalaali-js';

export type CalendarSystem = 'jalali' | 'gregorian';
export type AppLocale = 'fa' | 'en';

const DAY_MS = 24 * 60 * 60 * 1000;

/** BCP-47 locale for Intl, including the calendar extension. */
export function intlLocale(locale: AppLocale, calendar: CalendarSystem): string {
  const base = locale === 'fa' ? 'fa-IR' : 'en-GB';
  return calendar === 'jalali' ? `${base}-u-ca-persian` : `${base}-u-ca-gregory`;
}

export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  // A plain calendar date ("2027-01-15") is interpreted as local midnight so it
  // is displayed as the same day in every time zone.
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (plain) {
    return new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3]));
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface FormatOptions {
  locale: AppLocale;
  calendar: CalendarSystem;
}

export function formatDate(
  value: string | Date | null | undefined,
  { locale, calendar }: FormatOptions,
  style: 'short' | 'medium' | 'long' = 'medium',
): string {
  const d = toDate(value);
  if (!d) return '';
  const opts: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { year: 'numeric', month: '2-digit', day: '2-digit' }
      : style === 'long'
        ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
        : { year: 'numeric', month: 'short', day: 'numeric' };
  return new Intl.DateTimeFormat(intlLocale(locale, calendar), opts).format(d);
}

export function formatDateTime(
  value: string | Date | null | undefined,
  { locale, calendar }: FormatOptions,
): string {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat(intlLocale(locale, calendar), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatMonthYear(
  year: number,
  month: number,
  { locale, calendar }: FormatOptions,
): string {
  // Pick a day in the middle of the month so time zones cannot shift it.
  const d = calendarDateToDate({ year, month, day: 15 }, calendar);
  return new Intl.DateTimeFormat(intlLocale(locale, calendar), {
    year: 'numeric',
    month: 'long',
  }).format(d);
}

/** "in 3 days", "2 hours ago" … */
export function formatRelative(
  value: string | Date | null | undefined,
  locale: AppLocale,
  now: Date = new Date(),
): string {
  const d = toDate(value);
  if (!d) return '';
  const diffSec = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(locale === 'fa' ? 'fa-IR' : 'en', { numeric: 'auto' });
  if (abs < 60) return rtf.format(diffSec, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), 'month');
  return rtf.format(Math.round(diffSec / (86400 * 365)), 'year');
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/** Whole days from today (local) until the given date; negative when past. */
export function daysUntil(value: string | Date | null | undefined, now: Date = new Date()): number {
  const d = toDate(value);
  if (!d) return Number.NaN;
  return Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

/** "YYYY-MM-DD" in local time, suitable for Postgres `date` columns. */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Combines an ISO date and an optional "HH:MM" local time into a UTC ISO timestamp (default 23:59). */
export function combineIsoDate(date: string, time?: string | null): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time && /^\d{2}:\d{2}$/.test(time) ? time : '23:59').split(':').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, hh ?? 23, mm ?? 59).toISOString();
}

/** Splits a timestamp into local "YYYY-MM-DD" and "HH:MM" parts for editing. */
export function splitIsoDateTime(value: string | null | undefined): {
  date: string | null;
  time: string;
} {
  const d = toDate(value);
  if (!d) return { date: null, time: '23:59' };
  return {
    date: toIsoDate(d),
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  };
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ---------------------------------------------------------------------------
// Calendar-system arithmetic (used by the date picker and the month grid)
// ---------------------------------------------------------------------------

export interface CalendarDate {
  year: number;
  /** 1-based month in the given calendar system. */
  month: number;
  day: number;
}

export function dateToCalendarDate(d: Date, calendar: CalendarSystem): CalendarDate {
  if (calendar === 'gregorian') {
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }
  const j = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return { year: j.jy, month: j.jm, day: j.jd };
}

export function calendarDateToDate(c: CalendarDate, calendar: CalendarSystem): Date {
  if (calendar === 'gregorian') return new Date(c.year, c.month - 1, c.day);
  const g = toGregorian(c.year, c.month, c.day);
  return new Date(g.gy, g.gm - 1, g.gd);
}

export function monthLength(year: number, month: number, calendar: CalendarSystem): number {
  if (calendar === 'jalali') return jalaaliMonthLength(year, month);
  return new Date(year, month, 0).getDate();
}

export function addMonths(
  { year, month }: { year: number; month: number },
  delta: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** First day of the week: Saturday for the Persian calendar, Monday otherwise. */
export function weekStartsOn(calendar: CalendarSystem): number {
  return calendar === 'jalali' ? 6 : 1;
}

/**
 * Returns the days to render for a month view, padded with the trailing days of
 * the previous month and leading days of the next month (always 6 weeks).
 */
export function monthGrid(
  year: number,
  month: number,
  calendar: CalendarSystem,
): { date: Date; inMonth: boolean }[] {
  const first = calendarDateToDate({ year, month, day: 1 }, calendar);
  const offset = (first.getDay() - weekStartsOn(calendar) + 7) % 7;
  const start = addDays(first, -offset);
  const length = monthLength(year, month, calendar);
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = addDays(start, i);
    const index = i - offset;
    cells.push({ date, inMonth: index >= 0 && index < length });
  }
  return cells;
}

/** Localized short weekday names starting at the calendar's first weekday. */
export function weekdayNames({ locale, calendar }: FormatOptions): string[] {
  const fmt = new Intl.DateTimeFormat(intlLocale(locale, calendar), { weekday: 'narrow' });
  const start = weekStartsOn(calendar);
  // 2023-01-01 was a Sunday (getDay() === 0).
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + ((start + i) % 7))));
}

export function formatDayNumber(d: Date, { locale, calendar }: FormatOptions): string {
  return new Intl.DateTimeFormat(intlLocale(locale, calendar), { day: 'numeric' }).format(d);
}

/** Staleness rule from the product spec: verified facts older than 6 months get a warning. */
export const STALE_AFTER_MONTHS = 6;

export function isStale(
  lastVerifiedAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const d = toDate(lastVerifiedAt);
  if (!d) return true;
  const threshold = new Date(now);
  threshold.setMonth(threshold.getMonth() - STALE_AFTER_MONTHS);
  return d.getTime() < threshold.getTime();
}
