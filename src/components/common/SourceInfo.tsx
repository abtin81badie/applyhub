import { AlertTriangle, BadgeCheck, ExternalLink, FlaskConical, HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isStale } from '@/lib/dates';
import { cn, hostnameOf, safeHttpUrl } from '@/lib/utils';
import { useFormat } from '@/providers/PreferencesProvider';

/**
 * Provenance line required for every knowledge-base fact: source link,
 * verification date, a warning when older than 6 months, and a badge for
 * placeholder examples.
 */
export function SourceInfo({
  sourceUrl,
  lastVerifiedAt,
  isPlaceholder,
  className,
  compact = false,
}: {
  sourceUrl: string | null | undefined;
  lastVerifiedAt: string | null | undefined;
  isPlaceholder?: boolean | null;
  className?: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const href = safeHttpUrl(sourceUrl);
  const stale = isStale(lastVerifiedAt);

  return (
    <div
      className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted', className)}
    >
      {isPlaceholder && (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 font-medium text-warning"
          title={t('kb.source.placeholderHint')}
        >
          <FlaskConical className="size-3" aria-hidden />
          {t('kb.source.placeholder')}
        </span>
      )}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-1 hover:text-primary"
          title={t('common.externalLink')}
        >
          <ExternalLink className="size-3" aria-hidden />
          {compact ? hostnameOf(href) : `${t('kb.source.source')}: ${hostnameOf(href)}`}
        </a>
      ) : (
        !isPlaceholder && <span>{t('kb.source.noSource')}</span>
      )}
      {lastVerifiedAt ? (
        <span className="inline-flex items-center gap-1">
          <BadgeCheck className="size-3" aria-hidden />
          {t('kb.source.verified', { date: fmt.date(lastVerifiedAt) })}
        </span>
      ) : (
        !isPlaceholder && (
          <span className="inline-flex items-center gap-1">
            <HelpCircle className="size-3" aria-hidden />
            {t('kb.source.notVerified')}
          </span>
        )
      )}
      {!isPlaceholder && stale && (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 font-medium text-warning"
          title={t('kb.source.staleHint')}
        >
          <AlertTriangle className="size-3" aria-hidden />
          {t('kb.source.stale')}
        </span>
      )}
    </div>
  );
}
