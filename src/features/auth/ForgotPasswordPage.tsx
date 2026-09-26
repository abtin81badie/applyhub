import { MailCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { z } from 'zod';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { appUrl } from '@/lib/env';
import { describeAuthError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { AuthCard } from './components';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('auth.forgot.title'));
  const [email, setEmail] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!z.email().safeParse(email.trim()).success) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: appUrl('auth/reset-password'),
    });
    setBusy(false);
    if (resetError) {
      setError(describeAuthError(resetError, t));
      return;
    }
    setSent(true);
  };

  return (
    <AuthCard
      title={t('auth.forgot.title')}
      subtitle={sent ? undefined : t('auth.forgot.subtitle')}
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          {t('auth.callback.backToLogin')}
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-success-soft text-success">
            <MailCheck className="size-6" aria-hidden />
          </div>
          <p className="text-sm">{t('auth.forgot.sent', { email: email.trim() })}</p>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <Alert tone="danger">{error}</Alert>}
          <Field
            label={t('auth.email')}
            htmlFor="forgot-email"
            error={invalid ? t('validation.invalidEmail') : null}
          >
            <Input
              id="forgot-email"
              type="email"
              dir="ltr"
              autoComplete="email"
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              aria-invalid={invalid || undefined}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button type="submit" size="lg" loading={busy}>
            {t('auth.forgot.submit')}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
