import Papa from 'papaparse';
import { z } from 'zod';
import type { ApplicationWithDetails, CreateApplicationInput } from '@/features/applications/api';
import {
  APPLICATION_STATUSES,
  DEGREE_LEVELS,
  INTAKE_TERMS,
  REQUIREMENT_KINDS,
  TUITION_PERIODS,
} from '@/lib/domain';
import { toAsciiDigits } from '@/lib/utils';

/** Column order of the application CSV (export, template and import). */
export const CSV_COLUMNS = [
  'country_code',
  'university_name',
  'program_name',
  'degree_level',
  'intake_term',
  'intake_year',
  'status',
  'portal_url',
  'submitted_at',
  'application_fee_amount',
  'application_fee_currency',
  'tuition_amount',
  'tuition_currency',
  'tuition_period',
  'funding_info',
  'result_date',
  'decision_notes',
  'notes',
  'deadlines',
  'requirements',
] as const;

const clean = (v: string) => v.replace(/[|;]/g, ' ').trim();

/** "Round 1|2027-01-15T23:59:00.000Z|0; …" */
function encodeDeadlines(app: ApplicationWithDetails): string {
  return app.deadlines
    .map((d) => [clean(d.label), d.due_at, d.is_done ? 1 : 0].join('|'))
    .join('; ');
}

/** "sop|1|Statement of purpose; …" */
function encodeRequirements(app: ApplicationWithDetails): string {
  return app.application_requirements
    .map((r) => [r.kind, r.is_done ? 1 : 0, clean(r.label)].join('|'))
    .join('; ');
}

export function applicationsToCsv(apps: readonly ApplicationWithDetails[]): string {
  const rows = apps.map((app) => ({
    ...Object.fromEntries(CSV_COLUMNS.map((c) => [c, ''])),
    country_code: app.country_code ?? '',
    university_name: app.university_name,
    program_name: app.program_name,
    degree_level: app.degree_level ?? '',
    intake_term: app.intake_term ?? '',
    intake_year: app.intake_year ?? '',
    status: app.status,
    portal_url: app.portal_url ?? '',
    submitted_at: app.submitted_at ?? '',
    application_fee_amount: app.application_fee_amount ?? '',
    application_fee_currency: app.application_fee_currency ?? '',
    tuition_amount: app.tuition_amount ?? '',
    tuition_currency: app.tuition_currency ?? '',
    tuition_period: app.tuition_period ?? '',
    funding_info: app.funding_info ?? '',
    result_date: app.result_date ?? '',
    decision_notes: app.decision_notes ?? '',
    notes: app.notes ?? '',
    deadlines: encodeDeadlines(app),
    requirements: encodeRequirements(app),
  }));
  // A BOM makes Excel open UTF-8 (Persian text) correctly.
  return (
    '﻿' +
    Papa.unparse({ fields: [...CSV_COLUMNS], data: rows.map((r) => CSV_COLUMNS.map((c) => r[c])) })
  );
}

export function csvTemplate(): string {
  return (
    '﻿' +
    Papa.unparse({
      fields: [...CSV_COLUMNS],
      data: [
        [
          'DE',
          'Example University',
          'MSc Example',
          'master',
          'winter',
          '2027',
          'planning',
          'https://example.org',
          '',
          '75',
          'EUR',
          '',
          'EUR',
          'semester',
          '',
          '',
          '',
          'My notes',
          'Round 1|2027-01-15T23:59:00Z|0',
          'language_test|0|IELTS 6.5; sop|0|Statement of purpose',
        ],
      ],
    })
  );
}

const optional = (schema: z.ZodType) =>
  z.preprocess(
    (v) => (v === undefined || (typeof v === 'string' && v.trim() === '') ? null : v),
    schema.nullable(),
  );
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.invalidDate');
const amount = z.preprocess(
  (v) => (typeof v === 'string' ? Number(toAsciiDigits(v).replace(',', '.')) : v),
  z.number().min(0),
);

const rowSchema = z.object({
  country_code: optional(
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/),
  ),
  university_name: z.string().trim().min(1, 'validation.required').max(200),
  program_name: z.string().trim().max(200).default(''),
  degree_level: optional(z.enum(DEGREE_LEVELS)),
  intake_term: optional(z.enum(INTAKE_TERMS)),
  intake_year: optional(
    z.preprocess((v) => Number(toAsciiDigits(String(v))), z.number().int().min(2000).max(2100)),
  ),
  status: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() ? v.trim() : 'researching'),
    z.enum(APPLICATION_STATUSES),
  ),
  portal_url: optional(z.url({ protocol: /^https?$/ })),
  submitted_at: optional(isoDate),
  application_fee_amount: optional(amount),
  application_fee_currency: optional(
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/),
  ),
  tuition_amount: optional(amount),
  tuition_currency: optional(
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/),
  ),
  tuition_period: optional(z.enum(TUITION_PERIODS)),
  funding_info: optional(z.string().max(4000)),
  result_date: optional(isoDate),
  decision_notes: optional(z.string().max(4000)),
  notes: optional(z.string().max(20000)),
  deadlines: z.string().default(''),
  requirements: z.string().default(''),
});

export interface ImportRow {
  line: number;
  input?: CreateApplicationInput;
  error?: string;
}

export function parseApplicationsCsv(text: string): ImportRow[] {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  return parsed.data.map((raw, index) => {
    const line = index + 2;
    const result = rowSchema.safeParse(raw);
    if (!result.success) {
      const issue = result.error.issues[0];
      return { line, error: `${issue?.path.join('.') ?? ''}: ${issue?.message ?? 'invalid'}` };
    }
    const v = result.data;
    try {
      const deadlines = v.deadlines
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((entry) => {
          const [label = '', due = '', done = '0'] = entry.split('|').map((x) => x.trim());
          const date = new Date(due);
          if (Number.isNaN(date.getTime())) throw new Error(`deadlines: invalid date "${due}"`);
          return { label, due_at: date.toISOString(), is_done: done === '1' };
        });
      const requirements = v.requirements
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((entry) => {
          const [kind = 'other', done = '0', ...rest] = entry.split('|').map((x) => x.trim());
          const safeKind = (REQUIREMENT_KINDS as readonly string[]).includes(kind)
            ? (kind as (typeof REQUIREMENT_KINDS)[number])
            : 'other';
          return { kind: safeKind, label: rest.join(' ') || kind, is_done: done === '1' };
        });
      const { deadlines: _d, requirements: _r, ...application } = v;
      return {
        line,
        input: {
          application: {
            ...application,
            program_name: application.program_name ?? '',
          } as CreateApplicationInput['application'],
          deadlines,
          requirements,
        },
      };
    } catch (e) {
      return { line, error: (e as Error).message };
    }
  });
}
