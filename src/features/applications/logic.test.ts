import { describe, expect, it } from 'vitest';
import { makeApplication, makeDeadline, makeRequirement } from '@/test/factories';
import {
  EMPTY_FILTERS,
  computeStats,
  filterApplications,
  nextDeadline,
  parseFilters,
  requirementProgress,
  sortApplications,
  writeFilters,
} from './logic';

const now = new Date('2026-09-26T12:00:00Z');

describe('filters', () => {
  it('round-trips through URL search params', () => {
    const filters = {
      q: 'munich',
      statuses: ['submitted', 'admitted'] as const,
      country: 'DE',
      degree: 'master' as const,
      year: 2027,
    };
    const params = writeFilters(new URLSearchParams('view=table'), {
      ...filters,
      statuses: [...filters.statuses],
    });
    expect(params.get('view')).toBe('table');
    expect(parseFilters(params)).toEqual({ ...filters, statuses: [...filters.statuses] });
  });

  it('ignores invalid values', () => {
    expect(
      parseFilters(new URLSearchParams('status=bogus&country=germany&degree=x&year=1')),
    ).toEqual(EMPTY_FILTERS);
  });

  it('filters by status, country, degree, year and text (including Persian)', () => {
    const apps = [
      makeApplication({ university_name: 'TU Example', status: 'submitted', country_code: 'DE' }),
      makeApplication({
        university_name: 'دانشگاه تهران',
        program_name: 'MSc',
        status: 'admitted',
        country_code: 'IR',
        intake_year: 2028,
      }),
      makeApplication({
        university_name: 'Toronto Example',
        status: 'planning',
        country_code: 'CA',
        degree_level: 'phd',
      }),
    ];
    expect(filterApplications(apps, { ...EMPTY_FILTERS, statuses: ['submitted'] })).toHaveLength(1);
    expect(filterApplications(apps, { ...EMPTY_FILTERS, country: 'CA' })[0]!.university_name).toBe(
      'Toronto Example',
    );
    expect(filterApplications(apps, { ...EMPTY_FILTERS, degree: 'phd' })).toHaveLength(1);
    expect(filterApplications(apps, { ...EMPTY_FILTERS, year: 2028 })).toHaveLength(1);
    expect(filterApplications(apps, { ...EMPTY_FILTERS, q: 'تهران' })).toHaveLength(1);
    expect(filterApplications(apps, { ...EMPTY_FILTERS, q: 'EXAMPLE' })).toHaveLength(2);
    expect(
      filterApplications(apps, { ...EMPTY_FILTERS, q: 'germany' }, (c) =>
        c === 'DE' ? 'Germany' : '',
      ),
    ).toHaveLength(1);
  });
});

describe('deadlines and progress', () => {
  it('finds the next open future deadline', () => {
    const app = makeApplication({
      deadlines: [
        makeDeadline({ due_at: '2026-09-01T00:00:00Z' }),
        makeDeadline({ due_at: '2026-12-01T00:00:00Z', label: 'later' }),
        makeDeadline({ due_at: '2026-10-01T00:00:00Z', label: 'done', is_done: true }),
        makeDeadline({ due_at: '2026-11-01T00:00:00Z', label: 'next' }),
      ],
    });
    expect(nextDeadline(app, now)?.label).toBe('next');
  });

  it('computes checklist progress', () => {
    const app = makeApplication({
      application_requirements: [
        makeRequirement({ is_done: true }),
        makeRequirement(),
        makeRequirement({ is_done: true }),
      ],
    });
    expect(requirementProgress(app)).toEqual({ done: 2, total: 3, ratio: 2 / 3 });
    expect(requirementProgress(makeApplication()).ratio).toBe(0);
  });
});

describe('sorting', () => {
  it('sorts by next deadline with missing values last in both directions', () => {
    const a = makeApplication({
      university_name: 'A',
      deadlines: [makeDeadline({ due_at: '2026-11-01T00:00:00Z' })],
    });
    const b = makeApplication({ university_name: 'B' });
    const c = makeApplication({
      university_name: 'C',
      deadlines: [makeDeadline({ due_at: '2026-10-01T00:00:00Z' })],
    });
    expect(
      sortApplications([a, b, c], 'deadline', 'asc', undefined, now).map((x) => x.university_name),
    ).toEqual(['C', 'A', 'B']);
    expect(
      sortApplications([a, b, c], 'deadline', 'desc', undefined, now).map((x) => x.university_name),
    ).toEqual(['A', 'C', 'B']);
  });

  it('sorts by intake chronologically', () => {
    const apps = [
      makeApplication({ university_name: 'late', intake_term: 'fall', intake_year: 2028 }),
      makeApplication({ university_name: 'early', intake_term: 'spring', intake_year: 2027 }),
      makeApplication({ university_name: 'mid', intake_term: 'fall', intake_year: 2027 }),
    ];
    expect(sortApplications(apps, 'intake', 'asc').map((x) => x.university_name)).toEqual([
      'early',
      'mid',
      'late',
    ]);
  });
});

describe('dashboard stats', () => {
  it('counts statuses, acceptance rate and upcoming deadlines', () => {
    const apps = [
      makeApplication({ status: 'admitted' }),
      makeApplication({ status: 'admitted' }),
      makeApplication({
        status: 'rejected',
        deadlines: [makeDeadline({ due_at: '2026-10-01T00:00:00Z' })],
      }),
      makeApplication({ status: 'waitlisted' }),
      makeApplication({
        status: 'preparing',
        deadlines: [
          makeDeadline({ due_at: '2026-10-05T00:00:00Z' }),
          makeDeadline({ due_at: '2026-12-05T00:00:00Z' }),
          makeDeadline({ due_at: '2026-09-20T00:00:00Z' }),
        ],
        application_requirements: [makeRequirement({ is_done: true }), makeRequirement()],
      }),
    ];
    const stats = computeStats(apps, now);
    expect(stats.total).toBe(5);
    expect(stats.byStatus.admitted).toBe(2);
    expect(stats.submitted).toBe(4);
    expect(stats.acceptanceRate).toBeCloseTo(2 / 3);
    expect(stats.upcoming).toHaveLength(1);
    expect(stats.overdue).toHaveLength(1);
    expect(stats.requirementsDone).toBe(1);
    expect(stats.requirementsTotal).toBe(2);
  });

  it('has no acceptance rate before any decision', () => {
    expect(computeStats([makeApplication()], now).acceptanceRate).toBeNull();
  });
});
