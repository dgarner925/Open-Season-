-- Merge 19 duplicate `sources` rows into 17, and stop it happening again.
--
-- Seventeen URLs were registered more than once -- Tennessee three times,
-- Utah's Big Game Application guidebook three times, a dozen others twice.
-- Harmless while nothing read them in particular. Not harmless now: the draw
-- sweep added 2026-11-20 reads five pages a night, and three of those five
-- slots would go to re-reading the same 3.1 MB Utah guidebook, the single most
-- important draw document that state publishes.
--
-- Why this is a merge and not a delete. Seven of the eight foreign keys into
-- `sources` are ON DELETE SET NULL, so a plain delete would not error -- it
-- would quietly blank `source_id` on 156 published seasons, 12 coverage gaps,
-- 4 review-queue items and 1 regulation summary. That column is the answer to
-- "which page did this come from", which is the whole evidence chain behind a
-- published date. Losing it silently is worse than the duplication.
--
-- The keeper is the most recently extracted row of each group, so the surviving
-- row carries the freshest `last_extracted_at` and the sweep does not re-read
-- it immediately. Ties break on id, so the choice is deterministic rather than
-- merely stable.
--
-- Idempotent: once merged there are no groups with rn > 1, so a re-run matches
-- nothing and changes nothing.

create temporary table dup_merge on commit drop as
with ranked as (
  select id, url,
         row_number() over (
           partition by url
           order by last_extracted_at desc nulls last, id
         ) as rn
    from public.sources
),
keeper as (
  select url, id from ranked where rn = 1
)
select r.id as loser, k.id as keeper
  from ranked r
  join keeper k on k.url = r.url
 where r.rn > 1;

-- Repoint every reference before anything is removed. license_fees is the one
-- NO ACTION key, so a missed row there would abort the delete rather than fail
-- quietly -- it is repointed too, for the day it stops being empty.
update public.seasons              t set source_id = m.keeper from dup_merge m where t.source_id = m.loser;
update public.application_windows  t set source_id = m.keeper from dup_merge m where t.source_id = m.loser;
update public.regulation_summaries t set source_id = m.keeper from dup_merge m where t.source_id = m.loser;
update public.review_queue         t set source_id = m.keeper from dup_merge m where t.source_id = m.loser;
update public.coverage_gaps        t set source_id = m.keeper from dup_merge m where t.source_id = m.loser;
update public.source_fetch_log     t set source_id = m.keeper from dup_merge m where t.source_id = m.loser;
update public.leftover_tag_sales   t set source_id = m.keeper from dup_merge m where t.source_id = m.loser;
update public.license_fees         t set source_id = m.keeper from dup_merge m where t.source_id = m.loser;

-- A keeper inherits the flag if any row in its group carried it, so merging
-- can never quietly unflag a draw page.
update public.sources s
   set carries_draws = true, updated_at = now()
  from dup_merge m
 where s.id = m.keeper
   and not s.carries_draws
   and exists (select 1 from public.sources l where l.id = m.loser and l.carries_draws);

delete from public.sources where id in (select loser from dup_merge);

-- The actual fix. Without this the next seed or hand-written insert puts the
-- duplicates straight back. Safe as a plain unique index on url: no URL in this
-- table belongs to two different states, so nothing legitimate needs a second
-- row for the same page.
create unique index if not exists sources_url_key on public.sources (url);
