import type { ComponentType } from 'react';
import { createBrowserRouter, Outlet, ScrollRestoration, type RouteObject } from 'react-router';
import { AppShell, AuthLayout } from '@/components/layout/AppShell';
import { RedirectIfSignedIn, RequireAdmin, RequireAuth } from '@/features/auth/guards';
import { BASE_PATH } from '@/lib/env';
import NotFoundPage from '@/pages/NotFoundPage';
import { RouteError } from '@/pages/RouteError';

type Loader = () => Promise<{ default: ComponentType }>;

/** Code-split route: the module's default export becomes the route component. */
function route(path: string, load: Loader, children?: RouteObject[]): RouteObject {
  return { path, lazy: async () => ({ Component: (await load()).default }), children };
}

function Root() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

/** Pages that anyone can open. */
const publicRoutes: RouteObject[] = [
  { index: true, lazy: async () => ({ Component: (await import('@/pages/LandingPage')).default }) },
  route('join/:code', () => import('@/features/rooms/JoinRoomPage')),
  route('countries', () =>
    import('@/features/kb/KbPages').then((m) => ({ default: m.CountriesPage })),
  ),
  route('countries/:code', () =>
    import('@/features/kb/KbPages').then((m) => ({ default: m.CountryPage })),
  ),
  route('universities/:id', () =>
    import('@/features/kb/KbPages').then((m) => ({ default: m.UniversityPage })),
  ),
  route('programs/:id', () =>
    import('@/features/kb/KbPages').then((m) => ({ default: m.ProgramRedirect })),
  ),
  route('history/:entityType/:entityId', () =>
    import('@/features/kb/KbPages').then((m) => ({ default: m.HistoryPage })),
  ),
];

/** Pages for signed-in users (RequireAuth also sends new users to onboarding). */
const protectedRoutes: RouteObject[] = [
  route('onboarding', () => import('@/features/profile/OnboardingPage')),
  route('profile', () => import('@/features/profile/ProfilePage')),
  route('dashboard', () => import('@/features/dashboard/DashboardPage')),
  route('applications', () => import('@/features/applications/ApplicationsPage')),
  route('applications/new', () => import('@/features/applications/NewApplicationPage')),
  route('applications/:id', () => import('@/features/applications/ApplicationDetailPage')),
  route('applications/:id/edit', () => import('@/features/applications/EditApplicationPage')),
  route('rooms', () => import('@/features/rooms/RoomsPage')),
  route('rooms/:roomId', () => import('@/features/rooms/RoomPage')),
  route('contribute', () =>
    import('@/features/moderation/ModerationPages').then((m) => ({ default: m.ContributionsPage })),
  ),
  route('contribute/new', () =>
    import('@/features/moderation/ModerationPages').then((m) => ({ default: m.ProposePage })),
  ),
  route('data', () => import('@/features/data/DataPage')),
];

/** Admin screens (the database enforces the same rules). */
const adminRoutes: RouteObject[] = [
  route('admin/moderation', () =>
    import('@/features/moderation/ModerationPages').then((m) => ({ default: m.ModerationPage })),
  ),
];

export const router = createBrowserRouter(
  [
    {
      element: <Root />,
      errorElement: <RouteError />,
      children: [
        {
          element: <AuthLayout />,
          errorElement: <RouteError />,
          children: [
            {
              element: <RedirectIfSignedIn />,
              children: [
                route('login', () => import('@/features/auth/LoginPage')),
                route('signup', () => import('@/features/auth/SignupPage')),
                route('forgot-password', () => import('@/features/auth/ForgotPasswordPage')),
              ],
            },
            route('auth/callback', () => import('@/features/auth/AuthCallbackPage')),
            route('auth/reset-password', () => import('@/features/auth/ResetPasswordPage')),
          ],
        },
        {
          element: <AppShell />,
          errorElement: <RouteError />,
          children: [
            ...publicRoutes,
            {
              element: <RequireAuth />,
              children: [...protectedRoutes, { element: <RequireAdmin />, children: adminRoutes }],
            },
            { path: '*', element: <NotFoundPage /> },
          ],
        },
      ],
    },
  ],
  { basename: BASE_PATH.replace(/\/$/, '') || '/' },
);
