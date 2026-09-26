import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

const control =
  'w-full rounded-lg border border-border bg-surface text-fg shadow-xs transition-colors outline-none ' +
  'placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/20 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:ring-danger/20';

export function Input({
  className,
  ref,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(control, 'h-10 px-3 text-sm', className)} {...props} />;
}

export function Textarea({
  className,
  ref,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return (
    <textarea
      ref={ref}
      className={cn(control, 'min-h-24 px-3 py-2 text-sm leading-6', className)}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ref,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return (
    <select ref={ref} className={cn(control, 'h-10 px-3 pe-8 text-sm', className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({
  className,
  label,
  ref,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; ref?: Ref<HTMLInputElement> }) {
  const box = (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        'size-4 shrink-0 cursor-pointer rounded border-border accent-[var(--primary)]',
        className,
      )}
      {...props}
    />
  );
  if (!label) return box;
  return (
    <label className="inline-flex cursor-pointer items-start gap-2 text-sm leading-5">
      <span className="pt-0.5">{box}</span>
      <span>{label}</span>
    </label>
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium text-fg', className)} {...props} />;
}

export interface FieldProps {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  optionalLabel?: string;
  className?: string;
  children: ReactNode;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  optionalLabel = 'optional',
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {optional && (
            <span className="ms-1 text-xs font-normal text-muted">({optionalLabel})</span>
          )}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
