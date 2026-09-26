import type { LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';

export interface MenuItem {
  label: ReactNode;
  icon?: LucideIcon;
  onSelect?: () => void;
  to?: string;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
}

/** Small dropdown menu (click to open, Esc/outside click to close, arrow-key navigation). */
export function Menu({
  trigger,
  triggerLabel,
  items,
  align = 'end',
  className,
  triggerClassName,
}: {
  trigger: ReactNode;
  triggerLabel: string;
  items: (MenuItem | 'separator')[];
  align?: 'start' | 'end';
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    const first = listRef.current?.querySelector<HTMLElement>(
      '[role="menuitem"]:not([aria-disabled="true"])',
    );
    first?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onListKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const nodes = [
      ...(listRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([aria-disabled="true"])',
      ) ?? []),
    ];
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === 'ArrowDown'
        ? (index + 1) % nodes.length
        : (index - 1 + nodes.length) % nodes.length;
    nodes[next]?.focus();
  };

  const visible = items.filter((item) => item === 'separator' || !item.hidden);
  const itemClass = (item: MenuItem) =>
    cn(
      'flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm outline-none',
      'hover:bg-surface-2 focus-visible:bg-surface-2',
      item.danger ? 'text-danger' : 'text-fg',
      item.disabled && 'pointer-events-none opacity-50',
    );

  return (
    <div ref={rootRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={triggerLabel}
        title={triggerLabel}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg',
          triggerClassName ?? 'size-8',
        )}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={listRef}
          id={menuId}
          role="menu"
          onKeyDown={onListKeyDown}
          className={cn(
            'absolute top-full z-50 mt-1 min-w-48 rounded-xl border border-border bg-surface p-1 shadow-lg',
            align === 'end' ? 'end-0' : 'start-0',
          )}
        >
          {visible.map((item, index) => {
            if (item === 'separator') {
              return <div key={`sep-${index}`} role="separator" className="my-1 h-px bg-border" />;
            }
            const content = (
              <>
                {item.icon && <item.icon className="size-4 shrink-0 opacity-80" aria-hidden />}
                <span className="truncate">{item.label}</span>
              </>
            );
            if (item.to && !item.disabled) {
              return (
                <Link
                  key={index}
                  to={item.to}
                  role="menuitem"
                  className={itemClass(item)}
                  onClick={() => setOpen(false)}
                >
                  {content}
                </Link>
              );
            }
            return (
              <button
                key={index}
                type="button"
                role="menuitem"
                aria-disabled={item.disabled || undefined}
                className={itemClass(item)}
                onClick={() => {
                  if (item.disabled) return;
                  setOpen(false);
                  item.onSelect?.();
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
