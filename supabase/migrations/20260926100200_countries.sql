-- =============================================================================
-- ApplyHub · 2. Countries (reference data used by the tracker, rooms and KB)
-- =============================================================================

create table public.countries (
  code          text primary key check (code ~ '^[A-Z]{2}$'),
  name_en       text not null check (char_length(name_en) between 1 and 100),
  name_fa       text not null check (char_length(name_fa) between 1 and 100),
  flag_emoji    text check (char_length(flag_emoji) <= 16),
  region        text not null default 'other'
                  check (region in ('europe', 'americas', 'asia', 'oceania', 'africa', 'other')),
  currency_code text check (private.is_currency(currency_code)),
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.countries is 'ISO-3166 countries shown in pickers and the knowledge base. Admin-managed.';

create trigger countries_set_updated_at
  before update on public.countries
  for each row execute function private.set_updated_at();

alter table public.countries enable row level security;

create policy "countries_select_published"
  on public.countries for select
  to anon, authenticated
  using (is_published or (select private.is_admin()));

create policy "countries_admin_insert"
  on public.countries for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "countries_admin_update"
  on public.countries for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "countries_admin_delete"
  on public.countries for delete
  to authenticated
  using ((select private.is_admin()));

revoke insert, update, delete on public.countries from anon;

-- -----------------------------------------------------------------------------
-- Seed: common study destinations. Names, flags, regions and currency codes
-- are stable reference data; no admissions facts are seeded here.
-- -----------------------------------------------------------------------------
insert into public.countries (code, name_en, name_fa, flag_emoji, region, currency_code) values
  ('DE', 'Germany',              'آلمان',              '🇩🇪', 'europe',   'EUR'),
  ('AT', 'Austria',              'اتریش',              '🇦🇹', 'europe',   'EUR'),
  ('CH', 'Switzerland',          'سوئیس',              '🇨🇭', 'europe',   'CHF'),
  ('NL', 'Netherlands',          'هلند',               '🇳🇱', 'europe',   'EUR'),
  ('BE', 'Belgium',              'بلژیک',              '🇧🇪', 'europe',   'EUR'),
  ('FR', 'France',               'فرانسه',             '🇫🇷', 'europe',   'EUR'),
  ('IT', 'Italy',                'ایتالیا',            '🇮🇹', 'europe',   'EUR'),
  ('ES', 'Spain',                'اسپانیا',            '🇪🇸', 'europe',   'EUR'),
  ('PT', 'Portugal',             'پرتغال',             '🇵🇹', 'europe',   'EUR'),
  ('SE', 'Sweden',               'سوئد',               '🇸🇪', 'europe',   'SEK'),
  ('NO', 'Norway',               'نروژ',               '🇳🇴', 'europe',   'NOK'),
  ('DK', 'Denmark',              'دانمارک',            '🇩🇰', 'europe',   'DKK'),
  ('FI', 'Finland',              'فنلاند',             '🇫🇮', 'europe',   'EUR'),
  ('IE', 'Ireland',              'ایرلند',             '🇮🇪', 'europe',   'EUR'),
  ('GB', 'United Kingdom',       'بریتانیا',           '🇬🇧', 'europe',   'GBP'),
  ('PL', 'Poland',               'لهستان',             '🇵🇱', 'europe',   'PLN'),
  ('CZ', 'Czechia',              'چک',                 '🇨🇿', 'europe',   'CZK'),
  ('HU', 'Hungary',              'مجارستان',           '🇭🇺', 'europe',   'HUF'),
  ('EE', 'Estonia',              'استونی',             '🇪🇪', 'europe',   'EUR'),
  ('LU', 'Luxembourg',           'لوکزامبورگ',         '🇱🇺', 'europe',   'EUR'),
  ('GR', 'Greece',               'یونان',              '🇬🇷', 'europe',   'EUR'),
  ('TR', 'Türkiye',              'ترکیه',              '🇹🇷', 'europe',   'TRY'),
  ('AM', 'Armenia',              'ارمنستان',           '🇦🇲', 'asia',     'AMD'),
  ('GE', 'Georgia',              'گرجستان',            '🇬🇪', 'asia',     'GEL'),
  ('RU', 'Russia',               'روسیه',              '🇷🇺', 'europe',   'RUB'),
  ('US', 'United States',        'ایالات متحده آمریکا', '🇺🇸', 'americas', 'USD'),
  ('CA', 'Canada',               'کانادا',             '🇨🇦', 'americas', 'CAD'),
  ('AU', 'Australia',            'استرالیا',           '🇦🇺', 'oceania',  'AUD'),
  ('NZ', 'New Zealand',          'نیوزیلند',           '🇳🇿', 'oceania',  'NZD'),
  ('JP', 'Japan',                'ژاپن',               '🇯🇵', 'asia',     'JPY'),
  ('KR', 'South Korea',          'کره جنوبی',          '🇰🇷', 'asia',     'KRW'),
  ('CN', 'China',                'چین',                '🇨🇳', 'asia',     'CNY'),
  ('HK', 'Hong Kong',            'هنگ‌کنگ',            '🇭🇰', 'asia',     'HKD'),
  ('SG', 'Singapore',            'سنگاپور',            '🇸🇬', 'asia',     'SGD'),
  ('MY', 'Malaysia',             'مالزی',              '🇲🇾', 'asia',     'MYR'),
  ('AE', 'United Arab Emirates', 'امارات متحده عربی',  '🇦🇪', 'asia',     'AED'),
  ('IR', 'Iran',                 'ایران',              '🇮🇷', 'asia',     'IRR')
on conflict (code) do nothing;
