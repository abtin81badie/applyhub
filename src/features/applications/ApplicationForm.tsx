import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { CountrySelect } from '@/components/common/CountrySelect';
import { DateInput } from '@/components/common/DateInput';
import { MarkdownEditor } from '@/components/common/MarkdownEditor';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Input';
import { useCountryLookup } from '@/features/kb/countries';
import {
  APPLICATION_STATUSES,
  COMMON_CURRENCIES,
  DEGREE_LEVELS,
  INTAKE_TERMS,
  TUITION_PERIODS,
  yearOptions,
  type ApplicationStatus,
  type DegreeLevel,
  type IntakeTerm,
  type TuitionPeriod,
} from '@/lib/domain';
import { zodFieldErrors } from '@/lib/validation';
import { useFormat } from '@/providers/PreferencesProvider';
import { applicationFormSchema as schema, type ApplicationFormState } from './formModel';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody className="grid gap-4 sm:grid-cols-2">{children}</CardBody>
    </Card>
  );
}

export function ApplicationForm({
  initial,
  mode,
  onSubmit,
  footer,
}: {
  initial: ApplicationFormState;
  mode: 'create' | 'edit';
  onSubmit: (values: z.output<typeof schema>) => void;
  footer: ReactNode;
}) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const countries = useCountryLookup();
  const [form, setForm] = useState<ApplicationFormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof ApplicationFormState>(key: K, value: ApplicationFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onCountry = (code: string | null) => {
    const currency = countries.get(code)?.currency_code ?? '';
    setForm((f) => ({
      ...f,
      country_code: code,
      // Suggest the country's currency when none was chosen yet.
      application_fee_currency: f.application_fee_currency || currency,
      tuition_currency: f.tuition_currency || currency,
    }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error, t));
      document
        .querySelector('[aria-invalid="true"]')
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };

  const currencyOptions = [
    ...new Set([form.application_fee_currency, form.tuition_currency, ...COMMON_CURRENCIES]),
  ].filter(Boolean);

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <Section title={t('applications.form.sectionProgram')}>
        <Field
          label={t('applications.form.university')}
          htmlFor="f-university"
          error={errors.university_name}
          className="sm:col-span-2"
        >
          <Input
            id="f-university"
            dir="auto"
            maxLength={200}
            placeholder={t('applications.form.universityPlaceholder')}
            value={form.university_name}
            onChange={(e) => set('university_name', e.target.value)}
            aria-invalid={Boolean(errors.university_name) || undefined}
          />
        </Field>
        <Field label={t('applications.form.program')} htmlFor="f-program" className="sm:col-span-2">
          <Input
            id="f-program"
            dir="auto"
            maxLength={200}
            placeholder={t('applications.form.programPlaceholder')}
            value={form.program_name}
            onChange={(e) => set('program_name', e.target.value)}
          />
        </Field>
        <Field label={t('applications.form.country')} htmlFor="f-country">
          <CountrySelect id="f-country" value={form.country_code} onChange={onCountry} />
        </Field>
        <Field label={t('applications.form.degree')} htmlFor="f-degree">
          <Select
            id="f-degree"
            value={form.degree_level ?? ''}
            onChange={(e) => set('degree_level', (e.target.value || null) as DegreeLevel | null)}
          >
            <option value="">{t('common.notSet')}</option>
            {DEGREE_LEVELS.map((d) => (
              <option key={d} value={d}>
                {t(`enums.degree.${d}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('applications.form.intakeTerm')} htmlFor="f-term">
          <Select
            id="f-term"
            value={form.intake_term ?? ''}
            onChange={(e) => set('intake_term', (e.target.value || null) as IntakeTerm | null)}
          >
            <option value="">{t('common.notSet')}</option>
            {INTAKE_TERMS.map((term) => (
              <option key={term} value={term}>
                {t(`enums.intakeTerm.${term}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('applications.form.intakeYear')} htmlFor="f-year">
          <Select
            id="f-year"
            value={form.intake_year ?? ''}
            onChange={(e) => set('intake_year', e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{t('common.notSet')}</option>
            {[...new Set([...(form.intake_year ? [form.intake_year] : []), ...yearOptions()])]
              .sort()
              .map((y) => (
                <option key={y} value={y}>
                  {fmt.number(y, { useGrouping: false })}
                </option>
              ))}
          </Select>
        </Field>
      </Section>

      <Section title={t('applications.form.sectionApplication')}>
        <Field label={t('applications.form.status')} htmlFor="f-status">
          <Select
            id="f-status"
            value={form.status}
            onChange={(e) => set('status', e.target.value as ApplicationStatus)}
          >
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`enums.status.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('applications.form.submittedAt')} htmlFor="f-submitted">
          <DateInput
            id="f-submitted"
            value={form.submitted_at}
            onChange={(v) => set('submitted_at', v)}
          />
        </Field>
        <Field
          label={t('applications.form.portalUrl')}
          htmlFor="f-portal"
          error={errors.portal_url}
          className="sm:col-span-2"
        >
          <Input
            id="f-portal"
            type="url"
            dir="ltr"
            placeholder="https://"
            value={form.portal_url}
            onChange={(e) => set('portal_url', e.target.value)}
            aria-invalid={Boolean(errors.portal_url) || undefined}
          />
        </Field>
        {mode === 'create' && (
          <>
            <Field
              label={`${t('applications.detail.deadlines')} · ${t('applications.deadlines.label')}`}
              htmlFor="f-dl-label"
            >
              <Input
                id="f-dl-label"
                dir="auto"
                maxLength={120}
                placeholder={t('applications.deadlines.labelPlaceholder')}
                value={form.firstDeadlineLabel}
                onChange={(e) => set('firstDeadlineLabel', e.target.value)}
              />
            </Field>
            <Field label={t('applications.deadlines.dueAt')} htmlFor="f-dl-date">
              <div className="flex gap-2">
                <div className="flex-1">
                  <DateInput
                    id="f-dl-date"
                    value={form.firstDeadlineDate}
                    onChange={(v) => set('firstDeadlineDate', v)}
                  />
                </div>
                <Input
                  type="time"
                  dir="ltr"
                  aria-label={t('applications.deadlines.time')}
                  className="w-28"
                  value={form.firstDeadlineTime}
                  onChange={(e) => set('firstDeadlineTime', e.target.value)}
                />
              </div>
            </Field>
            <div className="sm:col-span-2">
              <Checkbox
                checked={form.addDefaultChecklist}
                onChange={(e) => set('addDefaultChecklist', e.target.checked)}
                label={t('applications.form.defaultChecklist')}
              />
            </div>
          </>
        )}
      </Section>

      <Section title={t('applications.form.sectionMoney')}>
        <Field
          label={t('applications.form.applicationFee')}
          htmlFor="f-fee"
          error={errors.application_fee_amount}
        >
          <div className="flex gap-2">
            <Input
              id="f-fee"
              inputMode="decimal"
              dir="ltr"
              value={form.application_fee_amount}
              onChange={(e) => set('application_fee_amount', e.target.value)}
              aria-invalid={Boolean(errors.application_fee_amount) || undefined}
            />
            <Select
              aria-label={t('applications.form.currency')}
              className="w-28"
              value={form.application_fee_currency}
              onChange={(e) => set('application_fee_currency', e.target.value)}
            >
              <option value="">—</option>
              {currencyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </Field>
        <Field
          label={t('applications.form.tuition')}
          htmlFor="f-tuition"
          error={errors.tuition_amount}
        >
          <div className="flex gap-2">
            <Input
              id="f-tuition"
              inputMode="decimal"
              dir="ltr"
              value={form.tuition_amount}
              onChange={(e) => set('tuition_amount', e.target.value)}
              aria-invalid={Boolean(errors.tuition_amount) || undefined}
            />
            <Select
              aria-label={t('applications.form.currency')}
              className="w-28"
              value={form.tuition_currency}
              onChange={(e) => set('tuition_currency', e.target.value)}
            >
              <option value="">—</option>
              {currencyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select
              aria-label={t('applications.form.tuitionPeriod')}
              className="w-32"
              value={form.tuition_period ?? ''}
              onChange={(e) =>
                set('tuition_period', (e.target.value || null) as TuitionPeriod | null)
              }
            >
              <option value="">—</option>
              {TUITION_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {t(`enums.tuitionPeriod.${p}`)}
                </option>
              ))}
            </Select>
          </div>
        </Field>
        <Field
          label={t('applications.form.fundingInfo')}
          htmlFor="f-funding"
          className="sm:col-span-2"
        >
          <Textarea
            id="f-funding"
            dir="auto"
            rows={3}
            maxLength={4000}
            placeholder={t('applications.form.fundingPlaceholder')}
            value={form.funding_info}
            onChange={(e) => set('funding_info', e.target.value)}
          />
        </Field>
      </Section>

      <Section title={t('applications.form.sectionOutcome')}>
        <Field label={t('applications.form.resultDate')} htmlFor="f-result-date">
          <DateInput
            id="f-result-date"
            value={form.result_date}
            onChange={(v) => set('result_date', v)}
          />
        </Field>
        <div className="hidden sm:block" />
        <Field
          label={t('applications.form.decisionNotes')}
          htmlFor="f-decision"
          hint={t('applications.form.decisionNotesHint')}
          className="sm:col-span-2"
        >
          <Textarea
            id="f-decision"
            dir="auto"
            rows={3}
            maxLength={4000}
            value={form.decision_notes}
            onChange={(e) => set('decision_notes', e.target.value)}
          />
        </Field>
      </Section>

      <Card>
        <CardHeader
          title={t('applications.form.sectionNotes')}
          description={t('applications.form.notesHint')}
        />
        <CardBody>
          <MarkdownEditor
            id="f-notes"
            value={form.notes}
            onChange={(v) => set('notes', v)}
            maxLength={20000}
            rows={8}
          />
        </CardBody>
      </Card>

      <div className="sticky bottom-20 z-10 flex flex-wrap justify-end gap-2 rounded-xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur lg:bottom-4">
        {footer}
      </div>
    </form>
  );
}
