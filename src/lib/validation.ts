import type { TFunction } from 'i18next';
import type { z } from 'zod';

/**
 * Converts a ZodError into { fieldPath: translated message }.
 * Schemas use i18n keys ("validation.required") as custom messages; common
 * size/format issues are translated here with their parameters.
 */
export function zodFieldErrors(error: z.ZodError, t: TFunction): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (out[path]) continue;
    out[path] = translateIssue(issue, t);
  }
  return out;
}

function translateIssue(issue: z.core.$ZodIssue, t: TFunction): string {
  // Schemas may use i18n keys (e.g. "validation.required") as custom messages.
  if (issue.message && /^[a-z]+(\.[a-zA-Z_]+)+$/.test(issue.message))
    return t(issue.message as never);
  switch (issue.code) {
    case 'too_big':
      return t('validation.tooLong', { max: Number(issue.maximum) });
    case 'too_small':
      return Number(issue.minimum) <= 1
        ? t('validation.required')
        : t('validation.tooShort', { min: Number(issue.minimum) });
    case 'invalid_format':
      if (issue.format === 'email') return t('validation.invalidEmail');
      if (issue.format === 'url') return t('validation.invalidUrl');
      return t('validation.required');
    case 'invalid_type':
      return t('validation.required');
    default:
      return issue.message || t('validation.required');
  }
}
