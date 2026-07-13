# Seed source data

One JSON file per V1 state. Each row was researched from that state's **official
wildlife-agency website only** (no blogs/aggregators) and carries its exact
`source_url`. These files are the auditable provenance behind
`../migrations/20260713100700_seed_seasons.sql`.

## Regenerate the seed migration

```powershell
node scripts/gen-seed.js supabase/seed-data supabase/migrations/20260713100700_seed_seasons.sql
```

## Rules baked into the data

- Every generated row is `status = 'draft'` with `last_verified_at = NULL`.
  A human verifies each row against its source and flips it to `published`.
- Dates that could **not** be confirmed on an official source are left `null`
  with a `TODO:` note — never guessed.

## Known license-year / coverage notes (as of 2026-07-13)

- **GA, AL**: 2026–27 dates are not yet machine-readable (GA publishes only
  Publuu flip-books; AL finalizes in late summer). Seeded with the most recent
  **2025–26** official dates. `season_year = 2025`.
- **CO, MT**: big-game **2026** dates confirmed from official PDFs. CO **duck**
  is `null` (2026–27 brochure due Aug 2026).
- **WY**: big-game **2026** confirmed, but elk/deer/bear have **no statewide**
  general-season date (set per hunt area) → `null` by design; only the Sep 1–30
  special-archery framework is seeded. WY **duck** is 2025–26 (`season_year = 2025`).
  Nonresident fee figures are flagged for verification against the official brochure.
