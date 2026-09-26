import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { LOCALE_STORAGE_KEY, applyDocumentLocale, readStoredLocale } from '@/i18n';
import {
  formatDate,
  formatDateTime,
  formatMonthYear,
  formatRelative,
  type AppLocale,
  type CalendarSystem,
} from '@/lib/dates';

export type ThemePreference = 'light' | 'dark' | 'system';

const CALENDAR_KEY = 'applyhub.calendar';
const THEME_KEY = 'applyhub.theme';

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export interface Formatters {
  date: (value: string | Date | null | undefined, style?: 'short' | 'medium' | 'long') => string;
  dateTime: (value: string | Date | null | undefined) => string;
  relative: (value: string | Date | null | undefined) => string;
  monthYear: (year: number, month: number) => string;
  number: (value: number | null | undefined, options?: Intl.NumberFormatOptions) => string;
  money: (amount: number | null | undefined, currency: string | null | undefined) => string;
}

interface PreferencesValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  calendar: CalendarSystem;
  setCalendar: (calendar: CalendarSystem) => void;
  theme: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemePreference) => void;
  dir: 'rtl' | 'ltr';
  fmt: Formatters;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [locale, setLocaleState] = useState<AppLocale>(() => readStoredLocale());
  const [calendarOverride, setCalendarOverride] = useState<CalendarSystem | null>(() => {
    const stored = readStorage(CALENDAR_KEY);
    return stored === 'jalali' || stored === 'gregorian' ? stored : null;
  });
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    const stored = readStorage(THEME_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  });
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Persian users usually expect the Solar Hijri calendar; either can be chosen.
  const calendar: CalendarSystem = calendarOverride ?? (locale === 'fa' ? 'jalali' : 'gregorian');
  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    applyDocumentLocale(locale);
    if (i18n.language !== locale) void i18n.changeLanguage(locale);
  }, [locale, i18n]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolvedTheme === 'dark' ? '#0b0f19' : '#4f46e5');
  }, [resolvedTheme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const setLocale = useCallback((next: AppLocale) => {
    writeStorage(LOCALE_STORAGE_KEY, next);
    setLocaleState(next);
  }, []);

  const setCalendar = useCallback((next: CalendarSystem) => {
    writeStorage(CALENDAR_KEY, next);
    setCalendarOverride(next);
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    writeStorage(THEME_KEY, next === 'system' ? null : next);
    setThemeState(next);
  }, []);

  const fmt = useMemo<Formatters>(() => {
    const numberLocale = locale === 'fa' ? 'fa-IR' : 'en-US';
    const opts = { locale, calendar };
    return {
      date: (value, style) => formatDate(value, opts, style),
      dateTime: (value) => formatDateTime(value, opts),
      relative: (value) => formatRelative(value, locale),
      monthYear: (year, month) => formatMonthYear(year, month, opts),
      number: (value, options) =>
        value === null || value === undefined || Number.isNaN(value)
          ? ''
          : new Intl.NumberFormat(numberLocale, options).format(value),
      money: (amount, currency) => {
        if (amount === null || amount === undefined) return '';
        if (!currency) return new Intl.NumberFormat(numberLocale).format(amount);
        try {
          return new Intl.NumberFormat(numberLocale, {
            style: 'currency',
            currency,
            maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
          }).format(amount);
        } catch {
          return `${new Intl.NumberFormat(numberLocale).format(amount)} ${currency}`;
        }
      },
    };
  }, [locale, calendar]);

  const value = useMemo<PreferencesValue>(
    () => ({
      locale,
      setLocale,
      calendar,
      setCalendar,
      theme,
      resolvedTheme,
      setTheme,
      dir: locale === 'fa' ? 'rtl' : 'ltr',
      fmt,
    }),
    [locale, setLocale, calendar, setCalendar, theme, resolvedTheme, setTheme, fmt],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return ctx;
}

/** Shorthand for locale/calendar-aware formatting helpers. */
export function useFormat(): Formatters {
  return usePreferences().fmt;
}
