import { XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { PageLoader } from '@/components/ui/Spinner';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { consumeNext } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { AuthCard } from './components';

/** Reads an error returned by Supabase Auth in the query string or the hash. */
function urlError(): string | null {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return (
    query.get('error_description') ??
    hash.get('error_description') ??
    query.get('error') ??
    hash.get('error')
  );
}

/**
 * Landing page for OAuth and e-mail links. supabase-js reads the tokens from
 * the URL on start-up (detectSessionInUrl); we wait for the session and then
 * continue to the page the user wanted.
 */
export default function AuthCallbackPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('auth.callback.signingIn'));
  const navigate = useNavigate();
  const [failed, setFailed] = useState<string | null>(() => urlError());

  useEffect(() => {
    if (failed) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const isRecovery = window.location.hash.includes('type=recovery');
      navigate(isRecovery ? '/auth/reset-password' : consumeNext(), { replace: true });
    };

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish();
    });
    void supabase.auth.getSession().then(({ data: current }) => {
      if (current.session) finish();
    });
    const timer = window.setTimeout(() => {
      if (!done) setFailed(t('auth.callback.failedBody'));
    }, 12_000);

    return () => {
      data.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, [failed, navigate, t]);

  if (!failed) return <PageLoader label={t('auth.callback.signingIn')} />;

  return (
    <AuthCard title={t('auth.callback.failedTitle')}>
      <div className="flex flex-col items-center gap-3 text-center">
        <XCircle className="size-10 text-danger" aria-hidden />
        <p className="text-sm text-muted">{t('auth.callback.failedBody')}</p>
        <p className="ltr-island text-xs text-muted">{failed}</p>
        <Link to="/login" className="text-sm font-medium text-primary hover:underline">
          {t('auth.callback.backToLogin')}
        </Link>
      </div>
    </AuthCard>
  );
}
