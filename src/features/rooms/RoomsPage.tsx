import { DoorOpen, Plus, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { CountrySelect } from '@/components/common/CountrySelect';
import { useIntakeLabel } from '@/components/common/IntakeText';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/QueryState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Spinner';
import { useCountryLookup } from '@/features/kb/countries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { INTAKE_TERMS, yearOptions, type IntakeTerm } from '@/lib/domain';
import { describeError } from '@/lib/errors';
import { useFormat } from '@/providers/PreferencesProvider';
import { useToast } from '@/providers/ToastProvider';
import { useCreateRoom, useJoinRoom, useMyRooms } from './api';

function CreateRoomDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const toast = useToast();
  const navigate = useNavigate();
  const create = useCreateRoom();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [term, setTerm] = useState<IntakeTerm | null>(null);
  const [year, setYear] = useState<number | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), description: description.trim(), country, term, year },
      {
        onSuccess: (id) => {
          toast.success(t('rooms.form.created'));
          navigate(`/rooms/${id}?tab=members`);
        },
        onError: (e) => toast.error(describeError(e, t)),
      },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} title={t('rooms.create')}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t('rooms.form.name')} htmlFor="room-name">
          <Input
            id="room-name"
            dir="auto"
            maxLength={100}
            required
            placeholder={t('rooms.form.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={t('rooms.form.description')} htmlFor="room-desc">
          <Textarea
            id="room-desc"
            dir="auto"
            rows={3}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label={t('rooms.form.targetCountry')} htmlFor="room-country">
          <CountrySelect id="room-country" value={country} onChange={setCountry} />
        </Field>
        <Field label={t('rooms.form.targetIntake')} htmlFor="room-term">
          <div className="flex gap-2">
            <Select
              id="room-term"
              value={term ?? ''}
              onChange={(e) => setTerm((e.target.value || null) as IntakeTerm | null)}
            >
              <option value="">{t('common.notSet')}</option>
              {INTAKE_TERMS.map((x) => (
                <option key={x} value={x}>
                  {t(`enums.intakeTerm.${x}`)}
                </option>
              ))}
            </Select>
            <Select
              aria-label={t('applications.form.intakeYear')}
              value={year ?? ''}
              onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{t('common.notSet')}</option>
              {yearOptions().map((y) => (
                <option key={y} value={y}>
                  {fmt.number(y, { useGrouping: false })}
                </option>
              ))}
            </Select>
          </div>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
            {t('common.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export default function RoomsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('rooms.title'));
  const fmt = useFormat();
  const toast = useToast();
  const navigate = useNavigate();
  const countries = useCountryLookup();
  const intake = useIntakeLabel();
  const { data: rooms, isPending, error, refetch } = useMyRooms();
  const join = useJoinRoom();
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');

  const submitJoin = (event: FormEvent) => {
    event.preventDefault();
    const clean = code.trim().split('/').pop() ?? '';
    if (!clean) return;
    join.mutate(clean, {
      onSuccess: (roomId) => {
        toast.success(t('rooms.joinPage.joined'));
        navigate(`/rooms/${roomId}`);
      },
      onError: (e) => toast.error(describeError(e, t)),
    });
  };

  return (
    <div>
      <PageHeader
        title={t('rooms.title')}
        description={t('rooms.subtitle')}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden />
            {t('rooms.create')}
          </Button>
        }
      />
      <form onSubmit={submitJoin} className="mb-6 flex max-w-md gap-2">
        <Input
          dir="ltr"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t('rooms.joinPlaceholder')}
          aria-label={t('rooms.join')}
        />
        <Button type="submit" variant="outline" loading={join.isPending} disabled={!code.trim()}>
          <DoorOpen className="size-4" aria-hidden />
          {t('rooms.joinSubmit')}
        </Button>
      </form>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : rooms.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('rooms.empty')}
          action={<Button onClick={() => setCreating(true)}>{t('rooms.create')}</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <Link key={room.id} to={`/rooms/${room.id}`} className="group">
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardBody className="flex h-full flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold group-hover:text-primary" dir="auto">
                      {room.name}
                    </h2>
                    <Badge tone={room.my_role === 'owner' ? 'primary' : 'neutral'}>
                      {t(`enums.roomRole.${room.my_role!}`)}
                    </Badge>
                  </div>
                  {room.description && (
                    <p className="line-clamp-2 text-sm text-muted" dir="auto">
                      {room.description}
                    </p>
                  )}
                  <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-2 text-xs text-muted">
                    <span>{t('rooms.memberCount', { count: room.member_count ?? 0 })}</span>
                    {room.country_code && (
                      <span>
                        {countries.flag(room.country_code)} {countries.name(room.country_code)}
                      </span>
                    )}
                    {intake(room.intake_term, room.intake_year) && (
                      <span>{intake(room.intake_term, room.intake_year)}</span>
                    )}
                    {room.last_activity_at && <span>{fmt.relative(room.last_activity_at)}</span>}
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
      {creating && <CreateRoomDialog open onClose={() => setCreating(false)} />}
    </div>
  );
}
