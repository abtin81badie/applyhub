import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/common/PageHeader';
import { Button, LinkButton } from '@/components/ui/Button';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { describeError } from '@/lib/errors';
import { useToast } from '@/providers/ToastProvider';
import { useCreateApplication } from './api';
import { ApplicationForm } from './ApplicationForm';
import { initialFormState, toCreateInput } from './formModel';

export default function NewApplicationPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('applications.new'));
  const navigate = useNavigate();
  const toast = useToast();
  const create = useCreateApplication();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('applications.new')} />
      <ApplicationForm
        mode="create"
        initial={initialFormState()}
        onSubmit={(values) =>
          create.mutate(
            toCreateInput(values, (kind) => t(`enums.requirement.${kind}`)),
            {
              onSuccess: (id) => {
                toast.success(t('applications.created'));
                navigate(`/applications/${id}`, { replace: true });
              },
              onError: (error) => toast.error(describeError(error, t)),
            },
          )
        }
        footer={
          <>
            <LinkButton to="/applications" variant="ghost">
              {t('common.cancel')}
            </LinkButton>
            <Button type="submit" loading={create.isPending}>
              {t('common.create')}
            </Button>
          </>
        }
      />
    </div>
  );
}
