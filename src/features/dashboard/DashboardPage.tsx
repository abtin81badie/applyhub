import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/common/PageHeader';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useProfile } from '@/features/profile/api';

export default function DashboardPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('dashboard.title'));
  const { data: profile } = useProfile();
  return (
    <PageHeader
      title={t('dashboard.greeting', { name: profile?.display_name ?? '' })}
      description={t('dashboard.subtitle')}
    />
  );
}
