import { useTranslation } from 'react-i18next';
import { daysUntil } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { useFormat } from '@/providers/PreferencesProvider';

/** "Today", "3 days left", "2 days ago" with urgency colors. */
export function DaysLeft({
  date,
  done = false,
  className,
}: {
  date: string;
  done?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const days = daysUntil(date);
  let text: string;
  if (days === 0) text = t('common.today');
  else if (days === 1) text = t('common.tomorrow');
  else if (days > 0) text = t('common.daysLeft', { count: days });
  else text = t('common.daysAgo', { count: -days });
  const tone = done
    ? 'text-muted line-through'
    : days < 0
      ? 'text-danger'
      : days <= 7
        ? 'text-warning font-semibold'
        : 'text-muted';
  return (
    <span className={cn('text-xs whitespace-nowrap', tone, className)} title={fmt.dateTime(date)}>
      {text}
    </span>
  );
}

export function ProgressBar({
  value,
  className,
  label,
}: {
  value: number;
  className?: string;
  label?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn(
          'h-full rounded-full transition-all',
          pct === 100 ? 'bg-success' : 'bg-primary',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
