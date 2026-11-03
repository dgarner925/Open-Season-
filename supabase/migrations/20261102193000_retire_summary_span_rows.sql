-- Retire season rows that are the agency's SUMMARY of its own splits.
--
-- Found by sweeping all 2,298 published seasons after the Ohio goose case
-- (2026-11-02). The pattern: an agency prints a headline window -- "Goose
-- (3 splits)", "Dove (three splits)", "Two Segments", "Split Season" -- above
-- the detail rows, and the extractor captured both. The headline is not a
-- season. The splits are the season. All the headline adds is the days the
-- season is SHUT, and on those days the app says OPEN.
--
-- Four of these are lying today, 2026-11-02: MD duck in both zones, OH goose
-- Zone A, VA duck statewide. Every one is waterfowl in the middle of a split.
--
-- The test, re-derived here at apply time rather than trusted from the sweep:
-- inside one (state, species, season_year, method) group and the SAME zone, a
-- container whose earliest child opens on its open date and whose latest child
-- closes on its close date is a summary of those children. Tiling BOTH ends is
-- what makes it safe -- Virginia's falconry duck season runs Nov 18 - Feb 7
-- over the same gun segments and does NOT end where they end, so it fails the
-- test and is left alone, which is correct: DWR publishes it as its own season.
--
-- Verified against the agencies before writing: ODNR's 2026-27 season chart,
-- Maryland DNR's migratory bird seasons (Eastern Oct 10-17 / Nov 14-27 /
-- Dec 15-Jan 30; Western Oct 3-17 / Nov 21-27 / Dec 15-Jan 30) and Virginia
-- DWR's migratory game bird page (Oct 9-12 / Nov 18-29 / Dec 19-Jan 31).
--
-- Archived, not deleted, so the ids still resolve and the history stays readable.

do $$
declare
  ids uuid[] := array[
    'a8e778c0-934d-4e7a-bf95-9a16b1c43892',  -- MD duck  "Duck"               x Western Zone
    'b45287ee-dbb4-4bac-8a69-7e4345cb77aa',  -- MD duck  "Duck"               x Eastern Zone
    'a4487466-b03b-4f86-97c5-b0d90f802c8e',  -- OH goose "Regular Season"     x Goose Zone A
    'f929d1b0-13c4-4555-8405-750200e074d4',  -- VA duck  "Regular Season"     x Statewide
    '333cb0fe-a214-42c7-83a4-463740e3b918',  -- IA goose "Goose (3 splits)"   x North Zone
    'd7e01337-14b5-4eb4-8013-2907210e7e0c',  -- IA goose "Goose (3 splits)"   x Central Zone
    'fed337a3-03a7-4633-9718-b144ecbca6e3',  -- IA goose "Goose (3 splits)"   x South Zone
    'cfb129fa-60fe-4806-8586-cda0540a1842',  -- MD dove  "Dove (three splits)" x Statewide
    '5ddec34a-ed4a-4454-a0c0-c09c8503ac56',  -- MD woodcock                   x Statewide
    '84f4fc09-9623-4a18-af87-162f73381598',  -- OH dove  "Two Segments"       x Statewide
    '6462a549-82cc-4b28-906f-1132d0e9fbe4',  -- OH snipe "Two Segments"       x Statewide
    '12eca345-dfc9-4733-892c-b8b926ce6027',  -- VA snipe "Split Season"       x Statewide
    'ac64fe33-b4d8-47a6-bec6-f8bb595197ca'   -- VA woodcock "Split Season"    x Statewide
  ];
  rid uuid;
  c public.seasons%rowtype;
  kids int;
  kid_min date;
  kid_max date;
  n_archived int := 0;
  n_skipped int := 0;
begin
  foreach rid in array ids loop
    select * into c from public.seasons where id = rid;
    if not found then
      raise exception 'summary-span retire: row % no longer exists; refusing to guess', rid;
    end if;

    -- Already handled (the Ohio migration archives its goose row by label).
    if c.status <> 'published' then
      n_skipped := n_skipped + 1;
      continue;
    end if;

    select count(*), min(s.open_date), max(s.close_date)
      into kids, kid_min, kid_max
      from public.seasons s
     where s.id <> c.id
       and s.state_id = c.state_id
       and s.species_id = c.species_id
       and s.season_year = c.season_year
       and s.method = c.method
       and s.zone_id is not distinct from c.zone_id
       and s.status = 'published'
       and s.open_date >= c.open_date
       and s.close_date <= c.close_date
       and (s.close_date - s.open_date) < (c.close_date - c.open_date);

    if kids < 2 or kid_min is distinct from c.open_date or kid_max is distinct from c.close_date then
      raise exception
        'summary-span retire: % no longer tiles its splits (% children, %..% vs %..%). Refusing to archive.',
        rid, kids, kid_min, kid_max, c.open_date, c.close_date;
    end if;

    update public.seasons
       set status = 'archived',
           notes = concat_ws(' ', nullif(notes, ''),
             '[Archived 2026-11-02: the agency''s summary line over its own splits, not a season. It reported OPEN on the days between segments. The split rows in this zone carry the real dates.]')
     where id = rid;
    n_archived := n_archived + 1;
  end loop;

  raise notice 'summary-span retire: archived %, already handled %', n_archived, n_skipped;

  if n_archived + n_skipped <> 13 then
    raise exception 'summary-span retire: expected 13 rows, handled %', n_archived + n_skipped;
  end if;
end $$;
