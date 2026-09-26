import { useTranslation } from 'react-i18next';
import type { IntakeTerm } from '@/lib/domain';
import { useFormat } from '@/providers/PreferencesProvider';

/** "Fall 2027" / "پاییز ۲۰۲۷" */
export function useIntakeLabel() {
  const { t } = useTranslation();
  const fmt = useFormat();
  return (term: IntakeTerm | null | undefined, year: number | null | undefined): string => {
    const parts: string[] = [];
    if (term) parts.push(t(`enums.intakeTerm.${term}`));
    if (year) parts.push(fmt.number(year, { useGrouping: false }));
    return parts.join(' ');
  };
}
