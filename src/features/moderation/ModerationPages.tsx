import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpenCheck, Check, GitPullRequestArrow, Trash2, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { CountrySelect } from '@/components/common/CountrySelect';
import { DateInput } from '@/components/common/DateInput';
import { MarkdownEditor } from '@/components/common/MarkdownEditor';
import { PageHeader } from '@/components/common/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Input';
import { PageLoader, Skeleton } from '@/components/ui/Spinner';
import { SegmentedControl } from '@/components/ui/Tabs';
import { changedFields, DiffTable } from '@/features/kb/KbPages';
import { useIsAdmin, useProfileCards } from '@/features/profile/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { Json, Tables } from '@/lib/database.types';
import { combineIsoDate, splitIsoDateTime, toIsoDate } from '@/lib/dates';
import {
  APPLICANT_GROUPS,
  COMMON_CURRENCIES,
  DEGREE_LEVELS,
  GUIDE_SECTIONS,
  INTAKE_TERMS,
  LANGUAGE_CODES,
  REQUIREMENT_KINDS,
  TUITION_PERIODS,
  type KbEntity,
  type ProposalAction,
} from '@/lib/domain';
import { describeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { toAsciiDigits } from '@/lib/utils';
import { useAuth } from '@/providers/AuthProvider';
import { useConfirm } from '@/providers/ConfirmProvider';
import { useFormat } from '@/providers/PreferencesProvider';
import { useToast } from '@/providers/ToastProvider';

type Proposal = Tables<'edit_proposals'>;
type FieldType =
  | 'text'
  | 'textarea'
  | 'markdown'
  | 'url'
  | 'number'
  | 'date'
  | 'datetime'
  | 'select'
  | 'languages'
  | 'country'
  | 'boolean';
interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: readonly string[];
  optionLabel?: (value: string) => string;
  required?: boolean;
  hidden?: boolean;
}

const TABLES: Record<KbEntity, string> = {
  country_guide: 'country_guides',
  country_link: 'country_links',
  university: 'universities',
  program: 'programs',
  program_requirement: 'program_requirements',
  program_deadline: 'program_deadlines',
};

const KB_ENTITIES = Object.keys(TABLES) as KbEntity[];

function useFields(entity: KbEntity): FieldDef[] {
  const { t } = useTranslation();
  const f = (
    key: string,
    label: string,
    type: FieldType,
    extra: Partial<FieldDef> = {},
  ): FieldDef => ({ key, label: t(label as never), type, ...extra });
  const source = [
    f('source_url', 'contribute.form.sourceUrl', 'url', { required: true }),
    f('last_verified_at', 'contribute.form.lastVerifiedAt', 'date', { required: true }),
  ];
  const currency = (key: string, label: string) =>
    f(key, label, 'select', { options: COMMON_CURRENCIES });
  switch (entity) {
    case 'country_guide':
      return [
        f('country_code', 'contribute.form.country', 'country', { required: true }),
        f('locale', 'contribute.form.locale', 'select', {
          options: ['fa', 'en'],
          optionLabel: (v) => (v === 'fa' ? 'فارسی' : 'English'),
          required: true,
        }),
        f('section', 'contribute.form.section', 'select', {
          options: GUIDE_SECTIONS,
          optionLabel: (v) => t(`enums.guideSection.${v as 'overview'}`),
          required: true,
        }),
        f('body_md', 'contribute.form.body', 'markdown', { required: true }),
        ...source,
      ];
    case 'country_link':
      return [
        f('country_code', 'contribute.form.country', 'country', { required: true }),
        f('label_en', 'contribute.form.linkLabelEn', 'text', { required: true }),
        f('label_fa', 'contribute.form.linkLabelFa', 'text'),
        f('url', 'contribute.form.linkUrl', 'url', { required: true }),
        f('category', 'contribute.form.linkCategory', 'select', {
          options: [
            'admissions',
            'visa',
            'scholarships',
            'language',
            'recognition',
            'living',
            'other',
          ],
          optionLabel: (v) => t(`kb.linkCategory.${v as 'other'}`),
        }),
        f('description', 'common.description', 'textarea'),
        f('last_verified_at', 'contribute.form.lastVerifiedAt', 'date', { required: true }),
      ];
    case 'university':
      return [
        f('country_code', 'contribute.form.country', 'country', { required: true }),
        f('name_en', 'contribute.form.nameEn', 'text', { required: true }),
        f('name_fa', 'contribute.form.nameFa', 'text'),
        f('city', 'common.city', 'text'),
        f('website_url', 'contribute.form.website', 'url'),
        f('institution_type', 'contribute.form.institutionType', 'select', {
          options: ['public', 'private'],
          optionLabel: (v) => t(`enums.institutionType.${v as 'public'}`),
        }),
        f('description_md', 'contribute.form.descriptionMd', 'markdown'),
        ...source,
      ];
    case 'program':
      return [
        f('university_id', 'contribute.form.university', 'text', { hidden: true, required: true }),
        f('name_en', 'contribute.form.nameEn', 'text', { required: true }),
        f('name_fa', 'contribute.form.nameFa', 'text'),
        f('degree_level', 'kb.program.degree', 'select', {
          options: DEGREE_LEVELS,
          optionLabel: (v) => t(`enums.degree.${v as 'master'}`),
          required: true,
        }),
        f('field', 'contribute.form.field', 'text'),
        f('languages', 'contribute.form.languages', 'languages'),
        f('duration_months', 'contribute.form.durationMonths', 'number'),
        f('tuition_amount_min', 'contribute.form.tuitionMin', 'number'),
        f('tuition_amount_max', 'contribute.form.tuitionMax', 'number'),
        currency('tuition_currency', 'contribute.form.tuitionCurrency'),
        f('tuition_period', 'contribute.form.tuitionPeriod', 'select', {
          options: TUITION_PERIODS,
          optionLabel: (v) => t(`enums.tuitionPeriod.${v as 'year'}`),
        }),
        f('application_fee_amount', 'contribute.form.applicationFee', 'number'),
        currency('application_fee_currency', 'contribute.form.applicationFeeCurrency'),
        f('website_url', 'contribute.form.website', 'url'),
        f('description_md', 'contribute.form.descriptionMd', 'markdown'),
        ...source,
      ];
    case 'program_requirement':
      return [
        f('program_id', 'contribute.form.program', 'text', { hidden: true, required: true }),
        f('kind', 'contribute.form.requirementKind', 'select', {
          options: REQUIREMENT_KINDS,
          optionLabel: (v) => t(`enums.requirement.${v as 'other'}`),
          required: true,
        }),
        f('description', 'contribute.form.requirementDescription', 'text', { required: true }),
        f('is_mandatory', 'contribute.form.mandatory', 'boolean'),
        ...source,
      ];
    case 'program_deadline':
      return [
        f('program_id', 'contribute.form.program', 'text', { hidden: true, required: true }),
        f('intake_term', 'contribute.form.intakeTerm', 'select', {
          options: INTAKE_TERMS,
          optionLabel: (v) => t(`enums.intakeTerm.${v as 'fall'}`),
        }),
        f('intake_year', 'contribute.form.intakeYear', 'number'),
        f('round_label', 'contribute.form.roundLabel', 'text'),
        f('applicant_group', 'contribute.form.applicantGroup', 'select', {
          options: APPLICANT_GROUPS,
          optionLabel: (v) => t(`enums.applicantGroup.${v as 'all'}`),
        }),
        f('opens_at', 'contribute.form.opensAt', 'datetime'),
        f('deadline_at', 'contribute.form.deadlineAt', 'datetime', { required: true }),
        f('notes', 'contribute.form.notes', 'textarea'),
        ...source,
      ];
  }
}

type Values = Record<string, string | boolean | string[]>;

function toFormValue(def: FieldDef, raw: Json | undefined): string | boolean | string[] {
  if (def.type === 'boolean') return raw === undefined || raw === null ? true : Boolean(raw);
  if (def.type === 'languages') return Array.isArray(raw) ? (raw as string[]) : [];
  if (raw === undefined || raw === null) return '';
  if (def.type === 'datetime') {
    const { date, time } = splitIsoDateTime(String(raw));
    return date ? `${date}T${time}` : '';
  }
  return String(raw);
}

function toPayloadValue(def: FieldDef, value: string | boolean | string[]): Json {
  if (def.type === 'boolean') return Boolean(value);
  if (def.type === 'languages') return value as string[];
  const text = String(value).trim();
  if (text === '') return null;
  if (def.type === 'number') return Number(toAsciiDigits(text).replace(',', '.'));
  if (def.type === 'datetime') {
    const [date, time] = text.split('T');
    return combineIsoDate(date!, time);
  }
  return text;
}

// ---------------------------------------------------------------- propose --
export function ProposePage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const entity = (KB_ENTITIES.find((e) => e === params.get('entity')) ?? 'university') as KbEntity;
  const id = params.get('id');
  const fields = useFields(entity);
  const current = useQuery({
    queryKey: ['kb', 'row', entity, id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLES[entity] as 'universities')
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Record<string, Json> | null;
    },
  });
  useDocumentTitle(t('contribute.newProposal'));
  if (id && current.isPending) return <PageLoader />;
  const initial: Values = {};
  for (const def of fields) initial[def.key] = toFormValue(def, current.data?.[def.key]);
  if (!id) {
    const defaults: Record<string, string | null> = {
      country_code: params.get('country'),
      university_id: entity === 'program' ? params.get('parent') : null,
      program_id: entity.startsWith('program_') ? params.get('parent') : null,
      section: params.get('section'),
      locale: params.get('locale'),
    };
    for (const [key, value] of Object.entries(defaults))
      if (value && key in initial) initial[key] = value;
    if ('last_verified_at' in initial) initial.last_verified_at = toIsoDate(new Date());
  } else if ('last_verified_at' in initial) {
    initial.last_verified_at = toIsoDate(new Date());
  }
  return (
    <ProposalForm
      key={`${entity}-${id}`}
      entity={entity}
      id={id}
      fields={fields}
      initial={initial}
      base={current.data ?? null}
    />
  );
}

function ProposalForm({
  entity,
  id,
  fields,
  initial,
  base,
}: {
  entity: KbEntity;
  id: string | null;
  fields: FieldDef[];
  initial: Values;
  base: Record<string, Json> | null;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const [values, setValues] = useState<Values>(initial);
  const [message, setMessage] = useState('');
  const [publish, setPublish] = useState(false);
  const [removing, setRemoving] = useState(false);
  const queryClient = useQueryClient();

  const submit = useMutation({
    mutationFn: async (action: ProposalAction) => {
      const payload: Record<string, Json> = {};
      if (action !== 'delete') {
        for (const def of fields) {
          const value = toPayloadValue(def, values[def.key] ?? '');
          if (
            action === 'update' &&
            JSON.stringify(value) === JSON.stringify(toPayloadValue(def, initial[def.key] ?? ''))
          ) {
            if (def.key !== 'source_url' && def.key !== 'last_verified_at') continue;
          }
          if (action === 'create' && value === null) continue;
          payload[def.key] = value;
        }
        payload.is_placeholder = false;
      }
      const { data, error } = await supabase
        .from('edit_proposals')
        .insert({
          entity_type: entity,
          entity_id: action === 'create' ? null : id,
          action,
          payload,
          message: message.trim(),
        })
        .select('id')
        .single();
      if (error) throw error;
      if (publish && isAdmin) {
        const { error: approveError } = await supabase.rpc('approve_edit_proposal', {
          p_proposal_id: data.id,
        });
        if (approveError) throw approveError;
      }
    },
    onSuccess: () => {
      toast.success(
        publish && isAdmin ? t('contribute.publishedDirectly') : t('contribute.submitted'),
      );
      void queryClient.invalidateQueries({ queryKey: ['kb'] });
      void queryClient.invalidateQueries({ queryKey: ['proposals'] });
      if (publish && isAdmin) void navigate(-1);
      else void navigate('/contribute');
    },
    onError: (e) => toast.error(describeError(e, t)),
  });

  const missing = fields.filter(
    (def) =>
      def.required && !def.hidden && (values[def.key] === '' || values[def.key] === undefined),
  );
  const title = id
    ? t('contribute.form.titleUpdate', {
        name: String(
          base?.name_en ?? base?.title ?? base?.label_en ?? t(`enums.kbEntity.${entity}`),
        ),
      })
    : t('contribute.form.titleCreate', { entity: t(`enums.kbEntity.${entity}`) });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit.mutate(removing ? 'delete' : id ? 'update' : 'create');
  };

  const set = (key: string, value: string | boolean | string[]) =>
    setValues((v) => ({ ...v, [key]: value }));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={title} description={t('kb.disclaimer')} />
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        {!removing && (
          <Card>
            <CardBody className="grid gap-4 sm:grid-cols-2">
              {fields
                .filter((def) => !def.hidden)
                .map((def) => {
                  const value = values[def.key];
                  const wide =
                    ['markdown', 'textarea', 'languages'].includes(def.type) ||
                    def.key.startsWith('name') ||
                    def.key === 'description';
                  const inputId = `pf-${def.key}`;
                  let control;
                  switch (def.type) {
                    case 'markdown':
                      control = (
                        <MarkdownEditor
                          id={inputId}
                          value={String(value ?? '')}
                          onChange={(v) => set(def.key, v)}
                          rows={10}
                        />
                      );
                      break;
                    case 'textarea':
                      control = (
                        <Textarea
                          id={inputId}
                          dir="auto"
                          rows={3}
                          value={String(value ?? '')}
                          onChange={(e) => set(def.key, e.target.value)}
                        />
                      );
                      break;
                    case 'select':
                      control = (
                        <Select
                          id={inputId}
                          value={String(value ?? '')}
                          onChange={(e) => set(def.key, e.target.value)}
                        >
                          <option value="">—</option>
                          {def.options?.map((o) => (
                            <option key={o} value={o}>
                              {def.optionLabel ? def.optionLabel(o) : o}
                            </option>
                          ))}
                        </Select>
                      );
                      break;
                    case 'country':
                      control = (
                        <CountrySelect
                          id={inputId}
                          value={String(value || '') || null}
                          onChange={(c) => set(def.key, c ?? '')}
                        />
                      );
                      break;
                    case 'date':
                      control = (
                        <DateInput
                          id={inputId}
                          value={String(value || '') || null}
                          onChange={(d) => set(def.key, d ?? '')}
                        />
                      );
                      break;
                    case 'datetime': {
                      const [date = '', time = '23:59'] = String(value ?? '').split('T');
                      control = (
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <DateInput
                              id={inputId}
                              value={date || null}
                              onChange={(d) => set(def.key, d ? `${d}T${time}` : '')}
                            />
                          </div>
                          <Input
                            type="time"
                            dir="ltr"
                            className="w-28"
                            value={time}
                            onChange={(e) => set(def.key, `${date}T${e.target.value}`)}
                            aria-label={t('applications.deadlines.time')}
                          />
                        </div>
                      );
                      break;
                    }
                    case 'boolean':
                      control = (
                        <Checkbox
                          checked={Boolean(value)}
                          onChange={(e) => set(def.key, e.target.checked)}
                          label={def.label}
                        />
                      );
                      break;
                    case 'languages':
                      control = (
                        <div className="flex flex-wrap gap-2">
                          {LANGUAGE_CODES.map((code) => (
                            <Checkbox
                              key={code}
                              checked={(value as string[]).includes(code)}
                              onChange={(e) =>
                                set(
                                  def.key,
                                  e.target.checked
                                    ? [...(value as string[]), code]
                                    : (value as string[]).filter((c) => c !== code),
                                )
                              }
                              label={t(`kb.languages.${code}`)}
                            />
                          ))}
                        </div>
                      );
                      break;
                    default:
                      control = (
                        <Input
                          id={inputId}
                          dir={def.type === 'url' || def.type === 'number' ? 'ltr' : 'auto'}
                          type={def.type === 'url' ? 'url' : 'text'}
                          inputMode={def.type === 'number' ? 'decimal' : undefined}
                          value={String(value ?? '')}
                          onChange={(e) => set(def.key, e.target.value)}
                        />
                      );
                  }
                  return (
                    <Field
                      key={def.key}
                      label={def.type === 'boolean' ? undefined : def.label}
                      htmlFor={inputId}
                      className={wide ? 'sm:col-span-2' : undefined}
                      hint={
                        def.key === 'source_url'
                          ? t('contribute.form.sourceUrlHint')
                          : def.key === 'last_verified_at'
                            ? t('contribute.form.lastVerifiedAtHint')
                            : undefined
                      }
                    >
                      {control}
                    </Field>
                  );
                })}
            </CardBody>
          </Card>
        )}
        {removing && <Alert tone="warning">{t('contribute.form.deleteExplain')}</Alert>}
        <Field label={t('contribute.form.message')} htmlFor="pf-message">
          <Textarea
            id="pf-message"
            dir="auto"
            rows={3}
            maxLength={2000}
            placeholder={t('contribute.form.messagePlaceholder')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </Field>
        {!removing && missing.length > 0 && (
          <p className="text-sm text-warning">{t('contribute.form.sourceRequired')}</p>
        )}
        {isAdmin && (
          <Checkbox
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
            label={t('contribute.form.publishDirectly')}
          />
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {id && (
            <Button
              variant="ghost"
              className="me-auto text-danger"
              onClick={() => setRemoving((v) => !v)}
            >
              <Trash2 className="size-4" aria-hidden />
              {removing ? t('common.cancel') : t('enums.proposalAction.delete')}
            </Button>
          )}
          <Button
            type="submit"
            loading={submit.isPending}
            disabled={!removing && missing.length > 0}
          >
            {t('contribute.form.submit')}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------- contributions --
const STATUS_TONE = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
} as const;

function ProposalCard({ proposal, admin }: { proposal: Proposal; admin?: { name: string } }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['proposals'] });
    void queryClient.invalidateQueries({ queryKey: ['kb'] });
  };
  const act = useMutation({
    mutationFn: async (kind: 'approve' | 'reject' | 'withdraw') => {
      const result =
        kind === 'approve'
          ? await supabase.rpc('approve_edit_proposal', {
              p_proposal_id: proposal.id,
              p_review_note: note,
            })
          : kind === 'reject'
            ? await supabase.rpc('reject_edit_proposal', {
                p_proposal_id: proposal.id,
                p_review_note: note,
              })
            : await supabase
                .from('edit_proposals')
                .update({ status: 'withdrawn' })
                .eq('id', proposal.id);
      if (result.error) throw result.error;
      return kind;
    },
    onSuccess: (kind) => {
      toast.success(
        kind === 'approve'
          ? t('moderation.approved')
          : kind === 'reject'
            ? t('moderation.rejected')
            : t('contribute.withdrawn'),
      );
      refresh();
    },
    onError: (e) => toast.error(describeError(e, t)),
  });
  const diff = changedFields(
    proposal.action === 'create' ? null : proposal.base_snapshot,
    proposal.action === 'delete'
      ? null
      : { ...(proposal.base_snapshot as object), ...(proposal.payload as object) },
  );

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={STATUS_TONE[proposal.status]}>
            {t(`enums.proposalStatus.${proposal.status}`)}
          </Badge>
          <Badge>{t(`enums.proposalAction.${proposal.action}`)}</Badge>
          <span className="font-medium">{t(`enums.kbEntity.${proposal.entity_type}`)}</span>
          <span className="text-muted">· {fmt.relative(proposal.created_at)}</span>
          {admin && (
            <span className="text-muted">· {t('moderation.proposedBy', { name: admin.name })}</span>
          )}
        </div>
        {proposal.message && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm" dir="auto">
            {proposal.message}
          </p>
        )}
        {diff.length > 0 && <DiffTable rows={diff} />}
        {proposal.review_note && (
          <p className="text-sm">
            <span className="text-muted">{t('contribute.reviewNote')}: </span>
            <span dir="auto">{proposal.review_note}</span>
          </p>
        )}
        {proposal.status === 'pending' && admin && (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <Input
              dir="auto"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('moderation.reviewNote')}
              aria-label={t('moderation.reviewNote')}
            />
            <div className="flex gap-2">
              <Button size="sm" loading={act.isPending} onClick={() => act.mutate('approve')}>
                <Check className="size-4" aria-hidden />
                {t('moderation.approve')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={act.isPending}
                onClick={() => act.mutate('reject')}
              >
                <X className="size-4" aria-hidden />
                {t('moderation.reject')}
              </Button>
            </div>
          </div>
        )}
        {proposal.status === 'pending' && !admin && (
          <Button
            size="sm"
            variant="ghost"
            className="self-start"
            onClick={async () => {
              if (
                await confirm({
                  title: t('contribute.withdrawConfirm'),
                  confirmLabel: t('contribute.withdraw'),
                })
              )
                act.mutate('withdraw');
            }}
          >
            {t('contribute.withdraw')}
          </Button>
        )}
        {proposal.status === 'approved' && proposal.result_entity_id && (
          <Link
            className="self-start text-xs text-primary hover:underline"
            to={`/history/${proposal.entity_type}/${proposal.result_entity_id}`}
          >
            {t('kb.history')}
          </Link>
        )}
      </CardBody>
    </Card>
  );
}

function useProposals(scope: 'mine' | 'pending' | 'all', userId?: string) {
  return useQuery({
    queryKey: ['proposals', scope, userId],
    queryFn: async () => {
      let query = supabase
        .from('edit_proposals')
        .select('*')
        .order('created_at', { ascending: scope !== 'mine' })
        .limit(200);
      if (scope === 'mine' && userId) query = query.eq('proposed_by', userId);
      if (scope === 'pending') query = query.eq('status', 'pending');
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function ContributionsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('contribute.title'));
  const { user } = useAuth();
  const { data, isPending } = useProposals('mine', user?.id);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t('contribute.title')}
        description={t('contribute.subtitle')}
        actions={
          <LinkButton to="/countries" variant="outline">
            {t('nav.countries')}
          </LinkButton>
        }
      />
      {isPending ? (
        <Skeleton className="h-40" />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={GitPullRequestArrow} title={t('contribute.empty')} />
      ) : (
        <div className="flex flex-col gap-3">
          {(data ?? []).map((p) => (
            <ProposalCard key={p.id} proposal={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ModerationPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('moderation.title'));
  const [scope, setScope] = useState<'pending' | 'all'>('pending');
  const { data, isPending } = useProposals(scope);
  const cards = useProfileCards((data ?? []).map((p) => p.proposed_by));
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t('moderation.title')}
        description={t('moderation.subtitle')}
        actions={
          <SegmentedControl
            label={t('moderation.title')}
            value={scope}
            onChange={setScope}
            items={[
              { value: 'pending', label: t('moderation.filterPending') },
              { value: 'all', label: t('moderation.filterAll') },
            ]}
          />
        }
      />
      {isPending ? (
        <Skeleton className="h-40" />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={BookOpenCheck} title={t('moderation.empty')} />
      ) : (
        <div className="flex flex-col gap-3">
          {(data ?? []).map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              admin={{ name: cards.data?.get(p.proposed_by)?.display_name ?? t('common.someone') }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
