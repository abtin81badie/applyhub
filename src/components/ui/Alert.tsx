import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'info' | 'warning' | 'danger' | 'success';

const styles: Record<Tone, { box: string; icon: typeof Info }> = {
  info: { box: 'border-info/25 bg-info-soft text-info', icon: Info },
  warning: { box: 'border-warning/30 bg-warning-soft text-warning', icon: AlertTriangle },
  danger: { box: 'border-danger/25 bg-danger-soft text-danger', icon: XCircle },
  success: { box: 'border-success/25 bg-success-soft text-success', icon: CheckCircle2 },
};

export function Alert({
  tone = 'info',
  title,
  children,
  className,
  action,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  const { box, icon: Icon } = styles[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border p-3 text-sm', box, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-fg">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'text-fg/85')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
