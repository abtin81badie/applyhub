import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Tables } from '@/lib/database.types';
import type { AppLocale } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { usePreferences } from '@/providers/PreferencesProvider';

export type Country = Tables<'countries'>;

export function useCountries() {
  return useQuery({
    queryKey: ['countries'],
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('countries').select('*').order('name_en');
      if (error) throw error;
      return data;
    },
  });
}

export function countryLabel(
  country: Pick<Country, 'name_en' | 'name_fa'>,
  locale: AppLocale,
): string {
  return locale === 'fa' ? country.name_fa : country.name_en;
}

/** Map code → country plus a localized name lookup. */
export function useCountryLookup() {
  const { data } = useCountries();
  const { locale } = usePreferences();
  return useMemo(() => {
    const map = new Map<string, Country>((data ?? []).map((c) => [c.code, c]));
    return {
      countries: data ?? [],
      get: (code: string | null | undefined) => (code ? map.get(code) : undefined),
      name: (code: string | null | undefined) => {
        if (!code) return '';
        const country = map.get(code);
        return country ? countryLabel(country, locale) : code;
      },
      flag: (code: string | null | undefined) => (code ? (map.get(code)?.flag_emoji ?? '') : ''),
    };
  }, [data, locale]);
}
