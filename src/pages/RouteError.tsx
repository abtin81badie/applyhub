import { AlertOctagon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Button } from '@/components/ui/Button';
import NotFoundPage from './NotFoundPage';

export function RouteError() {
  const { t } = useTranslation();
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <NotFoundPage />
      </div>
    );
  }
  // Lazy chunks can go missing after a deploy; a reload fetches the new build.
  const chunkError =
    error instanceof Error && /dynamically imported module|Loading chunk/i.test(error.message);
  if (import.meta.env.DEV) console.error(error);
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertOctagon className="size-10 text-danger" aria-hidden />
      <div>
        <h1 className="text-xl font-bold">{t('errors.genericTitle')}</h1>
        <p className="mt-1 text-sm text-muted">{t('errors.genericBody')}</p>
      </div>
      <Button onClick={() => window.location.reload()}>
        {chunkError ? t('common.retry') : t('common.retry')}
      </Button>
    </div>
  );
}
