import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { PageLoader } from '@/components/ui/Spinner';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { describeAuthError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { AuthCard } from './components';

/** Set a new password (reached from the recovery e-mail, or while signed in). */
export default function ResetPasswordPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('auth.reset.title'));
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <PageLoader />;

  if (!session) {
    return (
      <AuthCard title={t('auth.reset.title')}>
        <Alert tone="info">{t('auth.reset.noSession')}</Alert>
        <div className="mt-4 text-center">
          <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            {t('auth.forgot.title')}
          </Link>
        </div>
      </AuthCard>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t('auth.passwordHint'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.passwordsMismatch'));
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(describeAuthError(updateError, t));
      return;
    }
    toast.success(t('auth.reset.success'));
    navigate('/dashboard', { replace: true });
  };

  return (
    <AuthCard title={t('auth.reset.title')} subtitle={t('auth.reset.subtitle')}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label={t('auth.newPassword')} htmlFor="new-password">
          <Input
            id="new-password"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label={t('auth.confirmPassword')} htmlFor="confirm-password">
          <Input
            id="confirm-password"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <Button type="submit" size="lg" loading={busy}>
          {t('auth.reset.submit')}
        </Button>
      </form>
    </AuthCard>
  );
}
