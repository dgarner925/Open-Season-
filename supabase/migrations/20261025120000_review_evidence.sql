-- 20261025120000_review_evidence.sql
-- Evidence and validation on queued extractions.
--
-- review_queue already carried `confidence`; it was never populated. These two
-- columns are what make a proposal checkable at a glance: the page and the
-- short verbatim quote the model read it from, and anything our own validator
-- found wrong with the row. Nothing here changes what publishes — every
-- proposal still waits for an admin.

alter table public.review_queue
  add column if not exists evidence jsonb,            -- {page, quote} from the source document
  add column if not exists validation_errors text[];  -- our checks, not the model's opinion

-- Worst-first is the useful order for a human working the queue.
create index if not exists review_queue_confidence_idx
  on public.review_queue (status, confidence nulls last, created_at desc);
