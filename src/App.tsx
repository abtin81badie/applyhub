import { QueryClientProvider } from '@tanstack/react-query';
import { Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { RouterProvider } from 'react-router/dom';
import { env, envErrors } from '@/lib/env';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/providers/AuthProvider';
import { ConfirmProvider } from '@/providers/ConfirmProvider';
import { PreferencesProvider } from '@/providers/PreferencesProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { router } from '@/router';

function ConfigError() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 p-6 text-center">
      <Settings className="size-10 text-primary" aria-hidden />
      <h1 className="text-2xl font-bold">{t('errors.configTitle')}</h1>
      <p className="text-muted">{t('errors.configBody')}</p>
      {import.meta.env.DEV && (
        <pre className="ltr-island w-full overflow-x-auto rounded-lg bg-surface-2 p-3 text-start text-xs">
          {envErrors.join('\n')}
        </pre>
      )}
    </main>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        {env ? (
          <AuthProvider>
            <ToastProvider>
              <ConfirmProvider>
                <RouterProvider router={router} />
              </ConfirmProvider>
            </ToastProvider>
          </AuthProvider>
        ) : (
          <ConfigError />
        )}
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
