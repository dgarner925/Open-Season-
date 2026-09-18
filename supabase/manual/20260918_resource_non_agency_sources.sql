-- Re-source the two non-agency source rows (2026-09-18).
-- Found during Google Play Misleading Claims round 5: the sources table
-- cited an outdoor-industry press wire (Nebraska) and Cornell's legal
-- mirror (Washington). Both replacements verified live and content-
-- identical on the official sites before writing this file:
--
--   NE: the outdoorwire URL was a syndicated copy of NGPC's own press
--       release; the official original carries the same June 1-12 window.
--   WA: WAC 220-416-010 on the state legislature's own site; spot-checked
--       bobcat/raccoon/fox (Sep 1 - Mar 15), crow (Sep 1 - Dec 31), forest
--       grouse (Sep 15 - Jan 15), coyote (year-round) - all match our rows.
--
-- Ohio's dam.assets.ohio.gov PDFs were checked too and deliberately LEFT
-- ALONE: the deep links still return 200 (only the bare domain redirects
-- to cloudinary), they are ohio.gov infrastructure, and the extraction
-- pipeline reads those exact PDFs.
--
-- Run in the Supabase SQL editor (OpenSeason project). David runs this.

update public.sources
set url = 'https://outdoornebraska.gov/about/press-events/news/big-game-draw-permit-applications-taken-june-1-12/'
where id = 'a957ddb2-87e9-4ac7-88f0-9734ecaf3df3'
  and url like '%theoutdoorwire.com%';

update public.sources
set url = 'https://app.leg.wa.gov/WAC/default.aspx?cite=220-416-010'
where id = '460fa538-945c-4b10-81b1-292089f03e2a'
  and url like '%law.cornell.edu%';

-- Verify: expect zero rows.
select id, url from public.sources
where url ilike '%theoutdoorwire%' or url ilike '%law.cornell%';
