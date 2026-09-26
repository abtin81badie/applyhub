import { Constants, type Enums } from './database.types';

export type ApplicationStatus = Enums<'application_status'>;
export type DegreeLevel = Enums<'degree_level'>;
export type IntakeTerm = Enums<'intake_term'>;
export type RequirementKind = Enums<'requirement_kind'>;
export type RoomRole = Enums<'room_role'>;
export type TargetInterest = Enums<'target_interest'>;
export type TuitionPeriod = Enums<'tuition_period'>;
export type GuideSection = Enums<'guide_section'>;
export type KbEntity = Enums<'kb_entity'>;
export type ProposalStatus = Enums<'proposal_status'>;
export type ProposalAction = Enums<'proposal_action'>;
export type ApplicantGroup = Enums<'applicant_group'>;

export const APPLICATION_STATUSES = Constants.public.Enums.application_status;
export const DEGREE_LEVELS = Constants.public.Enums.degree_level;
export const INTAKE_TERMS = Constants.public.Enums.intake_term;
export const REQUIREMENT_KINDS = Constants.public.Enums.requirement_kind;
export const ROOM_ROLES = Constants.public.Enums.room_role;
export const TARGET_INTERESTS = Constants.public.Enums.target_interest;
export const TUITION_PERIODS = Constants.public.Enums.tuition_period;
export const GUIDE_SECTIONS = Constants.public.Enums.guide_section;
export const APPLICANT_GROUPS = Constants.public.Enums.applicant_group;

/** Pipeline order; the last four are outcomes. */
export const OUTCOME_STATUSES: readonly ApplicationStatus[] = [
  'admitted',
  'rejected',
  'waitlisted',
  'withdrawn',
];

export const STATUS_STYLE: Record<
  ApplicationStatus,
  { dot: string; badge: string; column: string }
> = {
  researching: {
    dot: 'bg-slate-400',
    badge:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700',
    column: 'border-t-slate-400',
  },
  planning: {
    dot: 'bg-sky-500',
    badge:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-900',
    column: 'border-t-sky-500',
  },
  preparing: {
    dot: 'bg-violet-500',
    badge:
      'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-200 dark:border-violet-900',
    column: 'border-t-violet-500',
  },
  submitted: {
    dot: 'bg-indigo-500',
    badge:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-900',
    column: 'border-t-indigo-500',
  },
  interview: {
    dot: 'bg-amber-500',
    badge:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-900',
    column: 'border-t-amber-500',
  },
  admitted: {
    dot: 'bg-emerald-500',
    badge:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-900',
    column: 'border-t-emerald-500',
  },
  rejected: {
    dot: 'bg-rose-500',
    badge:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-900',
    column: 'border-t-rose-500',
  },
  waitlisted: {
    dot: 'bg-orange-500',
    badge:
      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-900',
    column: 'border-t-orange-500',
  },
  withdrawn: {
    dot: 'bg-zinc-400',
    badge:
      'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-300 dark:border-zinc-700',
    column: 'border-t-zinc-400',
  },
};

/** The checklist offered when creating an application. */
export const DEFAULT_REQUIREMENTS: readonly RequirementKind[] = [
  'language_test',
  'transcript',
  'degree_certificate',
  'cv',
  'sop',
  'lor',
  'passport',
  'application_form',
  'fee_payment',
];

export const COMMON_CURRENCIES = [
  'EUR',
  'USD',
  'CAD',
  'GBP',
  'CHF',
  'SEK',
  'NOK',
  'DKK',
  'AUD',
  'NZD',
  'JPY',
  'KRW',
  'CNY',
  'SGD',
  'TRY',
  'IRR',
] as const;

export const LANGUAGE_CODES = [
  'en',
  'de',
  'fr',
  'it',
  'nl',
  'sv',
  'es',
  'fa',
  'tr',
  'fi',
  'da',
  'no',
  'pt',
  'zh',
  'ja',
  'ko',
] as const;

export function yearOptions(): number[] {
  const now = new Date().getFullYear();
  return Array.from({ length: 8 }, (_, i) => now - 1 + i);
}
