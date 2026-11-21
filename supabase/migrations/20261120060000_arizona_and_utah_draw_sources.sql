-- The last two states with no readable draw-deadline source: Arizona and Utah.
--
-- Both were left out of 20261120040000 because neither had a page that an Edge
-- Function could read. Probed again on 2026-11-20, and both now have one.
--
-- ARIZONA. www.azgfd.com returns 403 to any automated fetch -- not just the
-- hunting pages, its homepage too -- so no URL on that host will ever work from
-- extract-source, and azgfd.gov merely redirects there. eRegulations carries
-- only three Arizona sections (bag limits, licences and fees, seasons and
-- dates) and no draw page at all.
--
-- What does answer is the department's own draw portal, draw.azgfd.com, which
-- is not behind the same filter. Today it reads: the application system is
-- closed, the 2027 Spring results are posted, "check back in January for the
-- 2027M Elk/Pronghorn Draw application period". That is the single most useful
-- property it has -- it is a status page, so it changes when the draw cycle
-- changes, and January's deadline will appear on it. 7 KB, so sweeping it every
-- night is nearly free.
--
-- The root is registered rather than /Home/Closed: the root follows to whatever
-- state page is current, so it keeps working when the portal reopens and the
-- closed page goes away.
--
-- Deliberately NOT flagged: the 2026 Pronghorn and Elk regulations PDF on the
-- S3 host. It is fetchable and it does carry "Hunt permit application deadline
-- is Tuesday, Feb ...", but it is last cycle's document -- published December
-- 2025 for a February 2026 deadline -- and its URL is year-stamped. Re-reading
-- it could only ever yield a date the stale-year guard should reject. The 2027
-- edition arrives about December 2026 at a new URL and has to be registered
-- then; that is a known manual step, the same shape as every other year-stamped
-- mirror in this table.
--
-- UTAH. The claim that Utah had no canonical deadline page was wrong: the Big
-- Game Application guidebook was already in `sources` and already being read.
-- It states the application period outright ("the application period is March
-- 19 to April 23, 2026"), as does the waterfowl, upland game and turkey
-- guidebook, which carries a deadline table. Neither URL is year-stamped --
-- /guidebooks/biggameapp.pdf is a stable path the division overwrites each
-- cycle -- which is exactly what a nightly content-hash sweep wants.
--
-- Both are large (3.1 MB, and 6.5 MB over 81 pages) but inside MAX_PDF_BYTES
-- and the model's 100-page limit. The big one will take most of a night's
-- budget; the wall clock in _shared/time_budget.ts stops cleanly and reports
-- `unread_out_of_time` rather than dying mid-read.

insert into public.sources (state_id, agency_name, url, doc_type, purpose, carries_draws, notes)
select s.id, 'Arizona Game and Fish Department',
       'https://draw.azgfd.com/', 'webpage', 'seasons', true,
       'Draw application portal. Added 2026-11-20 because www.azgfd.com 403s every '
       || 'automated fetch, its homepage included, and eRegulations has no Arizona draw '
       || 'page. This host answers, and the root follows to whichever state page is live.'
from public.states s
where s.code = 'AZ'
  and not exists (select 1 from public.sources x where x.url = 'https://draw.azgfd.com/');

update public.sources set carries_draws = true, updated_at = now() where url in (
  'https://wildlife.utah.gov/guidebooks/biggameapp.pdf',
  'https://wildlife.utah.gov/guidebooks/waterfowl-upland-game-turkey-guidebook.pdf'
);
