-- Ohio waterfowl: retire two stale row families that the 2026-11-02 gap-fill
-- superseded. Verified against the agency's own chart, 2026-11-02:
-- dam.assets.ohio.gov/.../wildlife/news/2026-27_Hunting_Seasons.pdf
--
-- 1. duck "Segment 1" x Zone A/B/C came from 2026-27_Proposed_Hunting_Seasons
--    _Chart_1.pdf back in July, before we ranked proposed charts below final
--    ones. Its dates happen to match the final chart, and it is an exact
--    duplicate of "First Split" x Duck Zone A/B/C, which carries the real
--    source. Two copies of one season on a follower's screen.
--
-- 2. goose "Regular Season" x Goose Zone A / Goose Zones B & C is worse than a
--    duplicate: it is a SPAN, Oct 17 -> Feb 1, where the agency publishes two
--    splits with a closure between them. Today (Nov 2) Goose Zone A is closed
--    -- the first split ended Nov 1 and the second opens Nov 14 -- and that row
--    says "open". A span row that hides a closure is the one error this app
--    must never make.
--
-- Archived, not deleted: the row keeps its id, so anything pointing at it still
-- resolves and the history of what we once published stays readable.

do $$
declare
  oh uuid;
  duck uuid;
  goose uuid;
  n_dupes int;
  n_spans int;
  n_replacement int;
begin
  select id into oh from public.states where code = 'OH';
  select id into duck from public.species where key = 'duck';
  select id into goose from public.species where key = 'goose';
  if oh is null or duck is null or goose is null then
    raise exception 'Ohio waterfowl dedupe: missing state or species reference';
  end if;

  -- Never retire a row until the row that replaces it is actually present and
  -- published. Six split rows: three duck zones, three goose zones.
  select count(*) into n_replacement
  from public.seasons s
  join public.zones z on z.id = s.zone_id
  where s.state_id = oh
    and s.species_id in (duck, goose)
    and s.season_year = 2026
    and s.status = 'published'
    and s.label in ('First Split', 'Second Split');
  if n_replacement < 12 then
    raise exception
      'Ohio waterfowl dedupe: expected 12 split rows to be in place, found %. Refusing to archive.',
      n_replacement;
  end if;

  -- 1. the proposed-chart duck duplicates
  update public.seasons s
     set status = 'archived',
         notes = concat_ws(' ', nullif(s.notes, ''),
           '[Archived 2026-11-02: duplicate of "First Split" x Duck Zone A/B/C, which cites the final season chart. This row came from the proposed chart.]')
   where s.state_id = oh
     and s.species_id = duck
     and s.season_year = 2026
     and s.label = 'Segment 1'
     and s.status = 'published';
  get diagnostics n_dupes = row_count;

  -- 2. the goose span rows that hide the mid-season closure
  update public.seasons s
     set status = 'archived',
         notes = concat_ws(' ', nullif(s.notes, ''),
           '[Archived 2026-11-02: a single Oct 17 - Feb span hid the closure between the two splits. Superseded by "First Split" and "Second Split" per zone.]')
   where s.state_id = oh
     and s.species_id = goose
     and s.season_year = 2026
     and s.label = 'Regular Season'
     and s.status = 'published';
  get diagnostics n_spans = row_count;

  raise notice 'Ohio waterfowl dedupe: archived % duck duplicate(s), % goose span row(s)', n_dupes, n_spans;

  if n_dupes <> 3 or n_spans <> 2 then
    raise exception
      'Ohio waterfowl dedupe: expected 3 duck duplicates and 2 goose spans, archived % and %. Rolling back.',
      n_dupes, n_spans;
  end if;
end $$;

-- The Early Teal row's dates match the final chart, but it still cites the
-- proposed one. Point it at the source we actually verified.
update public.seasons s
   set source_id = (
         select id from public.sources
          where url = 'https://dam.assets.ohio.gov/image/upload/ohiodnr.gov/documents/wildlife/news/2026-27_Hunting_Seasons.pdf'
          order by created_at desc limit 1),
       last_verified_at = now()
 where s.state_id = (select id from public.states where code = 'OH')
   and s.species_id = (select id from public.species where key = 'duck')
   and s.label = 'Early Teal'
   and s.season_year = 2026;
