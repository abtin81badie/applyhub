import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import {
  APPLICATION_STATUSES,
  ROOM_ROLES,
  TARGET_INTERESTS,
  type ApplicationStatus,
  type RoomRole,
  type TargetInterest,
} from '@/lib/domain';
import { useFormat } from '@/providers/PreferencesProvider';
import { metaString, type ActivityRow } from './activity';

const KNOWN_ACTIONS = new Set([
  'room.created',
  'room.updated',
  'member.joined',
  'member.left',
  'member.removed',
  'member.role_changed',
  'invite.created',
  'application.shared',
  'application.status_changed',
  'target.added',
  'target.removed',
  'target.interest',
  'note.created',
  'note.updated',
  'note.deleted',
  'comment.created',
  'file.uploaded',
  'file.deleted',
]);

function entityLink(row: ActivityRow): string | null {
  const base = `/rooms/${row.room_id}`;
  switch (row.entity_type) {
    case 'application':
      return row.entity_id ? `${base}/applications?app=${row.entity_id}` : `${base}/applications`;
    case 'note':
      return row.action === 'note.deleted' || !row.entity_id
        ? `${base}/notes`
        : `${base}/notes/${row.entity_id}`;
    case 'target':
      return `${base}/targets`;
    case 'attachment':
      return `${base}/files`;
    case 'member':
    case 'invite':
      return `${base}/members`;
    default:
      return base;
  }
}

/** One feed entry: "Sara shared TU Example — MSc", with avatar and time. */
export function ActivityItem({ row, showRoom = false }: { row: ActivityRow; showRoom?: boolean }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const actor = row.actor?.display_name || t('common.someone');
  const meta = row.metadata;
  const to = metaString(meta, 'to');
  const interest = metaString(meta, 'interest');
  const role = metaString(meta, 'role');
  const values = {
    actor,
    title: metaString(meta, 'title') || metaString(meta, 'name'),
    target: metaString(meta, 'target_name') || t('common.someone'),
    status: (APPLICATION_STATUSES as readonly string[]).includes(to)
      ? t(`enums.status.${to as ApplicationStatus}`)
      : to,
    interest: (TARGET_INTERESTS as readonly string[]).includes(interest)
      ? t(`enums.interest.${interest as TargetInterest}`)
      : interest,
    role: (ROOM_ROLES as readonly string[]).includes(role)
      ? t(`enums.roomRole.${role as RoomRole}`)
      : role,
  };
  const key = KNOWN_ACTIONS.has(row.action) ? row.action.replace('.', '_') : 'unknown';
  const text = t(`activity.${key}` as 'activity.unknown', values);
  const excerpt = row.action === 'comment.created' ? metaString(meta, 'excerpt') : '';
  const href = entityLink(row);

  return (
    <li className="flex gap-3 py-2.5">
      <Avatar
        name={row.actor?.display_name}
        url={row.actor?.avatar_url}
        seed={row.actor_id}
        size="sm"
      />
      <div className="min-w-0 flex-1 text-sm">
        {href ? (
          <Link to={href} className="hover:text-primary" dir="auto">
            {text}
          </Link>
        ) : (
          <span dir="auto">{text}</span>
        )}
        {excerpt && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted" dir="auto">
            “{excerpt}”
          </p>
        )}
        <p className="mt-0.5 text-xs text-muted">
          {fmt.relative(row.created_at)}
          {showRoom && row.room && (
            <>
              {' · '}
              <Link to={`/rooms/${row.room.id}`} className="hover:text-primary" dir="auto">
                {row.room.name}
              </Link>
            </>
          )}
        </p>
      </div>
    </li>
  );
}
