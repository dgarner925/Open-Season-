-- ⚠️ FLIP-DAY MIGRATION — DO NOT RUN BEFORE THE PRICE GOES TO $0. ⚠️
--
-- Lives OUTSIDE supabase/migrations on purpose so a routine `db push` can
-- never apply it early. On flip day (1.3.0 released + store price set to $0),
-- move it into supabase/migrations with a fresh timestamp and push — or paste
-- it straight into the dashboard SQL editor.
--
-- What it does: stops auto-grandfathering new signups. Everyone who signed up
-- BEFORE this runs keeps is_premium/grandfathered = true (they paid $4.99).
-- Everyone after starts free and upgrades through the paywall.
--
-- Order of operations on flip day:
--   1. 1.3.0 approved → release it.
--   2. ASC → Pricing → change app price to $0 (Free).
--   3. Run this within minutes of step 2.
--   4. Update the marketing site (UPLOAD-TO-WEBSITE/).
-- The few minutes between 2 and 3 can hand a stray new signup free premium —
-- acceptable; never run this BEFORE step 2 (it would charge paid downloaders
-- for what they already bought).

alter table public.profiles alter column is_premium set default false;
alter table public.profiles alter column grandfathered set default false;
