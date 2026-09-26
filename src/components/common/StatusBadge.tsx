import { useTranslation } from 'react-i18next';
import { STATUS_STYLE, type ApplicationStatus } from '@/lib/domain';
import { cn } from '@/lib/utils';

export function StatusBadge({
  status,
  className,
}: {
  status: ApplicationStatus;
  className?: string;
}) {
  const { t } = useTranslation();
  const style = STATUS_STYLE[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        style.badge,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', style.dot)} aria-hidden />
      {t(`enums.status.${status}`)}
    </span>
  );
}

export function StatusDot({
  status,
  className,
}: {
  status: ApplicationStatus;
  className?: string;
}) {
  return (
    <span
      className={cn('inline-block size-2 rounded-full', STATUS_STYLE[status].dot, className)}
      aria-hidden
    />
  );
}
