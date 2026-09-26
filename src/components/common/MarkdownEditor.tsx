import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Input';
import { Markdown } from './Markdown';

export function MarkdownEditor({
  id,
  value,
  onChange,
  placeholder,
  rows = 8,
  maxLength,
  invalid,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  invalid?: boolean;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <SegmentedControl
          size="sm"
          label={t('common.preview')}
          value={mode}
          onChange={setMode}
          items={[
            { value: 'write', label: t('common.write') },
            { value: 'preview', label: t('common.preview') },
          ]}
        />
        <span className="text-xs text-muted">{t('common.markdownSupported')}</span>
      </div>
      {mode === 'write' ? (
        <Textarea
          id={id}
          dir="auto"
          value={value}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(event.target.value)}
          className="font-[inherit]"
        />
      ) : (
        <div className="min-h-24 rounded-lg border border-border bg-surface-2/50 p-3">
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <p className="text-sm text-muted">{t('common.nothingToPreview')}</p>
          )}
        </div>
      )}
    </div>
  );
}
