import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en';
import { fa } from './locales/fa';
import type { AppLocale } from '@/lib/dates';

export const LOCALE_STORAGE_KEY = 'applyhub.locale';
export const DEFAULT_LOCALE: AppLocale = 'fa';

export function readStoredLocale(): AppLocale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === 'fa' || stored === 'en') return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

export function applyDocumentLocale(locale: AppLocale): void {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'fa' ? 'rtl' : 'ltr';
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fa: { translation: fa },
  },
  lng: readStoredLocale(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
