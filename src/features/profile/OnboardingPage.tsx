import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { PageLoader } from '@/components/ui/Spinner';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { describeError } from '@/lib/errors';
import { safeNextPath } from '@/lib/navigation';
import { useToast } from '@/providers/ToastProvider';
import { ProfileForm } from './ProfileForm';
import { useProfile, useUpdateProfile } from './api';

export default function OnboardingPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('profile.onboardingTitle'));
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('next'));
  const toast = useToast();
  const { data: profile, isPending } = useProfile();
  const update = useUpdateProfile();

  if (isPending) return <PageLoader />;

  const finish = (patch: Parameters<typeof update.mutate>[0]) => {
    update.mutate(
      { ...patch, onboarded_at: new Date().toISOString() },
      {
        onSuccess: () => navigate(next, { replace: true }),
        onError: (error) => toast.error(describeError(error, t)),
      },
    );
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-start gap-3">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
          <Sparkles className="size-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('profile.onboardingTitle')}</h1>
          <p className="mt-1 text-sm text-muted">{t('profile.onboardingSubtitle')}</p>
        </div>
      </div>
      <Card>
        <CardBody>
          <ProfileForm
            profile={profile}
            onSubmit={finish}
            actions={
              <>
                <Button variant="ghost" onClick={() => finish({})} disabled={update.isPending}>
                  {t('profile.skip')}
                </Button>
                <Button type="submit" loading={update.isPending}>
                  {t('profile.finish')}
                </Button>
              </>
            }
          />
        </CardBody>
      </Card>
    </div>
  );
}
