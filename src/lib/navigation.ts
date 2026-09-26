/**
 * Only allow same-app relative paths as post-login destinations
 * (prevents open redirects such as ?next=https://evil.example or //evil).
 */
export function safeNextPath(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  if (/^\/(login|signup|auth\/callback)/.test(next)) return fallback;
  return next;
}

const NEXT_KEY = 'applyhub.next';

/** Remembers where to go after an OAuth / magic-link round trip. */
export function rememberNext(next: string | null | undefined): void {
  try {
    sessionStorage.setItem(NEXT_KEY, safeNextPath(next));
  } catch {
    /* ignore */
  }
}

export function consumeNext(): string {
  try {
    const value = sessionStorage.getItem(NEXT_KEY);
    sessionStorage.removeItem(NEXT_KEY);
    return safeNextPath(value);
  } catch {
    return '/dashboard';
  }
}
