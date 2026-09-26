import { z } from 'zod';

const EnvSchema = z.object({
  VITE_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  VITE_SUPABASE_ANON_KEY: z.string().min(20),
});

const parsed = EnvSchema.safeParse(import.meta.env);

/** Validated public configuration, or `null` when the build is missing it. */
export const env = parsed.success ? parsed.data : null;

/** Human-readable reasons shown on the configuration error screen. */
export const envErrors: string[] = parsed.success
  ? []
  : parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);

/** Base path the SPA is served from, always with leading and trailing slash. */
export const BASE_PATH = import.meta.env.BASE_URL;

/** Absolute URL for an in-app path, e.g. appUrl('auth/callback'). */
export function appUrl(path: string): string {
  const clean = path.replace(/^\/+/, '');
  return `${window.location.origin}${BASE_PATH}${clean}`;
}
