import { describe, expect, it } from 'vitest';
import { makeApplication, makeDeadline, makeRequirement } from '@/test/factories';
import { applicationsToCsv, csvTemplate, parseApplicationsCsv } from './csv';

describe('application CSV', () => {
  it('round-trips export → import', () => {
    const app = makeApplication({
      university_name: 'دانشگاه نمونه, "quoted"',
      status: 'submitted',
      application_fee_amount: 75,
      application_fee_currency: 'EUR',
      deadlines: [makeDeadline({ label: 'Round 1', due_at: '2027-01-15T23:59:00.000Z' })],
      application_requirements: [makeRequirement({ kind: 'sop', label: 'SOP', is_done: true })],
    });
    const rows = parseApplicationsCsv(applicationsToCsv([app]));
    expect(rows).toHaveLength(1);
    const input = rows[0]!.input!;
    expect(input.application.university_name).toBe('دانشگاه نمونه, "quoted"');
    expect(input.application.status).toBe('submitted');
    expect(input.application.application_fee_amount).toBe(75);
    expect(input.deadlines).toEqual([
      { label: 'Round 1', due_at: '2027-01-15T23:59:00.000Z', is_done: false },
    ]);
    expect(input.requirements).toEqual([{ kind: 'sop', label: 'SOP', is_done: true }]);
  });

  it('parses the template and reports invalid rows', () => {
    expect(parseApplicationsCsv(csvTemplate())[0]!.input).toBeDefined();
    const bad = parseApplicationsCsv('university_name,status\n,planning\nOk Uni,nope\nFine Uni,\n');
    expect(bad[0]!.error).toBeDefined();
    expect(bad[1]!.error).toBeDefined();
    expect(bad[2]!.input?.application.status).toBe('researching');
  });
});
