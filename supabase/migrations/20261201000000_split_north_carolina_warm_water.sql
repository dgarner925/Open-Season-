-- Split North Carolina's warm-water page into two sources.
--
-- ===========================================================================
-- WHY A PAGE NEEDS SPLITTING AT ALL
--
-- The page is ONE table of 106 rows: a species, then a row per water that
-- departs from the statewide limit. Every other Southeast page read at most
-- 119 rows across its whole document, and Mississippi spent 138 seconds of a
-- 150-second budget doing it.
--
-- NC killed the worker three times -- truncated at max_tokens 16000, then
-- WORKER_RESOURCE_LIMIT twice at 32000. There is no ai_usage row for either
-- resource-limit attempt, and logUsage runs immediately after res.json(), so
-- the worker died BEFORE the response was parsed. That rules out the grounding
-- loop, the parse and the proposal writes.
--
-- The cause is still not proven. What is known is the page is an outlier in
-- row count and the runs that survive sit on the time budget. Splitting is the
-- fix the extractor's own truncation error already recommends, and it is
-- cheaper than another round of guessing.
--
-- ===========================================================================
-- HOW, GIVEN THERE IS ONLY ONE URL
--
-- The page has exactly two headings (one H1, one H2) and one table, so there
-- is nothing to cut on structurally and no second URL to point at.
--
--   sources.slice_from / slice_to  name where a source's share of the page
--                                  starts and ends, as literal strings in the
--                                  HTML. The extractor cuts the markup before
--                                  deriving text and blocks, so the model and
--                                  the grounding see the same half.
--
--   the URL fragment               makes the two rows distinct for the unique
--                                  index on sources.url. A fragment is never
--                                  sent to a server, so both still fetch the
--                                  same page.
--
-- sliceHtml THROWS when a marker is missing rather than falling back to the
-- whole page. A silent fallback would have both sources read everything and
-- propose every row twice, with nothing saying so -- the exact defect class
-- that cost three debugging rounds today.
--
-- Markers verified against the RAW HTML on 2026-11-21, each appearing exactly
-- once. Note the capital "And" in the striped bass marker: the rendered page
-- title-cases it, the markup does not, and matching the rendered form would
-- throw on every run.
--
-- ===========================================================================
-- WHERE THE SEAM FALLS, AND WHY IT IS NOT ARBITRARY
--
--   part 1  Largemouth -> Smallmouth -> Alabama/Spotted -> Bartram's ->
--           Crappie -> Sunfish.                        ~44 rows, ALL freshwater.
--
--   part 2  Striped Bass And Bodie Bass (inland impoundments AND coastal
--           rivers) -> Rock Bass -> White Bass -> White Perch -> Shad ->
--           Walleye -> Muskellunge -> Sauger -> Kokanee -> Bullheads ->
--           FLOUNDER -> RED DRUM -> SPOTTED SEATROUT -> Yellow Perch ->
--           Pickerel -> All Other.                     ~62 rows.
--
-- Every marine species on the page is in part 2. So the mixed-page test --
-- the one that has never run -- concentrates there instead of being diluted
-- across 106 rows. Part 2 must propose Lake Gaston, Kerr and Roanoke Rapids
-- while proposing NO flounder, red drum or spotted seatrout.
--
-- The existing row is UPDATED into part 1 rather than deleted, so its id
-- survives and nothing referencing it is orphaned. It has no proposals to
-- lose: it never completed a run.

alter table public.sources
  add column if not exists slice_from text,
  add column if not exists slice_to   text;

comment on column public.sources.slice_from is
  'Literal string in the page HTML where this source''s share begins. Null reads from the top. The extractor throws if it is absent rather than silently reading the whole page.';
comment on column public.sources.slice_to is
  'Literal string in the page HTML where this source''s share ends (exclusive). Null reads to the bottom.';

-- part 1: the freshwater species, from the first row to the striped bass block
update public.sources
   set url        = 'https://www.eregulations.com/northcarolina/fishing/warm-water-game-fish-regulations#part-1-freshwater-species',
       slice_from = 'Largemouth Bass',
       slice_to   = 'Striped Bass And Bodie Bass',
       notes      = 'Part 1 of 2. Largemouth, smallmouth, Alabama/spotted, Bartram''s, '
                    'crappie and sunfish, with their per-water exceptions '
                    '(Santeetlah, Chatuge, Kerr, Mattamuskeet and others). '
                    'Wholly freshwater. Split because the undivided 106-row '
                    'table killed the worker three times.'
 where url = 'https://www.eregulations.com/northcarolina/fishing/warm-water-game-fish-regulations';

-- part 2: striped bass onward, which is where every marine species sits
insert into sources (state_id, agency_name, url, doc_type, purpose, notes, slice_from, slice_to)
select st.id,
       'North Carolina Wildlife Resources Commission',
       'https://www.eregulations.com/northcarolina/fishing/warm-water-game-fish-regulations#part-2-striped-bass-onward',
       'webpage', 'fishing_rules',
       'Part 2 of 2. Striped bass (inland impoundments AND coastal rivers), '
       'rock bass, white bass, white perch, shad, walleye, muskellunge, '
       'sauger, kokanee, bullheads, yellow perch, pickerel. '
       'MIXED: this half also carries flounder, red drum and spotted '
       'seatrout under "all inland fishing waters and joint fishing waters". '
       'Those three must NOT be proposed; Lake Gaston, John H. Kerr and '
       'Roanoke Rapids must be.',
       'Striped Bass And Bodie Bass',
       null
  from states st
 where st.code = 'NC'
on conflict (url) do update set
  purpose    = excluded.purpose,
  notes      = excluded.notes,
  slice_from = excluded.slice_from,
  slice_to   = excluded.slice_to;
