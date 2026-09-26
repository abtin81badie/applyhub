import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';

export interface TabLinkItem {
  to: string;
  label: ReactNode;
  icon?: LucideIcon;
  end?: boolean;
  badge?: ReactNode;
}

/** Route-driven tabs (each tab is a link), horizontally scrollable on phones. */
export function TabNav({
  items,
  className,
  label,
}: {
  items: TabLinkItem[];
  className?: string;
  label: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn('scrollbar-thin -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0', className)}
    >
      <ul className="flex min-w-max gap-1 border-b border-border">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  '-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted hover:border-border hover:text-fg',
                )
              }
            >
              {item.icon && <item.icon className="size-4" aria-hidden />}
              {item.label}
              {item.badge}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export interface SegmentItem<T extends string> {
  value: T;
  label: ReactNode;
  icon?: LucideIcon;
}

/** State-driven segmented control (e.g. board / table / calendar). */
export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
  size = 'md',
}: {
  items: SegmentItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex rounded-lg border border-border bg-surface-2 p-0.5', className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              active ? 'bg-surface text-fg shadow-xs' : 'text-muted hover:text-fg',
            )}
          >
            {item.icon && <item.icon className="size-4" aria-hidden />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
