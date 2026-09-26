import { MailCheck, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { appUrl } from '@/lib/env';
import { describeAuthError } from '@/lib/errors';
import { rememberNext, safeNextPath } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { zodFieldErrors } from '@/lib/validation';
import { AuthCard, Divider, OAuthButtons } from './components';

const passwordSignupSchema = z
  .object({
    displayName: z.string().trim().min(1, 'validation.required').max(80),
    email: z.email('validation.invalidEmail'),
    password: z.string().min(8, 'auth.passwordHint').max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'auth.passwordsMismatch',
  });

const linkSignupSchema = z.object({
  displayName: z.string().trim().min(1, 'validation.required').max(80),
  email: z.email('validation.invalidEmail'),
});

export default function SignupPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.signUp'));
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('next'), '/onboarding');

  const [mode, setMode] = useState<'password' | 'link'>('password');
  const [form, setForm] = useState({ displayName: '', email: '', password: '', confirm: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const schema = mode === 'password' ? passwordSignupSchema : linkSignupSchema;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error, t));
      return;
    }
    setFieldErrors({});
    setBusy(true);
    rememberNext(next);
    const email = form.email.trim();
    const data = { display_name: form.displayName.trim() };

    if (mode === 'password') {
      const { data: result, error: signUpError } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: { data, emailRedirectTo: appUrl('auth/callback') },
      });
      setBusy(false);
      if (signUpError) {
        setError(describeAuthError(signUpError, t));
        return;
      }
      if (result.session) {
        // E-mail confirmation is disabled in this project: the user is signed in.
        navigate('/onboarding', { replace: true });
        return;
      }
      setSentTo(email);
      return;
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { data, emailRedirectTo: appUrl('auth/callback'), shouldCreateUser: true },
    });
    setBusy(false);
    if (otpError) {
      setError(describeAuthError(otpError, t));
      return;
    }
    setSentTo(email);
  };

  if (sentTo) {
    return (
      <AuthCard title={t('auth.signup.checkEmailTitle')}>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-success-soft text-success">
            <MailCheck className="size-7" aria-hidden />
          </div>
          <p className="text-sm">{t('auth.signup.checkEmailBody', { email: sentTo })}</p>
          <Link to="/login" className="text-sm font-medium text-primary hover:underline">
            {t('auth.callback.backToLogin')}
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t('auth.signup.title')}
      subtitle={t('auth.signup.subtitle')}
      footer={
        <>
          {t('auth.signup.haveAccount')}{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t('auth.signup.signIn')}
          </Link>
        </>
      }
    >
      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}
      <OAuthButtons next={next} onError={setError} />
      <Divider label={t('auth.or')} />

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label={t('auth.displayName')} htmlFor="signup-name" error={fieldErrors.displayName}>
          <Input
            id="signup-name"
            autoComplete="name"
            dir="auto"
            value={form.displayName}
            onChange={set('displayName')}
            maxLength={80}
            aria-invalid={Boolean(fieldErrors.displayName) || undefined}
          />
        </Field>
        <Field label={t('auth.email')} htmlFor="signup-email" error={fieldErrors.email}>
          <Input
            id="signup-email"
            type="email"
            dir="ltr"
            autoComplete="email"
            placeholder={t('auth.emailPlaceholder')}
            value={form.email}
            onChange={set('email')}
            aria-invalid={Boolean(fieldErrors.email) || undefined}
          />
        </Field>
        {mode === 'password' && (
          <>
            <Field
              label={t('auth.password')}
              htmlFor="signup-password"
              hint={t('auth.passwordHint')}
              error={fieldErrors.password}
            >
              <Input
                id="signup-password"
                type="password"
                dir="ltr"
                autoComplete="new-password"
                value={form.password}
                onChange={set('password')}
                aria-invalid={Boolean(fieldErrors.password) || undefined}
              />
            </Field>
            <Field
              label={t('auth.confirmPassword')}
              htmlFor="signup-confirm"
              error={fieldErrors.confirm}
            >
              <Input
                id="signup-confirm"
                type="password"
                dir="ltr"
                autoComplete="new-password"
                value={form.confirm}
                onChange={set('confirm')}
                aria-invalid={Boolean(fieldErrors.confirm) || undefined}
              />
            </Field>
          </>
        )}

        <p className="flex gap-2 rounded-lg bg-surface-2 p-3 text-xs text-muted">
          <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
          {t('auth.signup.agreement')}
        </p>

        <Button type="submit" size="lg" loading={busy}>
          {mode === 'password' ? t('auth.signup.submit') : t('auth.login.sendLink')}
        </Button>
        <Button
          variant="link"
          className="self-center text-sm"
          onClick={() => {
            setMode((m) => (m === 'password' ? 'link' : 'password'));
            setFieldErrors({});
          }}
        >
          {mode === 'password' ? t('auth.signup.withLink') : t('auth.signup.withPassword')}
        </Button>
      </form>
    </AuthCard>
  );
}
