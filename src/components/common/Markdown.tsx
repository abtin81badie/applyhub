import type { ReactNode } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

/** Allow-list for rendered markdown: no raw HTML, no scripts, no data: URLs. */
const schema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
  },
  tagNames: (defaultSchema.tagNames ?? []).filter((tag) => !['img', 'input'].includes(tag)),
};

export function safeUrlTransform(url: string): string {
  const transformed = defaultUrlTransform(url);
  return /^(https?:|mailto:|#|\/)/i.test(transformed) ? transformed : '';
}

/**
 * Renders user-written Markdown safely: raw HTML is skipped, the result is
 * sanitized, links open in a new tab without referrer, and images are shown
 * as links (remote images could be used to track readers).
 */
export function Markdown({
  children,
  className,
}: {
  children: string | null | undefined;
  className?: string;
}) {
  if (!children?.trim()) return null;
  return (
    <div className={cn('prose-app', className)}>
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, schema]]}
        urlTransform={safeUrlTransform}
        components={{
          a: ({ href, children: linkChildren }) =>
            href ? (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc">
                {linkChildren}
              </a>
            ) : (
              <span>{linkChildren}</span>
            ),
          img: ({ src, alt }) => {
            const href = typeof src === 'string' ? safeUrlTransform(src) : '';
            return href ? (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc">
                {alt || href}
              </a>
            ) : null;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export function MarkdownOrEmpty({
  children,
  empty,
}: {
  children: string | null | undefined;
  empty: ReactNode;
}) {
  return children?.trim() ? (
    <Markdown>{children}</Markdown>
  ) : (
    <p className="text-sm text-muted">{empty}</p>
  );
}
