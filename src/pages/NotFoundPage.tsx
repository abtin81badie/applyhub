import { Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LinkButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function NotFoundPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('errors.notFoundTitle'));
  return (
    <EmptyState
      className="my-12"
      icon={Compass}
      title={t('errors.notFoundTitle')}
      description={t('errors.notFoundBody')}
      action={<LinkButton to="/">{t('errors.goHome')}</LinkButton>}
    />
  );
}
