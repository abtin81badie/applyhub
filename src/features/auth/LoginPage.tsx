import { KeyRound, Mail, MailCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/Tabs';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { appUrl } from '@/lib/env';
import { describeAuthError } from '@/lib/errors';
import { rememberNext, safeNextPath } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { AuthCard, Divider, OAuthButtons } from './components';

type Method = 'email' | 'password';

const emailSchema = z.email();

export default function LoginPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.signIn'));
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('next'));

  const [method, setMethod] = useState<Method>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validEmail = () => {
    const ok = emailSchema.safeParse(email.trim()).success;
    setEmailError(ok ? null : t('validation.invalidEmail'));
    return ok;
  };

  const sendEmail = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!validEmail()) return;
    setBusy(true);
    rememberNext(next);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: appUrl('auth/callback'), shouldCreateUser: true },
    });
    setBusy(false);
    if (otpError) {
      setError(describeAuthError(otpError, t));
      return;
    }
    setSentTo(email.trim());
  };

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!sentTo) return;
    setError(null);
    setBusy(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: sentTo,
      token: code.replace(/\s/g, ''),
      type: 'email',
    });
    setBusy(false);
    if (verifyError) {
      setError(describeAuthError(verifyError, t));
      return;
    }
    navigate(next, { replace: true });
  };

  const signInWithPassword = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!validEmail()) return;
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (signInError) {
      setError(describeAuthError(signInError, t));
      return;
    }
    navigate(next, { replace: true });
  };

  return (
    <AuthCard
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <>
          {t('auth.login.noAccount')}{' '}
          <Link
            to={`/signup${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="font-medium text-primary hover:underline"
          >
            {t('auth.login.createAccount')}
          </Link>
        </>
      }
    >
      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {sentTo ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-success-soft text-success">
              <MailCheck className="size-6" aria-hidden />
            </div>
            <p className="text-sm">{t('auth.login.linkSent', { email: sentTo })}</p>
          </div>
          <form onSubmit={verifyCode} className="flex flex-col gap-3">
            <Field
              label={t('auth.login.codeLabel')}
              htmlFor="otp-code"
              hint={t('auth.login.codeSent', { email: sentTo })}
            >
              <Input
                id="otp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,8}"
                maxLength={8}
                dir="ltr"
                className="text-center text-lg tracking-[0.4em]"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </Field>
            <Button type="submit" loading={busy} disabled={code.replace(/\s/g, '').length < 6}>
              {t('auth.login.verifyCode')}
            </Button>
          </form>
          <Button
            variant="link"
            className="self-center"
            onClick={() => {
              setSentTo(null);
              setCode('');
              setError(null);
            }}
          >
            {t('auth.login.useDifferentEmail')}
          </Button>
        </div>
      ) : (
        <>
          <OAuthButtons next={next} onError={setError} />
          <Divider label={t('auth.or')} />
          <SegmentedControl<Method>
            className="mb-4 w-full [&>button]:flex-1 [&>button]:justify-center"
            label={t('nav.signIn')}
            value={method}
            onChange={(value) => {
              setMethod(value);
              setError(null);
            }}
            items={[
              { value: 'email', label: t('auth.methodMagicLink'), icon: Mail },
              { value: 'password', label: t('auth.methodPassword'), icon: KeyRound },
            ]}
          />

          {method === 'email' ? (
            <form onSubmit={sendEmail} className="flex flex-col gap-4" noValidate>
              <Field
                label={t('auth.email')}
                htmlFor="login-email"
                error={emailError}
                hint={t('auth.login.magicLinkHint')}
              >
                <Input
                  id="login-email"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  aria-invalid={Boolean(emailError) || undefined}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
              <Button type="submit" size="lg" loading={busy}>
                {t('auth.login.sendLink')}
              </Button>
            </form>
          ) : (
            <form onSubmit={signInWithPassword} className="flex flex-col gap-4" noValidate>
              <Field label={t('auth.email')} htmlFor="login-email-pw" error={emailError}>
                <Input
                  id="login-email-pw"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  aria-invalid={Boolean(emailError) || undefined}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
              <Field label={t('auth.password')} htmlFor="login-password">
                <Input
                  id="login-password"
                  type="password"
                  dir="ltr"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>
              <div className="-mt-2 text-end">
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  {t('auth.login.forgotPassword')}
                </Link>
              </div>
              <Button type="submit" size="lg" loading={busy} disabled={!password}>
                {t('auth.login.submitPassword')}
              </Button>
            </form>
          )}
        </>
      )}
    </AuthCard>
  );
}
