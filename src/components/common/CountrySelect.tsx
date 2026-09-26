import { X } from 'lucide-react';
import type { SelectHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { countryLabel, useCountries } from '@/features/kb/countries';
import { Select } from '@/components/ui/Input';
import { usePreferences } from '@/providers/PreferencesProvider';

const REGION_ORDER = ['europe', 'americas', 'asia', 'oceania', 'africa', 'other'] as const;

export function CountrySelect({
  value,
  onChange,
  placeholder,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> & {
  value: string | null | undefined;
  onChange: (code: string | null) => void;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const { data: countries = [] } = useCountries();
  const sorted = [...countries].sort((a, b) =>
    countryLabel(a, locale).localeCompare(countryLabel(b, locale), locale),
  );
  return (
    <Select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} {...props}>
      <option value="">{placeholder ?? t('common.select')}</option>
      {REGION_ORDER.map((region) => {
        const items = sorted.filter((c) => c.region === region);
        if (items.length === 0) return null;
        return (
          <optgroup key={region} label={t(`kb.regions.${region}`)}>
            {items.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag_emoji} {countryLabel(c, locale)}
              </option>
            ))}
          </optgroup>
        );
      })}
    </Select>
  );
}

export function CountryMultiSelect({
  id,
  value,
  onChange,
  max = 30,
}: {
  id?: string;
  value: string[];
  onChange: (codes: string[]) => void;
  max?: number;
}) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const { data: countries = [] } = useCountries();
  const byCode = new Map(countries.map((c) => [c.code, c]));
  return (
    <div className="flex flex-col gap-2">
      <CountrySelect
        id={id}
        value=""
        placeholder={t('common.add')}
        disabled={value.length >= max}
        onChange={(code) => {
          if (code && !value.includes(code)) onChange([...value, code]);
        }}
      />
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((code) => {
            const country = byCode.get(code);
            return (
              <li key={code}>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 py-0.5 ps-2.5 pe-1 text-sm">
                  {country?.flag_emoji} {country ? countryLabel(country, locale) : code}
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((c) => c !== code))}
                    className="rounded-full p-0.5 text-muted hover:bg-surface-3 hover:text-fg"
                    aria-label={`${t('common.remove')} ${country ? countryLabel(country, locale) : code}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
