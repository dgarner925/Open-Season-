-- review_queue: let leftover_tag_sales through the gate
--
-- 20261109120000 taught apply_review_item how to publish a leftover tag sale
-- but left review_target_table_allowed listing the three older tables. Every
-- proposal the ingest function made was rejected by the CHECK, and because the
-- insert's error went unread the run cheerfully reported nine rows queued while
-- the queue held none.
--
-- The constraint is doing its job: it is the reason an unmigrated table cannot
-- have rows proposed into it. It just needed the new name.

alter table public.review_queue
  drop constraint if exists review_target_table_allowed;

alter table public.review_queue
  add constraint review_target_table_allowed
  check (target_table in (
    'seasons',
    'application_windows',
    'regulation_summaries',
    'leftover_tag_sales'
  ));
