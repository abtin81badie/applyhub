import { describe, expect, it } from 'vitest';
import { safeNextPath } from './navigation';

describe('safeNextPath', () => {
  it('keeps in-app paths', () => {
    expect(safeNextPath('/rooms/abc?tab=notes')).toBe('/rooms/abc?tab=notes');
  });
  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    '',
    null,
  ])('rejects %s', (value) => {
    expect(safeNextPath(value)).toBe('/dashboard');
  });
  it('does not loop back to auth pages', () => {
    expect(safeNextPath('/login?next=/x')).toBe('/dashboard');
  });
});
