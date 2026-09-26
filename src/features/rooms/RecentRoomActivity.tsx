import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/Spinner';
import { useRecentActivity } from './activity';
import { ActivityItem } from './ActivityItem';

export function RecentRoomActivity() {
  const { t } = useTranslation();
  const { data, isPending } = useRecentActivity();
  if (isPending) return <Skeleton className="h-32" />;
  if (!data || data.length === 0)
    return <p className="text-sm text-muted">{t('dashboard.noActivity')}</p>;
  return (
    <ul className="flex flex-col divide-y divide-border">
      {data.map((row) => (
        <ActivityItem key={row.id} row={row} showRoom />
      ))}
    </ul>
  );
}
