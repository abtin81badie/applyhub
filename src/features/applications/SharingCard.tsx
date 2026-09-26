import { Lock, Share2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Spinner';
import { useMyRooms } from '@/features/rooms/api';
import { describeError } from '@/lib/errors';
import { useToast } from '@/providers/ToastProvider';
import { useApplicationShares, useSetSharing, type Application } from './api';

function SharingEditor({ app, initial }: { app: Application; initial: string[] }) {
  const { t } = useTranslation();
  const toast = useToast();
  const rooms = useMyRooms();
  const setSharing = useSetSharing(app.id);
  const [selected, setSelected] = useState<string[]>(initial);
  const dirty = [...selected].sort().join() !== [...initial].sort().join();

  const save = (roomIds: string[]) =>
    setSharing.mutate(roomIds, {
      onSuccess: () => {
        setSelected(roomIds);
        toast.success(t('applications.sharing.updated'));
      },
      onError: (error) => toast.error(describeError(error, t)),
    });

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-start gap-2 text-sm">
        {initial.length === 0 ? (
          <>
            <Lock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
            {t('applications.sharing.private')}
          </>
        ) : (
          <>
            <Share2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {t('applications.sharing.shared', { count: initial.length })}
          </>
        )}
      </p>
      <p className="text-xs text-muted">{t('applications.sharing.explain')}</p>
      {rooms.isPending ? (
        <Skeleton className="h-16" />
      ) : (rooms.data ?? []).length === 0 ? (
        <p className="text-sm text-muted">
          {t('applications.sharing.noRooms')}{' '}
          <Link to="/rooms" className="text-primary hover:underline">
            {t('nav.rooms')}
          </Link>
        </p>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">
            {t('applications.sharing.chooseRooms')}
          </legend>
          {(rooms.data ?? []).map((room) => {
            const viewer = room.my_role === 'viewer';
            const checked = selected.includes(room.id!);
            return (
              <div key={room.id}>
                <Checkbox
                  checked={checked}
                  disabled={viewer && !checked}
                  onChange={(e) =>
                    setSelected((s) =>
                      e.target.checked ? [...s, room.id!] : s.filter((id) => id !== room.id),
                    )
                  }
                  label={<span dir="auto">{room.name}</span>}
                />
                {viewer && (
                  <p className="ms-6 text-xs text-muted">
                    {t('applications.sharing.viewerCannotShare')}
                  </p>
                )}
              </div>
            );
          })}
        </fieldset>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => save(selected)}
          disabled={!dirty}
          loading={setSharing.isPending}
        >
          {t('common.save')}
        </Button>
        {initial.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => save([])}
            disabled={setSharing.isPending}
          >
            <Lock className="size-3.5" aria-hidden />
            {t('applications.sharing.makePrivate')}
          </Button>
        )}
      </div>
    </div>
  );
}

export function SharingCard({ app }: { app: Application }) {
  const { t } = useTranslation();
  const shares = useApplicationShares(app.id);
  return (
    <Card>
      <CardHeader title={t('applications.detail.sharing')} />
      <CardBody>
        {shares.isPending ? (
          <Skeleton className="h-24" />
        ) : (
          // Remount when the saved set changes so local selection resets.
          <SharingEditor key={(shares.data ?? []).join()} app={app} initial={shares.data ?? []} />
        )}
      </CardBody>
    </Card>
  );
}
