import { z } from 'zod';
import { combineIsoDate } from '@/lib/dates';
import {
  APPLICATION_STATUSES,
  DEFAULT_REQUIREMENTS,
  DEGREE_LEVELS,
  INTAKE_TERMS,
  TUITION_PERIODS,
} from '@/lib/domain';
import { toAsciiDigits } from '@/lib/utils';
import type { Application, CreateApplicationInput } from './api';

const optionalUrl = z.union([
  z.literal(''),
  z.url({ protocol: /^https?$/, error: 'validation.invalidUrl' }).max(2048),
]);
const optionalAmount = z
  .string()
  .trim()
  .transform(toAsciiDigits)
  .refine(
    (v) => v === '' || (/^\d+([.,]\d{1,2})?$/.test(v) && Number(v.replace(',', '.')) >= 0),
    'validation.invalidNumber',
  );

export const applicationFormSchema = z.object({
  country_code: z.string().nullable(),
  university_name: z.string().trim().min(1, 'validation.required').max(200),
  program_name: z.string().trim().max(200),
  degree_level: z.enum(DEGREE_LEVELS).nullable(),
  intake_term: z.enum(INTAKE_TERMS).nullable(),
  intake_year: z.number().int().min(2000).max(2100).nullable(),
  portal_url: optionalUrl,
  status: z.enum(APPLICATION_STATUSES),
  submitted_at: z.string().nullable(),
  application_fee_amount: optionalAmount,
  application_fee_currency: z.string(),
  tuition_amount: optionalAmount,
  tuition_currency: z.string(),
  tuition_period: z.enum(TUITION_PERIODS).nullable(),
  funding_info: z.string().max(4000),
  result_date: z.string().nullable(),
  decision_notes: z.string().max(4000),
  notes: z.string().max(20000),
  addDefaultChecklist: z.boolean(),
  firstDeadlineLabel: z.string().max(120),
  firstDeadlineDate: z.string().nullable(),
  firstDeadlineTime: z.string(),
});

export type ApplicationFormState = z.input<typeof applicationFormSchema>;
export type ApplicationFormValues = z.output<typeof applicationFormSchema>;

export function initialFormState(app?: Partial<Application> | null): ApplicationFormState {
  return {
    country_code: app?.country_code ?? null,
    university_name: app?.university_name ?? '',
    program_name: app?.program_name ?? '',
    degree_level: app?.degree_level ?? null,
    intake_term: app?.intake_term ?? null,
    intake_year: app?.intake_year ?? null,
    portal_url: app?.portal_url ?? '',
    status: app?.status ?? 'researching',
    submitted_at: app?.submitted_at ?? null,
    application_fee_amount: app?.application_fee_amount?.toString() ?? '',
    application_fee_currency: app?.application_fee_currency ?? '',
    tuition_amount: app?.tuition_amount?.toString() ?? '',
    tuition_currency: app?.tuition_currency ?? '',
    tuition_period: app?.tuition_period ?? null,
    funding_info: app?.funding_info ?? '',
    result_date: app?.result_date ?? null,
    decision_notes: app?.decision_notes ?? '',
    notes: app?.notes ?? '',
    addDefaultChecklist: !app,
    firstDeadlineLabel: '',
    firstDeadlineDate: null,
    firstDeadlineTime: '23:59',
  };
}

const amount = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
const orNull = (v: string) => (v.trim() === '' ? null : v.trim());

/** Converts validated form values into an insert payload (plus optional checklist / first deadline). */
export function toCreateInput(
  v: ApplicationFormValues,
  defaultLabels: (kind: (typeof DEFAULT_REQUIREMENTS)[number]) => string,
): CreateApplicationInput {
  return {
    application: {
      country_code: v.country_code,
      university_name: v.university_name,
      program_name: v.program_name,
      degree_level: v.degree_level,
      intake_term: v.intake_term,
      intake_year: v.intake_year,
      portal_url: orNull(v.portal_url),
      status: v.status,
      submitted_at: v.submitted_at,
      application_fee_amount: amount(v.application_fee_amount),
      application_fee_currency: orNull(v.application_fee_currency),
      tuition_amount: amount(v.tuition_amount),
      tuition_currency: orNull(v.tuition_currency),
      tuition_period: v.tuition_period,
      funding_info: orNull(v.funding_info),
      result_date: v.result_date,
      decision_notes: orNull(v.decision_notes),
      notes: orNull(v.notes),
    },
    requirements: v.addDefaultChecklist
      ? DEFAULT_REQUIREMENTS.map((kind) => ({ kind, label: defaultLabels(kind) }))
      : [],
    deadlines: v.firstDeadlineDate
      ? [
          {
            label: v.firstDeadlineLabel.trim(),
            due_at: combineIsoDate(v.firstDeadlineDate, v.firstDeadlineTime),
          },
        ]
      : [],
  };
}
