# Design language v2 — Pass 2 plan (audit synthesis, 2026-08-27)

Reference implementation: `app/season/[id].tsx`. Tokens: `src/theme/tokens.ts`. Primitives: `src/components/system.tsx`.
Status: season detail is the ONLY converted screen. Everything else is pre-v2 (legacy `ui.tsx`/`midnight.tsx`/`@/theme`).

## Systemic findings (fix once, not per screen)
- Three different gutters exist (24 / 16 / legacy Screen); rule 1 requires system `Screen` everywhere. Note safe-area edges differ (legacy top vs v2 bottom) — decide once.
- Legacy `Button` is a rounded rect, not a Pill; every primary action is the wrong object.
- `Pill` name collision: ui.tsx Pill = status label (forbidden), system.tsx Pill = action. Rename/delete ui's before bulk work.
- No mechanical AppText→v2 mapping: every call site is a judgment (Sentence/Serif/Micro).
- Retire globally: `StatusPill`, `GlassChip`, `Dot`, `SectionRule`, `Card` (gradient + accentColor bar), `speciesColors`, `urgencyColor`, `theme.color.success/danger/warning` (v2 has no semantic color ramp — urgency = position + words).
- v2 has NO form vocabulary yet — both edit screens block on inventing one (see D9).

## DECISIONS (gate Pass 3 — David's calls, with recommendations)
- **STATUS 2026-08-27: David approved all recommendations EXCEPT D2 (overridden — keep tiles) and D4/D10 sentence treatments (pending renders).**
- **D1 Wordmark & PageTitle.** Retire `PageTitle` (serif + italic-copper accent word) from all content screens — native header + opening Sentence; serif heroes only where the subject is real (species/date/count). EXCEPTION: the wordmark itself ("Open *Season*") on sign-in and LaunchQuote keeps the italic copper — it's the brand mark (icon/splash use it). — RECOMMENDED
- **D2 Engraved badges.** DECIDED (David, 2026-08-27): KEEP the tiles — animals stay in their badge tiles as today. Retokenize fills to lang palette during conversion but the tile survives; monogram fallback survives. Copper-scarcity on rows is managed by muting everything else in the row.
- **D3 Pills-as-state.** All filter chips / toggles / choice chips leave pill form. Search filters → tappable sentence spans or fold into query; alerts cadence ladder → see D10; unit picker (location) → hairline rows w/ copper check. — RECOMMENDED (mechanism per screen)
- **D4 Home stat tiles.** Dissolve the three boxes into one sentence with tappable Serif counts ("Three species open, four openers ahead, one deadline this month."). — RECOMMENDED
- **D5 Species quote epigraphs.** Adapt, don't cut: keep quote, attribution to dim, divider becomes Rule, position below hero. (Cutting loses the app's voice; keeping copper-as-is breaks rule 7.) — RECOMMENDED: adapt
- **D6 Open/closed status in list rows.** No pill. Status is an italic Serif word — copper "Open" as the row's one copper element; everything else in the subtitle sentence. — RECOMMENDED
- **D7 Weekend Brief card.** Keeps card status — the one sanctioned Home card (separate actionable object). Loses the copper left spine; brief lines become Sentence (serif only for dates/counts inside). — RECOMMENDED
- **D8 Provenance.** Extract the season page's "Verified against X, date ›" sentence back into Provenance.tsx as the implementation; Disclaimer becomes dim Sentence after a Rule at page bottom (position = weight). ALSO: add the missing Disclaimer to the reference season page (it's out of compliance with the trust-trio brief). — RECOMMENDED
- **D9 Form vocabulary.** Row-as-field: label left, value right (Serif for dates/counts), tap opens a sheet/inline editor; hairlines free; sentences above sensitive fields. Prototype on points-edit, then application-edit. — RECOMMENDED
- **D10 Alerts ladder (product, not styling).** Current: up to 16 state-pills per follow. Options: (a) rows-per-offset (compliant, tall), (b) sentence with tappable spans ("Remind me *a month*, *a week*, and *a day* ahead."), (c) simplify to one cadence choice per kind (changes capability). — RECOMMENDED: (b)
- **D11 LaunchQuote.** Sanctioned exception: keep, retokenize colors to lang, eyebrow → Micro, wordmark per D1. Timing: keep David's 4s hold; add faint "tap to skip" Micro. — RECOMMENDED
- **D12 Party/window action walls.** Two pills max per screen; remaining actions become sentence links; destructive = dim Sentence link (retire ghost Button). — RECOMMENDED

## Bugs surfaced by audit (fix during conversion, independent of styling)
- parties.tsx join flow uses iOS-only Alert.prompt — dead button on Android.
- paywall.tsx hardcodes $9.99 fallback when offerings fail (always on Android today); needs loading state before price gets hero serif.
- points.tsx nests ± pressables inside a pressable card — mis-tap navigation; instant writes with no undo.
- application-edit dates are unvalidated free text.
- window/[id] calls formatDate unguarded on three nullable dates.

## Conversion order (Pass 3 — one screen per session-chunk, commit each)
**Phase A — foundations:** D1–D12 sign-off → Provenance rewrite → ProUpsellCard + NotificationsOffBanner (warning-by-position precedent) → season page gets its Disclaimer.
**Phase B — small proofs (S):** how-to → notifications → reset-password → updates-debug (strip PageTitle/SYSTEM only; declared exempt otherwise) → residency (establishes the state-list Row pattern) → parties.
**Phase C — high-visibility (M):** search → regs (list) → regs/[id] → applications/Tags → calendar/Seasons → paywall (defines the one card) → sign-in (settles wordmark) → LaunchQuote retoken.
**Phase D — the big ones (L):** window/[id] (Thread legitimately extends: opens → deadline → results; SunArc does NOT) → species/[id] (after D2/D5) → Home → Profile/settings → points → party/[id] (second Thread consumer) → location → follows/HuntPicker → alerts (after D10) → points-edit → application-edit → onboarding LAST (consumes every pattern).
**Exempt:** admin.tsx (internal; stays legacy), LaunchQuote (exception per D11).
**Cleanup:** retire ui.tsx Card/Pill/GlassChip/Dot + midnight.tsx wholesale only after all screens convert.

## Doesn't-fit flags (called out rather than forced)
- LaunchQuote: rules 1–4 don't apply to a full-bleed centered quote; forcing them damages it.
- updates-debug: a log is a log; minimal strip only.
- Apple sign-in button: OS artwork mandated; Google matches Apple's geometry, not the Pill.
- admin: out of scope.
