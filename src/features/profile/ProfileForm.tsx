import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { CountryMultiSelect } from '@/components/common/CountrySelect';
import { Field, Input, Select } from '@/components/ui/Input';
import { DEGREE_LEVELS, INTAKE_TERMS, yearOptions } from '@/lib/domain';
import { zodFieldErrors } from '@/lib/validation';
import { useFormat } from '@/providers/PreferencesProvider';
import type { Profile, ProfileUpdate } from './api';

const schema = z.object({
  display_name: z.string().trim().min(1, 'validation.required').max(80),
  avatar_url: z.union([
    z.literal(''),
    z.url({ protocol: /^https$/, error: 'validation.invalidUrl' }).max(2048),
  ]),
  field_of_study: z.string().trim().max(120),
  target_degree: z.enum(DEGREE_LEVELS).nullable(),
  target_intake_term: z.enum(INTAKE_TERMS).nullable(),
  target_intake_year: z.number().int().min(2000).max(2100).nullable(),
  target_countries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(30),
});

type FormState = z.input<typeof schema>;

function fromProfile(profile: Profile | undefined): FormState {
  return {
    display_name: profile?.display_name ?? '',
    avatar_url: profile?.avatar_url ?? '',
    field_of_study: profile?.field_of_study ?? '',
    target_degree: profile?.target_degree ?? null,
    target_intake_term: profile?.target_intake_term ?? null,
    target_intake_year: profile?.target_intake_year ?? null,
    target_countries: profile?.target_countries ?? [],
  };
}

/** Profile fields shared by onboarding and the profile page. */
export function ProfileForm({
  profile,
  onSubmit,
  actions,
}: {
  profile: Profile | undefined;
  onSubmit: (patch: ProfileUpdate) => void;
  actions: ReactNode;
}) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [form, setForm] = useState<FormState>(() => fromProfile(profile));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error, t));
      return;
    }
    setErrors({});
    const v = parsed.data;
    onSubmit({
      display_name: v.display_name,
      avatar_url: v.avatar_url || null,
      field_of_study: v.field_of_study || null,
      target_degree: v.target_degree,
      target_intake_term: v.target_intake_term,
      target_intake_year: v.target_intake_year,
      target_countries: v.target_countries,
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t('profile.displayName')} htmlFor="p-name" error={errors.display_name}>
          <Input
            id="p-name"
            dir="auto"
            maxLength={80}
            value={form.display_name}
            onChange={(e) => update('display_name', e.target.value)}
            aria-invalid={Boolean(errors.display_name) || undefined}
          />
        </Field>
        <Field label={t('profile.fieldOfStudy')} htmlFor="p-field" error={errors.field_of_study}>
          <Input
            id="p-field"
            dir="auto"
            maxLength={120}
            placeholder={t('profile.fieldOfStudyPlaceholder')}
            value={form.field_of_study}
            onChange={(e) => update('field_of_study', e.target.value)}
          />
        </Field>
        <Field label={t('profile.targetDegree')} htmlFor="p-degree">
          <Select
            id="p-degree"
            value={form.target_degree ?? ''}
            onChange={(e) =>
              update('target_degree', (e.target.value || null) as FormState['target_degree'])
            }
          >
            <option value="">{t('common.notSet')}</option>
            {DEGREE_LEVELS.map((d) => (
              <option key={d} value={d}>
                {t(`enums.degree.${d}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('profile.targetIntake')} htmlFor="p-intake-term">
          <div className="flex gap-2">
            <Select
              id="p-intake-term"
              aria-label={t('applications.form.intakeTerm')}
              value={form.target_intake_term ?? ''}
              onChange={(e) =>
                update(
                  'target_intake_term',
                  (e.target.value || null) as FormState['target_intake_term'],
                )
              }
            >
              <option value="">{t('common.notSet')}</option>
              {INTAKE_TERMS.map((term) => (
                <option key={term} value={term}>
                  {t(`enums.intakeTerm.${term}`)}
                </option>
              ))}
            </Select>
            <Select
              aria-label={t('applications.form.intakeYear')}
              value={form.target_intake_year ?? ''}
              onChange={(e) =>
                update('target_intake_year', e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">{t('common.notSet')}</option>
              {yearOptions().map((y) => (
                <option key={y} value={y}>
                  {fmt.number(y, { useGrouping: false })}
                </option>
              ))}
            </Select>
          </div>
        </Field>
      </div>
      <Field label={t('profile.targetCountries')} htmlFor="p-countries">
        <CountryMultiSelect
          id="p-countries"
          value={form.target_countries}
          onChange={(codes) => update('target_countries', codes)}
        />
      </Field>
      <Field
        label={t('profile.avatarUrl')}
        htmlFor="p-avatar"
        hint={t('profile.avatarHint')}
        error={errors.avatar_url}
        optional
        optionalLabel={t('common.optional')}
      >
        <Input
          id="p-avatar"
          type="url"
          dir="ltr"
          placeholder="https://"
          value={form.avatar_url}
          onChange={(e) => update('avatar_url', e.target.value)}
          aria-invalid={Boolean(errors.avatar_url) || undefined}
        />
      </Field>
      <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
    </form>
  );
}
