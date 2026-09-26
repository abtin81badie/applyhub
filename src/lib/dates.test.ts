import { describe, expect, it } from 'vitest';
import {
  addMonths,
  calendarDateToDate,
  combineIsoDate,
  dateToCalendarDate,
  daysUntil,
  formatDate,
  isStale,
  monthGrid,
  monthLength,
  toDate,
  toIsoDate,
} from './dates';

describe('calendar conversion', () => {
  it('converts Gregorian dates to the Solar Hijri calendar', () => {
    expect(dateToCalendarDate(new Date(2026, 8, 26), 'jalali')).toEqual({
      year: 1405,
      month: 7,
      day: 4,
    });
    expect(dateToCalendarDate(new Date(2026, 2, 21), 'jalali')).toEqual({
      year: 1405,
      month: 1,
      day: 1,
    });
  });

  it('round-trips through both calendars', () => {
    const d = new Date(2027, 0, 15);
    for (const calendar of ['jalali', 'gregorian'] as const) {
      const c = dateToCalendarDate(d, calendar);
      expect(toIsoDate(calendarDateToDate(c, calendar))).toBe('2027-01-15');
    }
  });

  it('knows month lengths', () => {
    expect(monthLength(1405, 1, 'jalali')).toBe(31);
    expect(monthLength(1405, 7, 'jalali')).toBe(30);
    expect(monthLength(2028, 2, 'gregorian')).toBe(29);
  });

  it('wraps months across years', () => {
    expect(addMonths({ year: 1405, month: 12 }, 1)).toEqual({ year: 1406, month: 1 });
    expect(addMonths({ year: 2027, month: 1 }, -1)).toEqual({ year: 2026, month: 12 });
  });

  it('builds a 6-week month grid starting on Saturday for the Persian calendar', () => {
    const cells = monthGrid(1405, 7, 'jalali');
    expect(cells).toHaveLength(42);
    expect(cells[0]!.date.getDay()).toBe(6);
    const inMonth = cells.filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(30);
    expect(toIsoDate(inMonth[0]!.date)).toBe('2026-09-23');
  });

  it('starts Gregorian weeks on Monday', () => {
    expect(monthGrid(2026, 9, 'gregorian')[0]!.date.getDay()).toBe(1);
  });
});

describe('formatting and parsing', () => {
  it('formats Persian dates with Persian digits', () => {
    const text = formatDate('2026-09-26', { locale: 'fa', calendar: 'jalali' });
    expect(text).toContain('۱۴۰۵');
  });

  it('formats Gregorian dates in English', () => {
    expect(formatDate('2026-09-26', { locale: 'en', calendar: 'gregorian' })).toContain('2026');
  });

  it('treats plain dates as local calendar days', () => {
    expect(toIsoDate(toDate('2027-01-15')!)).toBe('2027-01-15');
    expect(toDate('not a date')).toBeNull();
  });

  it('counts days until a date', () => {
    const now = new Date(2026, 8, 26, 22, 0);
    expect(daysUntil('2026-09-27', now)).toBe(1);
    expect(daysUntil('2026-09-20', now)).toBe(-6);
  });

  it('combines a date with a local time into a UTC timestamp', () => {
    const iso = combineIsoDate('2027-01-15', '09:30');
    const d = new Date(iso);
    expect(d.getFullYear()).toBe(2027);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(30);
  });
});

describe('staleness', () => {
  const now = new Date(2026, 8, 26);
  it('flags facts older than six months', () => {
    expect(isStale('2026-01-01', now)).toBe(true);
    expect(isStale('2026-08-01', now)).toBe(false);
  });
  it('treats unverified facts as stale', () => {
    expect(isStale(null, now)).toBe(true);
  });
});
