import { describe, expect, it } from 'vitest';
import { initials, safeHttpUrl, toAsciiDigits } from './utils';

describe('utils', () => {
  it('normalizes Persian and Arabic digits', () => {
    expect(toAsciiDigits('۱۲۳٬۴۵۶٫۷')).toBe('123456.7');
    expect(toAsciiDigits('٤٥٦')).toBe('456');
  });
  it('only accepts http(s) URLs', () => {
    expect(safeHttpUrl('https://example.org/a')).toBe('https://example.org/a');
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('not a url')).toBeNull();
  });
  it('builds initials', () => {
    expect(initials('Sara Ahmadi')).toBe('SA');
    expect(initials('')).toBe('?');
  });
});
