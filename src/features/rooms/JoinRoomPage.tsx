import { DoorOpen, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/Spinner';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { describeError } from '@/lib/errors';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { useInvitePreview, useJoinRoom } from './api';

export default function JoinRoomPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('rooms.joinPage.title'));
  const { code = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: preview, isPending } = useInvitePreview(code);
  const join = useJoinRoom();

  if (isPending) return <PageLoader />;
  if (!preview || (!preview.is_valid && !preview.is_member)) {
    return (
      <EmptyState
        className="mx-auto my-12 max-w-lg"
        icon={XCircle}
        title={t('rooms.joinPage.invalid')}
      />
    );
  }

  return (
    <Card className="mx-auto my-8 max-w-lg">
      <CardBody className="flex flex-col items-center gap-4 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
          <DoorOpen className="size-7" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('rooms.joinPage.title')}</h1>
          <p className="mt-1 text-muted" dir="auto">
            {t('rooms.joinPage.subtitle', {
              name: preview.room_name ?? '',
              role: preview.role ? t(`enums.roomRole.${preview.role}`) : '',
            })}
          </p>
          {preview.room_description && (
            <p className="mt-2 text-sm text-muted" dir="auto">
              {preview.room_description}
            </p>
          )}
          <p className="mt-2 text-xs text-muted">
            {t('rooms.joinPage.members', { count: preview.member_count ?? 0 })}
          </p>
        </div>
        {preview.is_member ? (
          <LinkButton to={`/rooms/${preview.room_id}`}>{t('rooms.joinPage.openRoom')}</LinkButton>
        ) : user ? (
          <Button
            size="lg"
            loading={join.isPending}
            onClick={() =>
              join.mutate(code, {
                onSuccess: (roomId) => {
                  toast.success(t('rooms.joinPage.joined'));
                  navigate(`/rooms/${roomId}`, { replace: true });
                },
                onError: (e) => toast.error(describeError(e, t)),
              })
            }
          >
            {t('rooms.joinPage.joinButton')}
          </Button>
        ) : (
          <LinkButton to={`/login?next=${encodeURIComponent(`/join/${code}`)}`} size="lg">
            {t('rooms.joinPage.signInToJoin')}
          </LinkButton>
        )}
      </CardBody>
    </Card>
  );
}
