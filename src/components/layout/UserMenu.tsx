import { BookOpenCheck, Database, GitPullRequestArrow, LogOut, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { Menu } from '@/components/ui/Menu';
import { useSignOut } from '@/features/auth/useSignOut';
import { useProfile } from '@/features/profile/api';
import { useAuth } from '@/providers/AuthProvider';

export function UserMenu() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const signOut = useSignOut();
  const { data: profile } = useProfile();
  const name = profile?.display_name || user?.email || '';
  return (
    <Menu
      triggerLabel={t('nav.account')}
      triggerClassName="size-10 rounded-full"
      trigger={<Avatar name={name} url={profile?.avatar_url} seed={user?.id} size="sm" />}
      items={[
        { label: t('nav.profile'), icon: UserRound, to: '/profile' },
        { label: t('nav.contribute'), icon: GitPullRequestArrow, to: '/contribute' },
        { label: t('nav.data'), icon: Database, to: '/data' },
        {
          label: t('nav.moderation'),
          icon: BookOpenCheck,
          to: '/admin/moderation',
          hidden: profile?.role !== 'admin',
        },
        'separator',
        {
          label: t('nav.signOut'),
          icon: LogOut,
          onSelect: signOut,
        },
      ]}
    />
  );
}
