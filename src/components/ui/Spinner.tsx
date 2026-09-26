import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-muted', className)} aria-hidden />;
}

export function PageLoader({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted"
      role="status"
    >
      <Spinner className="size-7" />
      <span className="text-sm">{label ?? t('common.loading')}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-2', className)} aria-hidden />;
}
