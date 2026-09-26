import {
  BookOpen,
  ExternalLink,
  GraduationCap,
  History,
  Link2,
  MapPin,
  Pencil,
  Plus,
  Search,
  School,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { useIntakeLabel } from '@/components/common/IntakeText';
import { Markdown } from '@/components/common/Markdown';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/QueryState';
import { SourceInfo } from '@/components/common/SourceInfo';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton, buttonClasses } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/Input';
import { PageLoader, Skeleton } from '@/components/ui/Spinner';
import { useProfileCards } from '@/features/profile/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { Json } from '@/lib/database.types';
import {
  DEGREE_LEVELS,
  GUIDE_SECTIONS,
  LANGUAGE_CODES,
  type DegreeLevel,
  type KbEntity,
} from '@/lib/domain';
import { describeError } from '@/lib/errors';
import { cn, safeHttpUrl, toAsciiDigits } from '@/lib/utils';
import { useAuth } from '@/providers/AuthProvider';
import { useFormat, usePreferences } from '@/providers/PreferencesProvider';
import { useToast } from '@/providers/ToastProvider';
import {
  useAddToTracker,
  useCountryGuide,
  useCountryLinks,
  useDirectory,
  useProgramUniversity,
  useRevisions,
  useUniversity,
  useUniversityCounts,
  type Program,
} from './api';
import { countryLabel, useCountries } from './countries';

const REGIONS = ['europe', 'americas', 'asia', 'oceania', 'africa', 'other'] as const;

function proposeUrl(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])),
  );
  return `/contribute/new?${search.toString()}`;
}

function languageName(t: (key: string) => string, code: string): string {
  return (LANGUAGE_CODES as readonly string[]).includes(code) ? t(`kb.languages.${code}`) : code;
}

// ---------------------------------------------------------------- countries --
export function CountriesPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('kb.countriesTitle'));
  const { locale } = usePreferences();
  const { data: countries, isPending, error, refetch } = useCountries();
  const { data: counts } = useUniversityCounts();
  const [q, setQ] = useState('');

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  const needle = q.trim().toLowerCase();
  const visible = (countries ?? []).filter(
    (c) =>
      !needle ||
      c.name_en.toLowerCase().includes(needle) ||
      c.name_fa.includes(q.trim()) ||
      c.code.toLowerCase() === needle,
  );

  return (
    <div>
      <PageHeader title={t('kb.countriesTitle')} description={t('kb.countriesSubtitle')} />
      <div className="relative mb-6 max-w-md">
        <Search
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <Input
          className="ps-9"
          dir="auto"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('kb.searchCountries')}
          aria-label={t('common.search')}
        />
      </div>
      {isPending ? (
        <Skeleton className="h-64" />
      ) : (
        REGIONS.map((region) => {
          const items = visible
            .filter((c) => c.region === region)
            .sort((a, b) => countryLabel(a, locale).localeCompare(countryLabel(b, locale), locale));
          if (items.length === 0) return null;
          return (
            <section key={region} className="mb-8">
              <h2 className="mb-3 text-sm font-semibold text-muted">{t(`kb.regions.${region}`)}</h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {items.map((c) => (
                  <li key={c.code}>
                    <Link
                      to={`/countries/${c.code}`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-xs transition-shadow hover:border-primary/40 hover:shadow-md"
                    >
                      <span className="text-2xl" aria-hidden>
                        {c.flag_emoji}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {countryLabel(c, locale)}
                        </span>
                        <span className="block text-xs text-muted">
                          {t('kb.universitiesCount', { count: counts?.get(c.code) ?? 0 })}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

// ------------------------------------------------------------------ country --
function GuideTab({ code }: { code: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { locale } = usePreferences();
  const { data, isPending } = useCountryGuide(code);
  if (isPending) return <Skeleton className="h-64" />;
  const rows = data ?? [];
  const other = locale === 'fa' ? 'en' : 'fa';
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title={t('kb.noGuide')}
        action={
          user ? (
            <LinkButton to={proposeUrl({ entity: 'country_guide', country: code })}>
              {t('kb.proposeSection')}
            </LinkButton>
          ) : undefined
        }
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {rows.some((r) => r.is_placeholder) && (
        <Alert tone="warning">{t('kb.placeholderNotice')}</Alert>
      )}
      {GUIDE_SECTIONS.map((section) => {
        const row =
          rows.find((r) => r.section === section && r.locale === locale) ??
          rows.find((r) => r.section === section && r.locale === other);
        return (
          <Card key={section} id={section}>
            <CardHeader
              title={t(`enums.guideSection.${section}`)}
              actions={
                user && (
                  <LinkButton
                    variant="ghost"
                    size="sm"
                    to={proposeUrl(
                      row && row.locale === locale
                        ? { entity: 'country_guide', action: 'update', id: row.id, country: code }
                        : { entity: 'country_guide', country: code, section, locale },
                    )}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                    {row ? t('kb.proposeEdit') : t('kb.proposeSection')}
                  </LinkButton>
                )
              }
            />
            <CardBody className="flex flex-col gap-3">
              {row ? (
                <>
                  {row.locale !== locale && (
                    <p className="text-xs text-muted">
                      {t('kb.guideOtherLocale', {
                        language: row.locale === 'fa' ? 'فارسی' : 'English',
                      })}
                    </p>
                  )}
                  <Markdown>{row.body_md}</Markdown>
                  <SourceInfo
                    sourceUrl={row.source_url}
                    lastVerifiedAt={row.last_verified_at}
                    isPlaceholder={row.is_placeholder}
                  />
                  {row && (
                    <Link
                      to={`/history/country_guide/${row.id}`}
                      className="self-start text-xs text-muted hover:text-primary"
                    >
                      <History className="me-1 inline size-3" aria-hidden />
                      {t('kb.history')}
                    </Link>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted">{t('kb.missingSection')}</p>
              )}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

function UniversitiesTab({ code }: { code: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { locale } = usePreferences();
  const fmt = useFormat();
  const { data, isPending } = useDirectory(code);
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [field, setField] = useState('');
  const [language, setLanguage] = useState('');
  const [degree, setDegree] = useState('');
  const [maxTuition, setMaxTuition] = useState('');
  const rows = useMemo(() => data ?? [], [data]);
  const cities = [
    ...new Set(rows.map((r) => r.city).filter((c): c is string => Boolean(c))),
  ].sort();
  const languages = [...new Set(rows.flatMap((r) => r.languages ?? []))].sort();
  const max = Number(toAsciiDigits(maxTuition));
  const visible = rows.filter((r) => {
    if (q.trim() && !(r.search_text ?? '').includes(q.trim().toLowerCase())) return false;
    if (city && r.city !== city) return false;
    if (
      field.trim() &&
      !(r.fields ?? []).some((f) => f.toLowerCase().includes(field.trim().toLowerCase()))
    )
      return false;
    if (language && !(r.languages ?? []).includes(language)) return false;
    if (degree && !(r.degree_levels ?? []).includes(degree as DegreeLevel)) return false;
    if (
      maxTuition &&
      Number.isFinite(max) &&
      (r.min_yearly_tuition ?? Number.POSITIVE_INFINITY) > max &&
      r.min_yearly_tuition !== 0
    )
      return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 rounded-xl border border-border bg-surface p-3 sm:grid-cols-3 lg:grid-cols-6">
        <Input
          dir="auto"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('kb.filters.search')}
          aria-label={t('kb.filters.search')}
          className="lg:col-span-2"
        />
        <Select
          aria-label={t('kb.filters.city')}
          value={city}
          onChange={(e) => setCity(e.target.value)}
        >
          <option value="">
            {t('kb.filters.city')}: {t('kb.allFilters')}
          </option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Input
          dir="auto"
          value={field}
          onChange={(e) => setField(e.target.value)}
          placeholder={t('kb.filters.fieldPlaceholder')}
          aria-label={t('kb.filters.field')}
        />
        <Select
          aria-label={t('kb.filters.language')}
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="">
            {t('kb.filters.language')}: {t('kb.allFilters')}
          </option>
          {languages.map((l) => (
            <option key={l} value={l}>
              {languageName(t as unknown as (key: string) => string, l)}
            </option>
          ))}
        </Select>
        <Select
          aria-label={t('kb.filters.degree')}
          value={degree}
          onChange={(e) => setDegree(e.target.value)}
        >
          <option value="">
            {t('kb.filters.degree')}: {t('kb.allFilters')}
          </option>
          {DEGREE_LEVELS.map((d) => (
            <option key={d} value={d}>
              {t(`enums.degree.${d}`)}
            </option>
          ))}
        </Select>
        <Input
          inputMode="numeric"
          dir="ltr"
          value={maxTuition}
          onChange={(e) => setMaxTuition(e.target.value)}
          placeholder={t('kb.filters.tuitionMax')}
          aria-label={t('kb.filters.tuitionMax')}
          className="sm:col-span-3 lg:col-span-2"
        />
      </div>
      {user && (
        <div>
          <LinkButton
            variant="outline"
            size="sm"
            to={proposeUrl({ entity: 'university', country: code })}
          >
            <Plus className="size-4" aria-hidden />
            {t('kb.suggestUniversity')}
          </LinkButton>
        </div>
      )}
      {isPending ? (
        <Skeleton className="h-40" />
      ) : visible.length === 0 ? (
        <EmptyState icon={School} title={t('kb.noUniversities')} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visible.map((u) => (
            <li key={u.id}>
              <div className="relative h-full rounded-xl border border-border bg-surface p-4 shadow-xs hover:border-primary/40 hover:shadow-md">
                <Link
                  to={`/universities/${u.id}`}
                  className="font-semibold after:absolute after:inset-0 hover:text-primary"
                  dir="auto"
                >
                  {(locale === 'fa' && u.name_fa) || u.name_en}
                </Link>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  {u.city && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" aria-hidden />
                      {u.city}
                    </span>
                  )}
                  <span>{t('kb.university.programsCount', { count: u.program_count ?? 0 })}</span>
                  {(u.languages ?? []).length > 0 && (
                    <span>
                      {(u.languages ?? [])
                        .map((l) => languageName(t as unknown as (key: string) => string, l))
                        .join('، ')}
                    </span>
                  )}
                  {u.min_yearly_tuition !== null && (
                    <span>
                      {t('kb.university.tuitionRange')}:{' '}
                      {u.min_yearly_tuition === 0
                        ? t('kb.university.free')
                        : fmt.money(u.min_yearly_tuition, u.tuition_currency)}
                      {u.max_yearly_tuition && u.max_yearly_tuition !== u.min_yearly_tuition
                        ? ` – ${fmt.money(u.max_yearly_tuition, u.tuition_currency)}`
                        : ''}
                    </span>
                  )}
                </p>
                <SourceInfo
                  className="relative z-10 mt-2"
                  compact
                  sourceUrl={u.source_url}
                  lastVerifiedAt={u.last_verified_at}
                  isPlaceholder={u.is_placeholder}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LinksTab({ code }: { code: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { locale } = usePreferences();
  const { data, isPending } = useCountryLinks(code);
  if (isPending) return <Skeleton className="h-32" />;
  return (
    <div className="flex flex-col gap-3">
      {user && (
        <LinkButton
          variant="outline"
          size="sm"
          className="self-start"
          to={proposeUrl({ entity: 'country_link', country: code })}
        >
          <Plus className="size-4" aria-hidden />
          {t('kb.suggestLink')}
        </LinkButton>
      )}
      {(data ?? []).length === 0 ? (
        <EmptyState icon={Link2} title={t('kb.noLinks')} />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {(data ?? []).map((link) => {
              const href = safeHttpUrl(link.url);
              return (
                <li key={link.id} className="flex flex-col gap-1 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        {(locale === 'fa' && link.label_fa) || link.label_en}
                        <ExternalLink className="size-3.5" aria-hidden />
                      </a>
                    ) : (
                      <span className="font-medium">{link.label_en}</span>
                    )}
                    <Badge>{t(`kb.linkCategory.${link.category as 'other'}`)}</Badge>
                    {user && (
                      <Link
                        className="ms-auto text-xs text-muted hover:text-primary"
                        to={proposeUrl({
                          entity: 'country_link',
                          action: 'update',
                          id: link.id,
                          country: code,
                        })}
                      >
                        {t('kb.proposeEdit')}
                      </Link>
                    )}
                  </div>
                  {link.description && (
                    <p className="text-sm text-muted" dir="auto">
                      {link.description}
                    </p>
                  )}
                  <SourceInfo
                    sourceUrl={link.url}
                    lastVerifiedAt={link.last_verified_at}
                    isPlaceholder={link.is_placeholder}
                    compact
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

export function CountryPage() {
  const { t } = useTranslation();
  const { code = '' } = useParams();
  const upper = code.toUpperCase();
  const { locale } = usePreferences();
  const { data: countries, isPending } = useCountries();
  const [tab, setTab] = useState<'guide' | 'universities' | 'links'>('guide');
  const country = countries?.find((c) => c.code === upper);
  useDocumentTitle(country ? countryLabel(country, locale) : t('kb.countriesTitle'));
  if (isPending) return <PageLoader />;
  if (!country)
    return (
      <EmptyState
        title={t('errors.notFoundTitle')}
        action={<LinkButton to="/countries">{t('nav.countries')}</LinkButton>}
      />
    );

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link to="/countries" className="hover:text-fg">
            {t('nav.countries')}
          </Link>
        }
        title={`${country.flag_emoji ?? ''} ${countryLabel(country, locale)}`}
        description={t('kb.disclaimer')}
      />
      <div className="mb-5 flex gap-1 border-b border-border">
        {(['guide', 'universities', 'links'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-current={tab === key ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2.5 text-sm font-medium',
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-fg',
            )}
          >
            {key === 'guide'
              ? t('kb.guide')
              : key === 'universities'
                ? t('kb.universities')
                : t('kb.officialLinks')}
          </button>
        ))}
      </div>
      {tab === 'guide' && <GuideTab code={upper} />}
      {tab === 'universities' && <UniversitiesTab code={upper} />}
      {tab === 'links' && <LinksTab code={upper} />}
    </div>
  );
}

// --------------------------------------------------------------- university --
function ProgramCard({ program, universityId }: { program: Program; universityId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { locale } = usePreferences();
  const fmt = useFormat();
  const intake = useIntakeLabel();
  const toast = useToast();
  const navigate = useNavigate();
  const add = useAddToTracker();
  const deadlines = [...program.program_deadlines].sort((a, b) =>
    a.deadline_at.localeCompare(b.deadline_at),
  );
  const requirements = [...program.program_requirements].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  return (
    <Card id={`program-${program.id}`}>
      <CardHeader
        title={<span dir="auto">{(locale === 'fa' && program.name_fa) || program.name_en}</span>}
        description={[
          t(`enums.degree.${program.degree_level}`),
          program.field,
          program.languages
            .map((l) => languageName(t as unknown as (key: string) => string, l))
            .join('، '),
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          user && (
            <Button
              size="sm"
              loading={add.isPending}
              onClick={() =>
                add.mutate(
                  { programId: program.id, locale },
                  {
                    onSuccess: (id) => {
                      toast.success(t('kb.university.addedToTracker'));
                      navigate(`/applications/${id}`);
                    },
                    onError: (e) => toast.error(describeError(e, t)),
                  },
                )
              }
            >
              <Plus className="size-4" aria-hidden />
              {t('kb.university.addToTracker')}
            </Button>
          )
        }
      />
      <CardBody className="flex flex-col gap-4">
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          {program.duration_months && (
            <div>
              <dt className="text-xs text-muted">{t('kb.program.duration')}</dt>
              <dd>{t('kb.program.durationMonths', { count: program.duration_months })}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted">{t('kb.program.tuition')}</dt>
            <dd>
              {program.tuition_amount_min === null
                ? '—'
                : program.tuition_amount_min === 0 && !program.tuition_amount_max
                  ? t('kb.university.free')
                  : `${fmt.money(program.tuition_amount_min, program.tuition_currency)}${program.tuition_amount_max && program.tuition_amount_max !== program.tuition_amount_min ? ` – ${fmt.money(program.tuition_amount_max, program.tuition_currency)}` : ''}${program.tuition_period ? ` ${t(`enums.tuitionPeriod.${program.tuition_period}`)}` : ''}`}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t('kb.program.applicationFee')}</dt>
            <dd>
              {program.application_fee_amount === null
                ? '—'
                : fmt.money(program.application_fee_amount, program.application_fee_currency)}
            </dd>
          </div>
        </dl>
        <SourceInfo
          sourceUrl={program.source_url}
          lastVerifiedAt={program.last_verified_at}
          isPlaceholder={program.is_placeholder}
        />
        {program.description_md && <Markdown>{program.description_md}</Markdown>}

        <div>
          <h3 className="mb-2 text-sm font-semibold">{t('kb.program.requirements')}</h3>
          {requirements.length === 0 ? (
            <p className="text-sm text-muted">{t('kb.program.noRequirements')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {requirements.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone={r.is_mandatory ? 'primary' : 'neutral'}>
                      {r.is_mandatory ? t('kb.program.mandatory') : t('kb.program.recommended')}
                    </Badge>
                    <span className="text-xs text-muted">{t(`enums.requirement.${r.kind}`)}</span>
                    <span dir="auto">{r.description}</span>
                    {user && (
                      <Link
                        className="ms-auto text-xs text-muted hover:text-primary"
                        to={proposeUrl({
                          entity: 'program_requirement',
                          action: 'update',
                          id: r.id,
                          parent: program.id,
                        })}
                      >
                        {t('kb.proposeEdit')}
                      </Link>
                    )}
                  </div>
                  <SourceInfo
                    compact
                    sourceUrl={r.source_url}
                    lastVerifiedAt={r.last_verified_at}
                    isPlaceholder={r.is_placeholder}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">{t('kb.program.deadlines')}</h3>
          {deadlines.length === 0 ? (
            <p className="text-sm text-muted">{t('kb.program.noDeadlines')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {deadlines.map((d) => (
                <li key={d.id} className="flex flex-col gap-1 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{fmt.dateTime(d.deadline_at)}</span>
                    <span dir="auto">{d.round_label}</span>
                    {intake(d.intake_term, d.intake_year) && (
                      <Badge>{intake(d.intake_term, d.intake_year)}</Badge>
                    )}
                    <Badge tone="info">{t(`enums.applicantGroup.${d.applicant_group}`)}</Badge>
                    {user && (
                      <Link
                        className="ms-auto text-xs text-muted hover:text-primary"
                        to={proposeUrl({
                          entity: 'program_deadline',
                          action: 'update',
                          id: d.id,
                          parent: program.id,
                        })}
                      >
                        {t('kb.proposeEdit')}
                      </Link>
                    )}
                  </div>
                  {d.opens_at && (
                    <p className="text-xs text-muted">
                      {t('kb.program.opens', { date: fmt.date(d.opens_at) })}
                    </p>
                  )}
                  {d.notes && (
                    <p className="text-xs text-muted" dir="auto">
                      {d.notes}
                    </p>
                  )}
                  <SourceInfo
                    compact
                    sourceUrl={d.source_url}
                    lastVerifiedAt={d.last_verified_at}
                    isPlaceholder={d.is_placeholder}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
        {user && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <LinkButton
              variant="ghost"
              size="sm"
              to={proposeUrl({
                entity: 'program',
                action: 'update',
                id: program.id,
                parent: universityId,
              })}
            >
              <Pencil className="size-3.5" aria-hidden />
              {t('kb.proposeEdit')}
            </LinkButton>
            <LinkButton
              variant="ghost"
              size="sm"
              to={proposeUrl({ entity: 'program_requirement', parent: program.id })}
            >
              {t('kb.suggestRequirement')}
            </LinkButton>
            <LinkButton
              variant="ghost"
              size="sm"
              to={proposeUrl({ entity: 'program_deadline', parent: program.id })}
            >
              {t('kb.suggestDeadline')}
            </LinkButton>
            <LinkButton variant="ghost" size="sm" to={`/history/program/${program.id}`}>
              <History className="size-3.5" aria-hidden />
              {t('kb.history')}
            </LinkButton>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export function UniversityPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { locale } = usePreferences();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, isPending, error, refetch } = useUniversity(id);
  const add = useAddToTracker();
  useDocumentTitle(
    data?.university
      ? (locale === 'fa' && data.university.name_fa) || data.university.name_en
      : t('kb.universities'),
  );
  if (isPending) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data) return <EmptyState icon={School} title={t('kb.university.notFound')} />;
  const { university: u, programs } = data;
  const website = safeHttpUrl(u.website_url);

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link to={`/countries/${u.country_code}`} className="hover:text-fg">
            {u.country_code}
          </Link>
        }
        title={(locale === 'fa' && u.name_fa) || u.name_en}
        description={[
          u.city,
          u.institution_type && t(`enums.institutionType.${u.institution_type as 'public'}`),
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses({ variant: 'outline', size: 'sm' })}
              >
                <ExternalLink className="size-4" aria-hidden />
                {t('kb.university.website')}
              </a>
            )}
            {user && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  loading={add.isPending}
                  onClick={() =>
                    add.mutate(
                      { universityId: u.id, locale },
                      {
                        onSuccess: (appId) => {
                          toast.success(t('kb.university.addedToTracker'));
                          navigate(`/applications/${appId}`);
                        },
                        onError: (e) => toast.error(describeError(e, t)),
                      },
                    )
                  }
                >
                  <Plus className="size-4" aria-hidden />
                  {t('kb.university.addToTracker')}
                </Button>
                <LinkButton
                  size="sm"
                  variant="ghost"
                  to={proposeUrl({ entity: 'university', action: 'update', id: u.id })}
                >
                  <Pencil className="size-4" aria-hidden />
                  {t('kb.proposeEdit')}
                </LinkButton>
              </>
            )}
            <LinkButton size="sm" variant="ghost" to={`/history/university/${u.id}`}>
              <History className="size-4" aria-hidden />
              {t('kb.history')}
            </LinkButton>
          </>
        }
      />
      <SourceInfo
        className="mb-4"
        sourceUrl={u.source_url}
        lastVerifiedAt={u.last_verified_at}
        isPlaceholder={u.is_placeholder}
      />
      {u.description_md && <Markdown className="mb-6">{u.description_md}</Markdown>}
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <GraduationCap className="size-5" aria-hidden />
          {t('kb.programs')}
        </h2>
        {user && (
          <LinkButton
            size="sm"
            variant="outline"
            to={proposeUrl({ entity: 'program', parent: u.id })}
          >
            <Plus className="size-4" aria-hidden />
            {t('kb.suggestProgram')}
          </LinkButton>
        )}
      </div>
      {programs.length === 0 ? (
        <EmptyState icon={GraduationCap} title={t('kb.noPrograms')} />
      ) : (
        <div className="flex flex-col gap-4">
          {programs.map((p) => (
            <ProgramCard key={p.id} program={p} universityId={u.id} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ProgramRedirect() {
  const { id = '' } = useParams();
  const { data, isPending } = useProgramUniversity(id);
  if (isPending) return <PageLoader />;
  return <Navigate to={data ? `/universities/${data}#program-${id}` : '/countries'} replace />;
}

// ------------------------------------------------------------------ history --
function asRecord(value: Json | null): Record<string, Json> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Json>)
    : {};
}

export function changedFields(
  before: Json | null,
  after: Json | null,
): { key: string; before: string; after: string }[] {
  const a = asRecord(before);
  const b = asRecord(after);
  const skip = new Set(['id', 'created_at', 'updated_at', 'created_by']);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((k) => !skip.has(k) && JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null))
    .map((key) => ({
      key,
      before:
        a[key] === undefined || a[key] === null
          ? '—'
          : typeof a[key] === 'string'
            ? (a[key] as string)
            : JSON.stringify(a[key]),
      after:
        b[key] === undefined || b[key] === null
          ? '—'
          : typeof b[key] === 'string'
            ? (b[key] as string)
            : JSON.stringify(b[key]),
    }));
}

export function DiffTable({ rows }: { rows: { key: string; before: string; after: string }[] }) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-muted">
          <tr>
            <th className="p-1.5 text-start">{t('moderation.field')}</th>
            <th className="p-1.5 text-start">{t('moderation.before')}</th>
            <th className="p-1.5 text-start">{t('moderation.after')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.key} className="align-top">
              <td className="p-1.5 font-mono">{r.key}</td>
              <td
                className="max-w-xs p-1.5 break-words whitespace-pre-wrap text-danger/90"
                dir="auto"
              >
                {r.before}
              </td>
              <td
                className="max-w-xs p-1.5 break-words whitespace-pre-wrap text-success"
                dir="auto"
              >
                {r.after}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HistoryPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('history.title'));
  const fmt = useFormat();
  const { entityType = '', entityId = '' } = useParams();
  const { data, isPending } = useRevisions(entityType as KbEntity, entityId);
  const cards = useProfileCards((data ?? []).map((r) => r.changed_by));
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t('history.title')}
        eyebrow={t(`enums.kbEntity.${entityType as KbEntity}`)}
      />
      {isPending ? (
        <Skeleton className="h-40" />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={History} title={t('history.empty')} />
      ) : (
        <ol className="flex flex-col gap-3">
          {(data ?? []).map((rev) => (
            <li key={rev.id}>
              <Card>
                <CardBody className="flex flex-col gap-2">
                  <p className="text-sm">
                    <Badge
                      tone={
                        rev.action === 'delete'
                          ? 'danger'
                          : rev.action === 'insert'
                            ? 'success'
                            : 'info'
                      }
                    >
                      {t(
                        `history.${rev.action === 'insert' ? 'created' : rev.action === 'update' ? 'updated' : 'deleted'}`,
                      )}
                    </Badge>{' '}
                    <span className="text-muted">
                      {fmt.dateTime(rev.changed_at)}
                      {rev.changed_by &&
                        ` · ${t('history.changedBy', { name: cards.data?.get(rev.changed_by)?.display_name ?? t('common.someone') })}`}
                      {rev.proposal_id && ` · ${t('history.viaProposal')}`}
                    </span>
                  </p>
                  <DiffTable rows={changedFields(rev.old_data, rev.new_data)} />
                </CardBody>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
