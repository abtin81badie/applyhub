import { describe, expect, it } from 'vitest';
import { render404 } from './spa-fallback';

describe('404 fallback', () => {
  it('keeps no path segments for a user site', () => {
    expect(render404(0)).toContain('var pathSegmentsToKeep = 0;');
  });
  it('keeps the repository segment for a project site', () => {
    expect(render404(1)).toContain('var pathSegmentsToKeep = 1;');
  });
});
