# ApplyHub · اپلای‌هاب

Collaborative study-abroad application tracker and knowledge base.
It is a static React SPA on **GitHub Pages**, with **Supabase** for auth,
Postgres, Row Level Security, Storage and Realtime.

- **Tracker**: Kanban board, sortable table, deadline calendar (Jalali or
  Gregorian), dashboard, requirement checklists, multiple deadline rounds,
  outcomes, and private notes.
- **Rooms**: invite links, shared applications (private notes are never
  shared), target list with interest votes, markdown notes, file uploads and a
  live activity feed.
- **Knowledge base**: country guides, universities and programs. Every fact
  shows its source and verification date, with a warning when it is older than
  6 months. One click adds a program to your tracker.
- **Moderation**: community edit proposals, an admin review queue and revision
  history.
- **Data**: CSV/JSON export and CSV import.
- Persian (default, RTL) and English (LTR), Vazirmatn font, dark mode,
  mobile-first layout.

The data model, security model and page map are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Project structure

```
src/
  components/      UI kit (ui/), layout, shared widgets (Markdown, DateInput, SourceInfo…)
  features/        auth, profile, applications, dashboard, rooms, kb, moderation, data
  i18n/            fa + en translations (en.ts is the source of truth for keys)
  lib/             supabase client, generated DB types, dates (Jalali), validation
  providers/       auth, preferences (language/calendar/theme), toasts, confirm dialog
supabase/
  migrations/      schema + RLS + RPCs + storage + realtime + placeholder seed
  tests/           SQL test suite for the RLS policies and RPCs, plus a Supabase shim
scripts/db/        npm run db:test / db:types
scripts/local/     optional Docker-free local stack (Supabase Auth + PostgREST)
.github/workflows/ deploy.yml (GitHub Pages) and ci.yml
```

## 1. Create the Supabase project

1. Create a project at <https://supabase.com>.
2. Apply the migrations in `supabase/migrations`, in file-name order. Use one of:
   - **Supabase CLI**: `npx supabase link --project-ref <ref>`, then `npx supabase db push`
   - **SQL editor**: paste and run each file in order
3. **Authentication → URL configuration**
   - Site URL: `https://abtin81badie.github.io`
   - Redirect URLs: `https://abtin81badie.github.io/**` and `http://localhost:5173/**`
4. **Authentication → Providers**
   - Email is on by default. It covers magic links, 6-digit codes and passwords.
   - Google and GitHub: create OAuth apps whose callback URL is
     `https://<project-ref>.supabase.co/auth/v1/callback`, then paste the client
     id and secret into Supabase.
5. *Optional, recommended:* in **Authentication → Email templates**, add
   `{{ .Token }}` to the *Magic Link* and *Confirm signup* templates. Users can
   then type the 6-digit code instead of clicking the link, which helps when the
   email is opened on another device.

The migrations also create the private storage bucket `room-files`, its
policies, and the Realtime publication for `activity_log`.

### Your admin account

**The first account that signs up in a fresh project automatically becomes an
admin.** The repository contains no username or password. Open the deployed
site, click **Sign up**, and register with your own email. That account is the
admin.

To make more users admins, run this in the SQL editor:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

Admins see **Moderation** in the menu. They can approve proposals, publish
directly, and change roles with `select public.set_user_role('<user-id>', 'admin');`.

## 2. Environment variables

Copy `.env.example` to `.env.local`:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon / publishable key>
VITE_BASE_PATH=/
```

The anon key is public by design. All authorization happens in Postgres
through RLS. **Never** put the `service_role` key in a `VITE_*` variable.

## 3. Run locally

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (vitest)
npm run db:test      # migrations + 150+ RLS assertions on a throwaway Postgres
npm run db:types     # regenerate src/lib/database.types.ts from the migrations
```

`npm run db:test` needs PostgreSQL 15+ server binaries, or
`DATABASE_URL=postgresql://…`. For a full local backend, use `npx supabase start`
(needs Docker), or `bash scripts/local/stack.sh start` (Linux, no Docker, no
Storage or Realtime).

## 4. Deploy to GitHub Pages

`https://abtin81badie.github.io/` is a **user site**, so the code must live in
the repository `abtin81badie/abtin81badie.github.io`. Either rename this
repository to that name, or push this code there.

1. **Settings → Secrets and variables → Actions**: add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`.
2. **Settings → Pages → Source**: choose **GitHub Actions**. Until this is done
   the workflow still builds and tests, then skips deployment with a warning.
3. Push to `main`, or re-run the workflow from the **Actions** tab.
   `.github/workflows/deploy.yml` type-checks, lints, tests, builds and deploys.

Site addresses:
- repository named `applyhub`: <https://abtin81badie.github.io/applyhub/>
- repository renamed to `abtin81badie.github.io`: <https://abtin81badie.github.io/>

The workflow reads the base path from `actions/configure-pages`. The same
build therefore also works as a project site
(`https://abtin81badie.github.io/applyhub/`) if you keep this repository name.
Deep links such as `/rooms/abc` survive a refresh through the generated
`404.html` redirect.

## Security notes

- RLS is enabled on every table. Membership checks live in `SECURITY DEFINER`
  helpers in a `private` schema that the API does not expose.
- Column-level grants make ids, owners and `profiles.role` immutable from the
  browser.
- Room members read shared applications only through RPCs that exclude private
  notes.
- Invite codes carry 60 random bits and can expire, have a use limit, or be
  revoked. Creating them is rate limited (10 per hour per user).
- Markdown is rendered without raw HTML and sanitized. Only `http(s)` and
  `mailto` links are allowed, and images are shown as links.
- Files go to a private bucket and are downloaded through signed URLs that
  expire after 60 seconds. The upload dialog warns users not to upload
  passports, ID numbers or bank details.

## Knowledge-base data

The seed contains **placeholder examples only**. They are clearly labelled and
contain no real deadlines, fees or requirements. Add real data through the
moderation flow. Every non-placeholder fact must have `source_url` and
`last_verified_at`, and the database enforces this with a CHECK constraint.
