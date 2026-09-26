import {
  BookOpenCheck,
  Globe2,
  LayoutDashboard,
  ListChecks,
  Menu as MenuIcon,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { LinkButton } from '@/components/ui/Button';
import { useIsAdmin } from '@/features/profile/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/AuthProvider';
import { LanguageToggle, ThemeToggle } from './Toggles';
import { UserMenu } from './UserMenu';

function Logo() {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 64 64" className="size-8 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="14" className="fill-primary" />
        <path d="M32 14 10 25l22 11 18-9v13h4V25L32 14Z" fill="#fff" />
        <path d="M18 34v9c0 4 6.3 8 14 8s14-4 14-8v-9l-14 7-14-7Z" fill="#c7d2fe" />
      </svg>
      <span className="text-lg font-bold tracking-tight">{t('app.name')}</span>
    </span>
  );
}

export function AppShell() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile menu after navigating.
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setMobileOpen(false);
  }

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const nav = [
    ...(user
      ? [
          { to: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
          { to: '/applications', label: t('nav.applications'), icon: ListChecks },
          { to: '/rooms', label: t('nav.rooms'), icon: Users },
        ]
      : []),
    { to: '/countries', label: t('nav.countries'), icon: Globe2 },
    ...(isAdmin
      ? [{ to: '/admin/moderation', label: t('nav.moderation'), icon: BookOpenCheck }]
      : []),
  ];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-2 hover:text-fg',
    );

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-[200] rounded-lg bg-primary px-4 py-2 text-primary-fg focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t('nav.skipToContent')}
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to={user ? '/dashboard' : '/'} className="shrink-0 rounded-lg">
            <Logo />
          </Link>

          <nav aria-label={t('nav.menu')} className="ms-4 hidden items-center gap-1 lg:flex">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                <item.icon className="size-4" aria-hidden />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-1 sm:gap-2">
            <LanguageToggle />
            <ThemeToggle />
            {user ? (
              <UserMenu />
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <LinkButton to="/login" variant="ghost" size="sm">
                  {t('nav.signIn')}
                </LinkButton>
                <LinkButton to="/signup" size="sm">
                  {t('nav.signUp')}
                </LinkButton>
              </div>
            )}
            <button
              type="button"
              className="grid size-10 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg lg:hidden"
              aria-label={mobileOpen ? t('nav.closeMenu') : t('nav.openMenu')}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="size-5" /> : <MenuIcon className="size-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav
            aria-label={t('nav.menu')}
            className="border-t border-border bg-surface px-4 py-3 lg:hidden"
          >
            <ul className="flex flex-col gap-1">
              {nav.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} className={linkClass}>
                    <item.icon className="size-4" aria-hidden />
                    {item.label}
                  </NavLink>
                </li>
              ))}
              {!user && (
                <li className="mt-2 flex gap-2">
                  <LinkButton to="/login" variant="outline" className="flex-1">
                    {t('nav.signIn')}
                  </LinkButton>
                  <LinkButton to="/signup" className="flex-1">
                    {t('nav.signUp')}
                  </LinkButton>
                </li>
              )}
            </ul>
          </nav>
        )}
      </header>

      <main
        id="main"
        className={cn(
          'mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8',
          user && 'pb-24 lg:pb-8',
        )}
      >
        <Outlet />
      </main>

      <footer
        className={cn(
          'border-t border-border py-6 text-center text-xs text-muted',
          user && 'mb-16 lg:mb-0',
        )}
      >
        <div className="mx-auto max-w-7xl px-4">
          <p>
            {t('app.name')} · {t('app.tagline')}
          </p>
          <p className="mt-1">{t('kb.disclaimer')}</p>
        </div>
      </footer>

      {user && (
        <nav
          aria-label={t('nav.menu')}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
          <ul className="grid grid-cols-4">
            {nav.slice(0, 4).map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                      isActive ? 'text-primary' : 'text-muted',
                    )
                  }
                >
                  <item.icon className="size-5" aria-hidden />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

/** Minimal centered layout for auth pages. */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
        <Link to="/" className="rounded-lg">
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>
      <main
        id="main"
        className="flex flex-1 items-start justify-center px-4 py-6 sm:items-center sm:py-10"
      >
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
