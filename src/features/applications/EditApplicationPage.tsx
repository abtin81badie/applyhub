import { FileQuestion } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/QueryState';
import { Button, LinkButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/Spinner';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { describeError } from '@/lib/errors';
import { useToast } from '@/providers/ToastProvider';
import { useApplication, useUpdateApplication } from './api';
import { ApplicationForm } from './ApplicationForm';
import { initialFormState, toCreateInput } from './formModel';

export default function EditApplicationPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: app, isPending, error, refetch } = useApplication(id);
  const update = useUpdateApplication();
  useDocumentTitle(
    app ? `${t('applications.edit')}: ${app.university_name}` : t('applications.edit'),
  );

  if (isPending) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!app) return <EmptyState icon={FileQuestion} title={t('applications.notFound')} />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('applications.edit')} eyebrow={app.university_name} />
      <ApplicationForm
        mode="edit"
        initial={initialFormState(app)}
        onSubmit={(values) =>
          update.mutate(
            { id: app.id, patch: toCreateInput(values, (kind) => kind).application },
            {
              onSuccess: () => {
                toast.success(t('applications.updated'));
                navigate(`/applications/${app.id}`, { replace: true });
              },
              onError: (e) => toast.error(describeError(e, t)),
            },
          )
        }
        footer={
          <>
            <LinkButton to={`/applications/${app.id}`} variant="ghost">
              {t('common.cancel')}
            </LinkButton>
            <Button type="submit" loading={update.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      />
    </div>
  );
}
