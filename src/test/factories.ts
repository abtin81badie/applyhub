import type { ApplicationWithDetails, Deadline, Requirement } from '@/features/applications/api';

let counter = 0;
const id = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;

export function makeDeadline(partial: Partial<Deadline> = {}): Deadline {
  return {
    id: id(),
    application_id: 'app',
    label: 'Round 1',
    due_at: '2030-01-15T23:59:00.000Z',
    is_done: false,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

export function makeRequirement(partial: Partial<Requirement> = {}): Requirement {
  return {
    id: id(),
    application_id: 'app',
    kind: 'other',
    label: 'Item',
    is_done: false,
    notes: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

export function makeApplication(
  partial: Partial<ApplicationWithDetails> = {},
): ApplicationWithDetails {
  return {
    id: id(),
    user_id: 'user',
    country_code: 'DE',
    university_id: null,
    program_id: null,
    university_name: 'Example University',
    program_name: 'MSc Example',
    degree_level: 'master',
    intake_term: 'fall',
    intake_year: 2027,
    portal_url: null,
    status: 'researching',
    submitted_at: null,
    application_fee_amount: null,
    application_fee_currency: null,
    tuition_amount: null,
    tuition_currency: null,
    tuition_period: null,
    funding_info: null,
    result_date: null,
    decision_notes: null,
    notes: null,
    visibility: 'private',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deadlines: [],
    application_requirements: [],
    ...partial,
  };
}
