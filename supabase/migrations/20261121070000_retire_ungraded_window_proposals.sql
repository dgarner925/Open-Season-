-- Retire the 71 draw-deadline proposals that were made before scoring existed.
--
-- Every application_window proposal created up to 2026-11-21 carries
-- confidence NULL, because windowItem never asked the model for one and the
-- extractor never computed one. approve_clean_reviews requires
-- `confidence is not null`, so not one of them could ever auto-approve; they
-- would have sat in the queue until someone tapped each card.
--
-- The extractor now grades a window on whether the fetched page literally
-- contains the date (see 3c8addf). These rows cannot be graded retroactively
-- without re-running that logic a second way in a second language, and two
-- implementations of an accuracy gate is how the two quietly disagree. So the
-- ungraded proposals step aside and the seven source pages behind them are
-- re-read through the one code path that now exists.
--
-- Rejected, not deleted. pendingExists() only looks at status='pending', so a
-- rejected row no longer blocks the fresh proposal, and keeping it leaves the
-- audit trail of what the old path produced -- which is worth having, because
-- comparing the two is the only direct measure of whether grounding changed
-- any answer.
--
-- Nothing published is touched: these are proposals, and the 335 windows
-- already approved are not in scope.

update public.review_queue
   set status = 'rejected',
       review_notes = 'Retired 2026-11-21: created before draw deadlines were '
                   || 'scored, so confidence was NULL and it could never '
                   || 'auto-approve. The source page is being re-read through '
                   || 'the grounded path.',
       reviewed_at = now(),
       updated_at = now()
 where status = 'pending'
   and target_table = 'application_windows'
   and confidence is null;
