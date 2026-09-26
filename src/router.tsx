import type { ComponentType } from 'react';
import { createBrowserRouter, Outlet, ScrollRestoration } from 'react-router';
import { AppShell, AuthLayout } from '@/components/layout/AppShell';
import { RedirectIfSignedIn, RequireAdmin, RequireAuth } from '@/features/auth/guards';
import { BASE_PATH } from '@/lib/env';
import NotFoundPage from '@/pages/NotFoundPage';
import { RouteError } from '@/pages/RouteError';

/** Code-split route: the module's default export becomes the route component. */
function page(load: () => Promise<{ default: ComponentType }>) {
  return async () => ({ Component: (await load()).default });
}

function Root() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

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
                { path: 'login', lazy: page(() => import('@/features/auth/LoginPage')) },
                { path: 'signup', lazy: page(() => import('@/features/auth/SignupPage')) },
                {
                  path: 'forgot-password',
                  lazy: page(() => import('@/features/auth/ForgotPasswordPage')),
                },
              ],
            },
            { path: 'auth/callback', lazy: page(() => import('@/features/auth/AuthCallbackPage')) },
            {
              path: 'auth/reset-password',
              lazy: page(() => import('@/features/auth/ResetPasswordPage')),
            },
          ],
        },
        {
          element: <AppShell />,
          errorElement: <RouteError />,
          children: [
            { index: true, lazy: page(() => import('@/pages/LandingPage')) },
            {
              element: <RequireAuth />,
              children: [
                {
                  path: 'onboarding',
                  lazy: page(() => import('@/features/profile/OnboardingPage')),
                },
                { path: 'profile', lazy: page(() => import('@/features/profile/ProfilePage')) },
                {
                  path: 'dashboard',
                  lazy: page(() => import('@/features/dashboard/DashboardPage')),
                },
                {
                  element: <RequireAdmin />,
                  children: [],
                },
              ],
            },
            { path: '*', element: <NotFoundPage /> },
          ],
        },
      ],
    },
  ],
  { basename: BASE_PATH.replace(/\/$/, '') || '/' },
);
