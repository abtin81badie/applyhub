import { KeyRound, LogOut } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/common/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Input';
import { PageLoader } from '@/components/ui/Spinner';
import { SegmentedControl } from '@/components/ui/Tabs';
import { useSignOut } from '@/features/auth/useSignOut';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { describeAuthError, describeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { usePreferences, type ThemePreference } from '@/providers/PreferencesProvider';
import { useToast } from '@/providers/ToastProvider';
import { ProfileForm } from './ProfileForm';
import { useProfile, useUpdateProfile } from './api';

function PasswordForm() {
  const { t } = useTranslation();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      toast.error(t('auth.passwordHint'));
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(describeAuthError(error, t));
      return;
    }
    setPassword('');
    toast.success(t('profile.passwordUpdated'));
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <Field
        label={t('profile.changePassword')}
        htmlFor="new-pass"
        hint={t('auth.passwordHint')}
        className="flex-1"
      >
        <Input
          id="new-pass"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Button
        type="submit"
        variant="outline"
        loading={busy}
        disabled={!password}
        className="sm:mb-5"
      >
        <KeyRound className="size-4" aria-hidden />
        {t('common.save')}
      </Button>
    </form>
  );
}

export default function ProfilePage() {
  const { t } = useTranslation();
  useDocumentTitle(t('profile.title'));
  const { user } = useAuth();
  const signOut = useSignOut();
  const toast = useToast();
  const { data: profile, isPending } = useProfile();
  const update = useUpdateProfile();
  const { locale, setLocale, calendar, setCalendar, theme, setTheme } = usePreferences();

  if (isPending) return <PageLoader />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('profile.title')} />
      <div className="flex flex-col gap-6">
        <Card>
          <CardBody className="flex items-center gap-4">
            <Avatar
              name={profile?.display_name || user?.email}
              url={profile?.avatar_url}
              seed={user?.id}
              size="lg"
            />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold" dir="auto">
                {profile?.display_name || user?.email}
              </p>
              <p className="truncate text-sm text-muted" dir="ltr">
                {user?.email}
              </p>
              <Badge tone={profile?.role === 'admin' ? 'primary' : 'neutral'} className="mt-1">
                {profile?.role === 'admin' ? t('profile.roleAdmin') : t('profile.roleUser')}
              </Badge>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('profile.profileSection')} />
          <CardBody>
            <ProfileForm
              profile={profile}
              onSubmit={(patch) =>
                update.mutate(patch, {
                  onSuccess: () => toast.success(t('profile.saved')),
                  onError: (error) => toast.error(describeError(error, t)),
                })
              }
              actions={
                <Button type="submit" loading={update.isPending}>
                  {t('common.save')}
                </Button>
              }
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('profile.preferences')} />
          <CardBody className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium">{t('settings.language')}</span>
              <SegmentedControl
                label={t('settings.language')}
                value={locale}
                onChange={setLocale}
                items={[
                  { value: 'fa', label: 'فارسی' },
                  { value: 'en', label: 'English' },
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium">{t('settings.calendar')}</span>
              <SegmentedControl
                label={t('settings.calendar')}
                value={calendar}
                onChange={setCalendar}
                items={[
                  { value: 'jalali', label: t('settings.jalali') },
                  { value: 'gregorian', label: t('settings.gregorian') },
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium">{t('settings.theme')}</span>
              <SegmentedControl<ThemePreference>
                label={t('settings.theme')}
                value={theme}
                onChange={setTheme}
                items={[
                  { value: 'light', label: t('settings.light') },
                  { value: 'dark', label: t('settings.dark') },
                  { value: 'system', label: t('settings.system') },
                ]}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t('profile.account')}
            description={t('profile.signedInAs', { email: user?.email ?? '' })}
          />
          <CardBody className="flex flex-col gap-4">
            <PasswordForm />
            <div>
              <Button variant="outline" onClick={signOut}>
                <LogOut className="size-4 rtl:rotate-180" aria-hidden />
                {t('nav.signOut')}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
