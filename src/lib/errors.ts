import type { TFunction } from 'i18next';

interface ErrorLike {
  message?: string;
  code?: string;
  hint?: string | null;
  details?: string | null;
  status?: number;
  name?: string;
}

const KNOWN_CODES: Record<string, string> = {
  rate_limited: 'errors.rateLimited',
  not_authorized: 'errors.permission',
  not_authenticated: 'auth.signInRequired',
  invite_invalid: 'rooms.joinPage.invalid',
  last_owner: 'rooms.members.lastOwner',
};

/**
 * Turns Supabase/PostgREST/Auth errors into a short, translated message.
 * Database functions raise stable identifiers (e.g. "rate_limited") with a
 * human-readable HINT, which is shown when there is no translation.
 */
export function describeError(error: unknown, t: TFunction): string {
  if (!error) return '';
  const e = (typeof error === 'object' ? error : { message: String(error) }) as ErrorLike;
  const message = e.message ?? '';

  const knownKey = KNOWN_CODES[message];
  if (knownKey) return t(knownKey as never);
  if (/^[a-z_]+$/.test(message) && e.hint) return e.hint;

  if (e.code === '42501' || /row-level security|permission denied/i.test(message)) {
    return t('errors.permission');
  }
  if (e.code === '23514' || e.code === '22P02' || e.code === '23502') {
    return e.hint ?? t('errors.saveFailed');
  }
  if (/Failed to fetch|NetworkError|network/i.test(message)) return t('errors.network');
  return message || t('errors.genericBody');
}

/** Error text for Supabase Auth errors (sign in / sign up / reset). */
export function describeAuthError(error: unknown, t: TFunction): string {
  const e = (error ?? {}) as ErrorLike;
  const code = e.code ?? '';
  const message = e.message ?? '';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return t('auth.errors.invalidCredentials');
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return t('auth.errors.emailNotConfirmed');
  }
  if (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    /already registered/i.test(message)
  ) {
    return t('auth.errors.userExists');
  }
  if (code.startsWith('over_') || e.status === 429 || /rate limit|too many/i.test(message)) {
    return t('auth.errors.rateLimited');
  }
  if (code === 'weak_password' || /password should be/i.test(message)) {
    return t('auth.errors.weakPassword');
  }
  if (code === 'otp_expired' || /expired|invalid.*(token|otp)/i.test(message)) {
    return t('auth.errors.otpExpired');
  }
  if (
    code === 'provider_disabled' ||
    /provider is not enabled|unsupported provider/i.test(message)
  ) {
    return t('auth.errors.providerDisabled');
  }
  if (/Failed to fetch|NetworkError/i.test(message)) return t('errors.network');
  return message || t('auth.errors.generic');
}
