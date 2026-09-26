import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/Spinner';
import { useProfile } from '@/features/profile/api';
import { useAuth } from '@/providers/AuthProvider';

/** Signed-in area. Sends visitors to /login and new users to /onboarding. */
export function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const profile = useProfile();
  const here = `${location.pathname}${location.search}`;

  if (loading) return <PageLoader />;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(here)}`} replace />;
  if (profile.isPending) return <PageLoader />;
  if (profile.data && !profile.data.onboarded_at && location.pathname !== '/onboarding') {
    return <Navigate to={`/onboarding?next=${encodeURIComponent(here)}`} replace />;
  }
  return <Outlet />;
}

/**
 * Admin-only screens. This only hides UI: every admin action is also
 * checked by the database (RLS policies and is_admin() in RPCs).
 */
export function RequireAdmin() {
  const { t } = useTranslation();
  const profile = useProfile();
  if (profile.isPending) return <PageLoader />;
  if (profile.data?.role !== 'admin') {
    return <EmptyState icon={ShieldAlert} title={t('moderation.notAdmin')} />;
  }
  return <Outlet />;
}

/** Pages like /login redirect signed-in users away. */
export function RedirectIfSignedIn({ to = '/dashboard' }: { to?: string }) {
  const { session, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (session) return <Navigate to={to} replace />;
  return <Outlet />;
}
