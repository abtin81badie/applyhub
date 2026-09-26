import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown } from './Markdown';

describe('<Markdown>', () => {
  it('renders formatting and safe links', () => {
    const { container } = render(
      <Markdown>{'# Title\n\n**bold** [site](https://example.org)'}</Markdown>,
    );
    expect(container.querySelector('h1')?.textContent).toBe('Title');
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.org');
    expect(link?.getAttribute('rel')).toContain('noopener');
    expect(link?.getAttribute('target')).toBe('_blank');
  });

  it('never renders raw HTML or scripts', () => {
    const { container } = render(
      <Markdown>
        {'<script>alert(1)</script><img src=x onerror=alert(1)><b onclick="x()">hi</b>'}
      </Markdown>,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('[onerror]')).toBeNull();
    expect(container.querySelector('[onclick]')).toBeNull();
    expect(container.innerHTML).not.toContain('<script');
  });

  it('drops dangerous link protocols', () => {
    const { container } = render(
      <Markdown>{'[x](javascript:alert(1)) [y](data:text/html;base64,AAAA)'}</Markdown>,
    );
    for (const a of container.querySelectorAll('a')) {
      expect(a.getAttribute('href') ?? '').not.toMatch(/^(javascript|data):/i);
    }
  });

  it('turns images into links instead of loading them', () => {
    const { container } = render(
      <Markdown>{'![tracker](https://example.org/pixel.png)'}</Markdown>,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('a')?.getAttribute('href')).toBe(
      'https://example.org/pixel.png',
    );
  });
});
