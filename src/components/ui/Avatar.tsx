import { useState } from 'react';
import { cn, initials, safeHttpUrl } from '@/lib/utils';

const palette = [
  'bg-indigo-500',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-rose-500',
  'bg-sky-600',
  'bg-violet-600',
  'bg-teal-600',
  'bg-fuchsia-600',
];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length] ?? palette[0]!;
}

export function Avatar({
  name,
  url,
  seed,
  size = 'md',
  className,
}: {
  name: string | null | undefined;
  url?: string | null;
  seed?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = safeHttpUrl(url);
  const dims = {
    xs: 'size-6 text-[10px]',
    sm: 'size-8 text-xs',
    md: 'size-10 text-sm',
    lg: 'size-16 text-xl',
  }[size];
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn('shrink-0 rounded-full object-cover ring-2 ring-surface', dims, className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-semibold text-white ring-2 ring-surface',
        colorFor(seed ?? name ?? '?'),
        dims,
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
