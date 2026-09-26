import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { describeError } from '@/lib/errors';
import { Button } from '@/components/ui/Button';

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-xl border border-danger/25 bg-danger-soft px-6 py-8 text-center"
      role="alert"
    >
      <AlertTriangle className="size-6 text-danger" aria-hidden />
      <div>
        <p className="font-semibold">{t('errors.loadFailed')}</p>
        <p className="mt-1 text-sm text-muted">{describeError(error, t)}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}
