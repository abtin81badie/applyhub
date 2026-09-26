import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { env } from './env';

/**
 * Browser Supabase client. Only the public anon key is used here: every
 * permission is enforced by Row Level Security in the database.
 *
 * When the build is missing its configuration the app renders a setup screen
 * instead of using this client (see App.tsx), so the placeholder values below
 * are never contacted.
 */
export const supabase = createClient<Database>(
  env?.VITE_SUPABASE_URL ?? 'http://localhost:54321',
  env?.VITE_SUPABASE_ANON_KEY ?? 'missing-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Tokens from magic links / OAuth arrive in the URL of /auth/callback.
      detectSessionInUrl: true,
      // Implicit flow lets e-mail links work even when opened in another
      // browser (e.g. a phone's mail app); PKCE would require the same browser.
      flowType: 'implicit',
    },
    realtime: {
      params: { eventsPerSecond: 5 },
    },
  },
);

export type SupabaseClient = typeof supabase;
