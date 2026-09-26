import {
  Activity,
  FileText,
  FolderOpen,
  Target,
  Users,
  KanbanSquare,
  Eye,
  Download,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router';
import { useIntakeLabel } from '@/components/common/IntakeText';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/QueryState';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { LinkButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/Spinner';
import { useCountryLookup } from '@/features/kb/countries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cn } from '@/lib/utils';
import { useRoom, useRoomRealtime } from './api';
import { ApplicationsTab, NotesTab, TargetsTab } from './RoomContentTabs';
import { ActivityTab, FilesTab, MembersTab } from './RoomManageTabs';

const TABS = ['applications', 'targets', 'notes', 'files', 'activity', 'members'] as const;
type Tab = (typeof TABS)[number];
const ICONS = {
  applications: KanbanSquare,
  targets: Target,
  notes: FileText,
  files: FolderOpen,
  activity: Activity,
  members: Users,
};

export default function RoomPage() {
  const { t } = useTranslation();
  const { roomId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.find((x) => x === params.get('tab')) ?? 'applications';
  const { data, isPending, error, refetch } = useRoom(roomId);
  const live = useRoomRealtime(roomId);
  const countries = useCountryLookup();
  const intake = useIntakeLabel();
  useDocumentTitle(data?.room.name ?? t('rooms.title'));

  if (isPending) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data) {
    return (
      <EmptyState
        icon={Users}
        title={t('rooms.notFound')}
        action={<LinkButton to="/rooms">{t('nav.rooms')}</LinkButton>}
      />
    );
  }
  const { room, role } = data;
  const props = { roomId, canWrite: role !== 'viewer', isOwner: role === 'owner' };

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link to="/rooms" className="hover:text-fg">
            {t('nav.rooms')}
          </Link>
        }
        title={room.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {room.description && <span dir="auto">{room.description}</span>}
            {room.country_code && (
              <Badge>
                {countries.flag(room.country_code)} {countries.name(room.country_code)}
              </Badge>
            )}
            {intake(room.intake_term, room.intake_year) && (
              <Badge>{intake(room.intake_term, room.intake_year)}</Badge>
            )}
            <Badge tone="primary">
              {t('rooms.yourRole', { role: t(`enums.roomRole.${role}`) })}
            </Badge>
          </span>
        }
        actions={
          <LinkButton to={`/data?room=${roomId}`} variant="outline" size="sm">
            <Download className="size-4" aria-hidden />
            {t('rooms.export')}
          </LinkButton>
        }
      />
      {role === 'viewer' && (
        <Alert tone="info" className="mb-4">
          <span className="inline-flex items-center gap-2">
            <Eye className="size-4" aria-hidden />
            {t('rooms.viewerNotice')}
          </span>
        </Alert>
      )}
      <nav
        aria-label={t('rooms.title')}
        className="scrollbar-thin -mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0"
      >
        <ul className="flex min-w-max gap-1 border-b border-border">
          {TABS.map((key) => {
            const Icon = ICONS[key];
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() =>
                    setParams(key === 'applications' ? {} : { tab: key }, { replace: true })
                  }
                  aria-current={tab === key ? 'page' : undefined}
                  className={cn(
                    '-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap',
                    tab === key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted hover:text-fg',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {t(`rooms.tabs.${key}`)}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      {tab === 'applications' && <ApplicationsTab {...props} />}
      {tab === 'targets' && <TargetsTab {...props} />}
      {tab === 'notes' && <NotesTab {...props} />}
      {tab === 'files' && <FilesTab {...props} />}
      {tab === 'activity' && <ActivityTab roomId={roomId} live={live} />}
      {tab === 'members' && <MembersTab room={room} isOwner={props.isOwner} />}
    </div>
  );
}
