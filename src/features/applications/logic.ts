import { addDays, daysUntil } from '@/lib/dates';
import {
  APPLICATION_STATUSES,
  DEGREE_LEVELS,
  type ApplicationStatus,
  type DegreeLevel,
  type IntakeTerm,
} from '@/lib/domain';
import type { ApplicationWithDetails, Deadline } from './api';

// ------------------------------------------------------------------ filters --
export interface ApplicationFilters {
  q: string;
  statuses: ApplicationStatus[];
  country: string | null;
  degree: DegreeLevel | null;
  year: number | null;
}

export const EMPTY_FILTERS: ApplicationFilters = {
  q: '',
  statuses: [],
  country: null,
  degree: null,
  year: null,
};

export function parseFilters(params: URLSearchParams): ApplicationFilters {
  const statuses = (params.get('status') ?? '')
    .split(',')
    .filter((s): s is ApplicationStatus => (APPLICATION_STATUSES as readonly string[]).includes(s));
  const degree = params.get('degree');
  const year = Number(params.get('year'));
  const country = params.get('country');
  return {
    q: params.get('q') ?? '',
    statuses,
    country: country && /^[A-Z]{2}$/.test(country) ? country : null,
    degree:
      degree && (DEGREE_LEVELS as readonly string[]).includes(degree)
        ? (degree as DegreeLevel)
        : null,
    year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null,
  };
}

export function writeFilters(
  params: URLSearchParams,
  filters: ApplicationFilters,
): URLSearchParams {
  const next = new URLSearchParams(params);
  const set = (key: string, value: string | null) => {
    if (value) next.set(key, value);
    else next.delete(key);
  };
  set('q', filters.q.trim() || null);
  set('status', filters.statuses.join(',') || null);
  set('country', filters.country);
  set('degree', filters.degree);
  set('year', filters.year ? String(filters.year) : null);
  return next;
}

export function hasActiveFilters(filters: ApplicationFilters): boolean {
  return Boolean(
    filters.q.trim() ||
    filters.statuses.length ||
    filters.country ||
    filters.degree ||
    filters.year,
  );
}

/** Case/diacritic-insensitive match that also works for Persian text. */
function normalize(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‌\s]+/g, ' ');
}

export function filterApplications(
  apps: readonly ApplicationWithDetails[],
  filters: ApplicationFilters,
  countryName: (code: string | null) => string = (c) => c ?? '',
): ApplicationWithDetails[] {
  const q = normalize(filters.q.trim());
  return apps.filter((app) => {
    if (filters.statuses.length && !filters.statuses.includes(app.status)) return false;
    if (filters.country && app.country_code !== filters.country) return false;
    if (filters.degree && app.degree_level !== filters.degree) return false;
    if (filters.year && app.intake_year !== filters.year) return false;
    if (q) {
      const haystack = normalize(
        [
          app.university_name,
          app.program_name,
          app.country_code ?? '',
          countryName(app.country_code),
        ].join(' '),
      );
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

// ------------------------------------------------------------------ sorting --
export type SortKey =
  'university' | 'country' | 'degree' | 'intake' | 'status' | 'deadline' | 'progress' | 'updated';
export type SortDir = 'asc' | 'desc';

const TERM_ORDER: Record<IntakeTerm, number> = { spring: 1, summer: 2, fall: 3, winter: 4 };

export function intakeSortValue(term: IntakeTerm | null, year: number | null): number {
  if (!year) return Number.POSITIVE_INFINITY;
  return year * 10 + (term ? TERM_ORDER[term] : 0);
}

export function sortApplications(
  apps: readonly ApplicationWithDetails[],
  key: SortKey,
  dir: SortDir,
  countryName: (code: string | null) => string = (c) => c ?? '',
  now: Date = new Date(),
): ApplicationWithDetails[] {
  const factor = dir === 'asc' ? 1 : -1;
  const value = (app: ApplicationWithDetails): string | number => {
    switch (key) {
      case 'university':
        return app.university_name.toLocaleLowerCase();
      case 'country':
        return countryName(app.country_code).toLocaleLowerCase();
      case 'degree':
        return app.degree_level ? DEGREE_LEVELS.indexOf(app.degree_level) : 99;
      case 'intake':
        return intakeSortValue(app.intake_term, app.intake_year);
      case 'status':
        return APPLICATION_STATUSES.indexOf(app.status);
      case 'deadline': {
        const next = nextDeadline(app, now);
        return next ? new Date(next.due_at).getTime() : Number.POSITIVE_INFINITY;
      }
      case 'progress':
        return requirementProgress(app).ratio;
      case 'updated':
        return new Date(app.updated_at).getTime();
    }
  };
  return [...apps].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    // Missing values always sort last regardless of direction.
    if (va === Number.POSITIVE_INFINITY && vb !== Number.POSITIVE_INFINITY) return 1;
    if (vb === Number.POSITIVE_INFINITY && va !== Number.POSITIVE_INFINITY) return -1;
    if (va < vb) return -1 * factor;
    if (va > vb) return 1 * factor;
    return a.university_name.localeCompare(b.university_name);
  });
}

// ------------------------------------------------------ deadlines/progress --
/** The earliest open deadline that is still in the future. */
export function nextDeadline(
  app: Pick<ApplicationWithDetails, 'deadlines'>,
  now: Date = new Date(),
): Deadline | null {
  let best: Deadline | null = null;
  for (const d of app.deadlines) {
    if (d.is_done) continue;
    if (new Date(d.due_at).getTime() < now.getTime()) continue;
    if (!best || d.due_at < best.due_at) best = d;
  }
  return best;
}

export function requirementProgress(app: Pick<ApplicationWithDetails, 'application_requirements'>) {
  const total = app.application_requirements.length;
  const done = app.application_requirements.filter((r) => r.is_done).length;
  return { done, total, ratio: total === 0 ? 0 : done / total };
}

/** Statuses whose deadlines no longer matter. */
const INACTIVE: readonly ApplicationStatus[] = ['rejected', 'withdrawn'];

export interface DeadlineItem {
  app: ApplicationWithDetails;
  deadline: Deadline;
  days: number;
}

export function collectDeadlines(apps: readonly ApplicationWithDetails[]): DeadlineItem[] {
  const now = new Date();
  return apps
    .flatMap((app) =>
      app.deadlines.map((deadline) => ({ app, deadline, days: daysUntil(deadline.due_at, now) })),
    )
    .sort((a, b) => a.deadline.due_at.localeCompare(b.deadline.due_at));
}

// -------------------------------------------------------------------- stats --
export interface DashboardStats {
  total: number;
  byStatus: Record<ApplicationStatus, number>;
  submitted: number;
  admitted: number;
  rejected: number;
  decided: number;
  acceptanceRate: number | null;
  upcoming: DeadlineItem[];
  overdue: DeadlineItem[];
  requirementsDone: number;
  requirementsTotal: number;
}

const SUBMITTED_OR_LATER: readonly ApplicationStatus[] = [
  'submitted',
  'interview',
  'admitted',
  'rejected',
  'waitlisted',
];

export function computeStats(
  apps: readonly ApplicationWithDetails[],
  now: Date = new Date(),
): DashboardStats {
  const byStatus = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0])) as Record<
    ApplicationStatus,
    number
  >;
  let requirementsDone = 0;
  let requirementsTotal = 0;
  for (const app of apps) {
    byStatus[app.status] += 1;
    const progress = requirementProgress(app);
    requirementsDone += progress.done;
    requirementsTotal += progress.total;
  }
  const admitted = byStatus.admitted;
  const rejected = byStatus.rejected;
  const decided = admitted + rejected;

  const horizon = addDays(now, 30).getTime();
  const upcoming: DeadlineItem[] = [];
  const overdue: DeadlineItem[] = [];
  for (const app of apps) {
    if (INACTIVE.includes(app.status)) continue;
    for (const deadline of app.deadlines) {
      if (deadline.is_done) continue;
      const time = new Date(deadline.due_at).getTime();
      const item = { app, deadline, days: daysUntil(deadline.due_at, now) };
      if (time < now.getTime()) overdue.push(item);
      else if (time <= horizon) upcoming.push(item);
    }
  }
  const byDate = (a: DeadlineItem, b: DeadlineItem) =>
    a.deadline.due_at.localeCompare(b.deadline.due_at);

  return {
    total: apps.length,
    byStatus,
    submitted: apps.filter((a) => SUBMITTED_OR_LATER.includes(a.status)).length,
    admitted,
    rejected,
    decided,
    acceptanceRate: decided === 0 ? null : admitted / decided,
    upcoming: upcoming.sort(byDate),
    overdue: overdue.sort(byDate),
    requirementsDone,
    requirementsTotal,
  };
}
