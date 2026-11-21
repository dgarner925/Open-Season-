-- Open the launch gate on fishing species.
--
-- NOT YET APPLIED. Written for David to read first.
--
-- ---------------------------------------------------------------------------
-- WHAT THE GATE ACTUALLY IS
--
-- When the fishing tables shipped (20261122000000) the intent was that no
-- fishing data could leak before launch. In practice only ONE of the five
-- tables is gated:
--
--   waters                 public read where status = 'published'     OPEN
--   fishing_rules          public read where status = 'published'     OPEN
--   fishing_rule_species   public read via the published rule         OPEN
--   stockings              public read, unconditional                 OPEN
--   state_species          public read, unconditional                 OPEN
--   species                public read WHERE pursuit = 'hunting'      CLOSED
--
-- So Georgia's 29 waters and 33 published rules are already readable by
-- anyone holding the anon key, which is shipped in the app. What the gate
-- hides is the fish NAMES. The practical effect is not secrecy; it is that a
-- rule reads as "15/day combined" about nothing.
--
-- This matters for the decision: applying this does not newly expose the
-- regulations. It exposes a list of 71 fish names.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS SAFE FOR THE HUNTING APP
--
-- Nothing in the hunting client asks for "all species" and takes what it
-- gets. src/features/reference/queries.ts filters `pursuit = 'hunting'`
-- explicitly, with a comment saying why:
--
--   "RLS already hides the other pursuit's species, but a query that relies
--    on a policy to mean the right thing breaks silently the day the policy
--    is relaxed -- which is exactly what launching fishing does."
--
-- That is the day. Verify before applying:
--
--   rg -n "from\('species'\)" src/ app/ supabase/
--
-- Every hit should carry its own .eq('pursuit', ...). If one does not, fix
-- the query first; do not narrow this policy to compensate.
--
-- ---------------------------------------------------------------------------
-- TO UNDO
--
--   alter policy species_public_read on public.species
--     using (pursuit = 'hunting');
--
-- Reverting re-hides the names. It does NOT re-hide the waters or the rules,
-- because those were never hidden.

alter policy species_public_read on public.species
  using (true);

comment on policy species_public_read on public.species is
  'Both pursuits are readable. Clients must filter by pursuit themselves: '
  'see src/features/reference/queries.ts. This policy stopped being the '
  'fishing launch gate on 2026-11-23.';
