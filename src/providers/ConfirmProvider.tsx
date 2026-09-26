import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';

export interface ConfirmOptions {
  title: ReactNode;
  body?: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  /** When set, the user must type this text to enable the confirm button. */
  typeToConfirm?: string;
  typeToConfirmLabel?: string;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [typed, setTyped] = useState('');
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    setTyped('');
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  };

  const blocked =
    Boolean(options?.typeToConfirm) && typed.trim() !== options?.typeToConfirm?.trim();

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={options !== null}
        onClose={() => close(false)}
        title={options?.title}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => close(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={options?.tone === 'primary' ? 'primary' : 'danger'}
              disabled={blocked}
              onClick={() => close(true)}
            >
              {options?.confirmLabel ?? t('common.confirm')}
            </Button>
          </>
        }
      >
        {options?.body && <div className="text-sm text-muted">{options.body}</div>}
        {options?.typeToConfirm && (
          <div className="mt-3 flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="confirm-type">
              {options.typeToConfirmLabel}
            </label>
            <Input
              id="confirm-type"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}
