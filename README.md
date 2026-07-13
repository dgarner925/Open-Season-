# OpenSeason

Hunting season dates, tag/permit application windows, and plain-English regs for
Deer, Elk, Bear, and Ducks across U.S. states. Native mobile (iOS + Android).

**Accuracy is the brand promise.** Every date shows its official source and a
"last verified" stamp, and every dates/rules screen carries the disclaimer:
_"Informational only. Always confirm dates and rules with the official state
regulations before hunting."_

## Stack

- **Mobile:** Expo (managed) · React Native · TypeScript · Expo Router
- **Backend:** Supabase — Postgres, Auth, RLS, Edge Functions, pg_cron
- **Data:** TanStack Query · **Styling:** RN StyleSheet + theme tokens (`src/theme`)
- **Push:** Expo Push, driven by a daily pg_cron job
- **Builds:** EAS Build + EAS Update

## Layout

```
app/                 Expo Router routes
  (auth)/            sign-in
  (tabs)/            Next Up (home), Seasons, Tags, Regs, Settings, Admin
  season/[id]        season detail        window/[id]  tag window detail
  regs/[id]          regs detail          onboarding   pick states + species
src/
  theme/             colors, typography, spacing (dark forest / bone / brass)
  lib/               supabase client, date utils, generated DB types
  components/        ui kit, CountdownCard, Provenance (source+verified+disclaimer)
  features/          reference + follows query hooks
  providers/         AuthProvider (session + profile + is_admin)
supabase/
  migrations/        schema + RLS (timestamped, CLI-pushable)
  functions/         Edge Functions (notifications, extraction) — added in later steps
```

## First-time setup (PowerShell)

Dependencies are already installed. If you clone fresh:

```powershell
npm install
npx expo install --fix   # reconcile native versions to the Expo SDK
```

### 1. Create the Supabase project + push the schema

```powershell
# One-time: install the Supabase CLI if you don't have it
npm install -g supabase

# Initialize the CLI in this repo (creates supabase/config.toml; keeps migrations)
npx supabase init

# Log in and link to your NEW project (create it at https://supabase.com/dashboard)
npx supabase login
npx supabase link --project-ref <YOUR-PROJECT-REF>

# Review the SQL, then push all migrations
npx supabase db push
```

Prefer the dashboard? Paste each file in `supabase/migrations/` (in order) into
the SQL Editor and run it.

### 2. Wire the app to Supabase

```powershell
Copy-Item .env.example .env
# then edit .env and set:
#   EXPO_PUBLIC_SUPABASE_URL       (Project Settings > API > Project URL)
#   EXPO_PUBLIC_SUPABASE_ANON_KEY  (Project Settings > API > publishable key,
#                                   sb_publishable_...; or the legacy anon key)
```

### 3. Make yourself an admin (for the review tab)

After you sign up in the app once, run this in the Supabase SQL Editor:

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'dgarner925@gmail.com');
```

### 4. Regenerate DB types after any schema change (optional but recommended)

```powershell
npx supabase gen types typescript --project-id <YOUR-PROJECT-REF> > src/lib/database.types.ts
```

## Run it

```powershell
npm run start       # Expo dev server; press i / a, or scan with Expo Go
npm run typecheck   # tsc --noEmit
```

## Data model notes

- **Nothing is public until `status = 'published'`.** Seed rows land as `draft`.
- **Zones are first-class** (`statewide` / `county_group` / `gmu` / `flyway_zone`).
  Waterfowl splits are just multiple `seasons` rows sharing a `flyway_zone`.
- **Writes to reference data are admin-only** (RLS + `public.is_admin()`).
- **Notifications are idempotent** via the `sent_notifications` unique key.
- **Automated refresh never auto-publishes** — extracted changes land in
  `review_queue` for admin approval.

## Build order / status

1. ✅ Scaffold + config
2. ✅ Schema migrations + RLS
3. ✅ Seed data (GA, AL, CO, MT, WY — draft, sourced; see `supabase/seed-data/`)
4. ✅ Auth + onboarding
5. ✅ Home countdown + calendar + detail views
6. ✅ Tag windows + regs summaries
7. ⏳ Alert prefs + pg_cron + Expo Push
8. ✅ Admin review screen + extraction Edge Function (Georgia PoC; see `supabase/functions/`)
9. ⏳ EAS build config + icons/splash
