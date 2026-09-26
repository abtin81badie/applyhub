-- =============================================================================
-- ApplyHub · 7. Placeholder knowledge-base content
--
-- IMPORTANT: nothing in this file is real admissions information. Every row
-- is flagged is_placeholder = true, carries no source, and is labelled
-- "placeholder" in its text so the UI shows a "Placeholder example" badge.
-- It exists only to demonstrate the structure (guide sections, universities,
-- programs, requirements, deadlines) until the community adds verified data.
-- Remove it at any time with:
--   delete from public.universities where is_placeholder;
--   delete from public.country_guides where is_placeholder;
-- =============================================================================

-- Guide sections for a few countries, in Persian and English.
with section_labels(section, label_en, label_fa) as (
  values
    ('overview'::public.guide_section,       'Overview',                'نمای کلی'),
    ('application_process',                   'Application process',     'مراحل اپلای'),
    ('timeline',                              'Typical timeline',        'زمان‌بندی معمول'),
    ('required_documents',                    'Required documents',      'مدارک لازم'),
    ('language_requirements',                 'Language requirements',   'شرایط زبان'),
    ('tuition_scholarships',                  'Tuition & scholarships',  'شهریه و بورسیه'),
    ('visa_process',                          'Visa process',            'مراحل ویزا'),
    ('cost_of_living',                        'Cost of living',          'هزینه زندگی')
)
insert into public.country_guides (country_code, locale, section, body_md, is_placeholder)
select c.code, loc.locale, s.section,
       case loc.locale
         when 'en' then format(
           E'> **Placeholder example: not real information.**\n>\n' ||
           E'> The “%s” section for %s has not been written yet. If you have verified, up-to-date ' ||
           E'information, click **Propose edit** and include a link to the official source.\n\n' ||
           E'Suggested structure:\n\n' ||
           E'- Key points in a short list\n' ||
           E'- Important steps or dates, each with its source\n' ||
           E'- Links to the official pages you used',
           s.label_en, c.name_en)
         else format(
           E'> **نمونه ساختگی: این اطلاعات واقعی نیست.**\n>\n' ||
           E'> بخش «%s» برای %s هنوز نوشته نشده است. اگر اطلاعات معتبر و به‌روز دارید، روی ' ||
           E'**پیشنهاد ویرایش** بزنید و پیوند منبع رسمی را هم اضافه کنید.\n\n' ||
           E'ساختار پیشنهادی:\n\n' ||
           E'- نکات کلیدی در یک فهرست کوتاه\n' ||
           E'- مراحل یا تاریخ‌های مهم، هرکدام با منبع\n' ||
           E'- پیوند صفحه‌های رسمی که استفاده کرده‌اید',
           s.label_fa, c.name_fa)
       end,
       true
from public.countries c
cross join (values ('en'), ('fa')) as loc(locale)
cross join section_labels s
where c.code in ('DE', 'CA', 'IT', 'NL')
on conflict (country_code, locale, section) do nothing;

-- Example universities (fictional names).
insert into public.universities
  (id, country_code, name_en, name_fa, city, institution_type, description_md, is_placeholder)
values
  ('00000000-0000-4000-8000-00000000d001', 'DE', 'Example Technical University (placeholder)',
   'دانشگاه فنی نمونه (ساختگی)', 'Munich', 'public',
   'Placeholder example used to demonstrate the knowledge base. Not a real institution.', true),
  ('00000000-0000-4000-8000-00000000d002', 'DE', 'Example University of Applied Sciences (placeholder)',
   'دانشگاه علوم کاربردی نمونه (ساختگی)', 'Berlin', 'public',
   'Placeholder example used to demonstrate the knowledge base. Not a real institution.', true),
  ('00000000-0000-4000-8000-00000000c001', 'CA', 'Example University of Canada (placeholder)',
   'دانشگاه نمونه کانادا (ساختگی)', 'Toronto', 'public',
   'Placeholder example used to demonstrate the knowledge base. Not a real institution.', true),
  ('00000000-0000-4000-8000-00000000a001', 'IT', 'Example Polytechnic (placeholder)',
   'پلی‌تکنیک نمونه (ساختگی)', 'Milan', 'public',
   'Placeholder example used to demonstrate the knowledge base. Not a real institution.', true),
  ('00000000-0000-4000-8000-00000000b001', 'NL', 'Example University of Technology (placeholder)',
   'دانشگاه صنعتی نمونه (ساختگی)', 'Rotterdam', 'public',
   'Placeholder example used to demonstrate the knowledge base. Not a real institution.', true)
on conflict (id) do nothing;

-- Example programs. Amounts are obviously fake round numbers, flagged as placeholders.
insert into public.programs
  (id, university_id, name_en, name_fa, degree_level, field, languages, duration_months,
   tuition_amount_min, tuition_amount_max, tuition_currency, tuition_period,
   application_fee_amount, application_fee_currency, description_md, is_placeholder)
values
  ('00000000-0000-4000-8000-0000000d0101', '00000000-0000-4000-8000-00000000d001',
   'MSc Computer Science (placeholder)', 'کارشناسی ارشد علوم کامپیوتر (ساختگی)', 'master',
   'Computer Science', array['en'], 24, null, null, null, null, null, null,
   'Placeholder program. Replace with verified information from the official program page.', true),
  ('00000000-0000-4000-8000-0000000d0102', '00000000-0000-4000-8000-00000000d001',
   'PhD Electrical Engineering (placeholder)', 'دکتری مهندسی برق (ساختگی)', 'phd',
   'Electrical Engineering', array['en', 'de'], 48, null, null, null, null, null, null,
   'Placeholder program. Replace with verified information from the official program page.', true),
  ('00000000-0000-4000-8000-0000000d0201', '00000000-0000-4000-8000-00000000d002',
   'MEng Mechatronics (placeholder)', 'کارشناسی ارشد مکاترونیک (ساختگی)', 'master',
   'Mechanical Engineering', array['de'], 18, 1000, 1000, 'EUR', 'year', null, null,
   'Placeholder program. Replace with verified information from the official program page.', true),
  ('00000000-0000-4000-8000-0000000c0101', '00000000-0000-4000-8000-00000000c001',
   'MSc Data Science (placeholder)', 'کارشناسی ارشد علوم داده (ساختگی)', 'master',
   'Data Science', array['en'], 16, 20000, 30000, 'CAD', 'year', 100, 'CAD',
   'Placeholder program. Replace with verified information from the official program page.', true),
  ('00000000-0000-4000-8000-0000000a0101', '00000000-0000-4000-8000-00000000a001',
   'MSc Architecture (placeholder)', 'کارشناسی ارشد معماری (ساختگی)', 'master',
   'Architecture', array['en', 'it'], 24, 1000, 4000, 'EUR', 'year', null, null,
   'Placeholder program. Replace with verified information from the official program page.', true),
  ('00000000-0000-4000-8000-0000000b0101', '00000000-0000-4000-8000-00000000b001',
   'MSc Robotics (placeholder)', 'کارشناسی ارشد رباتیک (ساختگی)', 'master',
   'Robotics', array['en'], 24, 10000, 10000, 'EUR', 'year', 100, 'EUR',
   'Placeholder program. Replace with verified information from the official program page.', true)
on conflict (id) do nothing;

insert into public.program_requirements (program_id, kind, description, is_mandatory, sort_order, is_placeholder)
select p.id, r.kind, r.description, r.is_mandatory, r.sort_order, true
from public.programs p
cross join (values
  ('language_test'::public.requirement_kind, '[Placeholder] Language test: minimum score to be verified on the official page', true, 1),
  ('transcript', '[Placeholder] Transcripts of previous studies', true, 2),
  ('cv', '[Placeholder] CV / résumé', true, 3),
  ('sop', '[Placeholder] Statement of purpose', true, 4),
  ('lor', '[Placeholder] Recommendation letters: number to be verified', false, 5)
) as r(kind, description, is_mandatory, sort_order)
where p.is_placeholder and p.id::text like '00000000-0000-4000-8000-%'
  and not exists (select 1 from public.program_requirements x where x.program_id = p.id);

insert into public.program_deadlines
  (program_id, intake_term, intake_year, round_label, applicant_group, deadline_at, notes, is_placeholder)
select p.id, 'fall', 2027, '[Placeholder] Main round', 'international',
       timestamptz '2027-01-15 23:59:00+00',
       'Placeholder date for demonstration only. Check the official admissions page.', true
from public.programs p
where p.is_placeholder and p.id::text like '00000000-0000-4000-8000-%'
  and not exists (select 1 from public.program_deadlines x where x.program_id = p.id);
