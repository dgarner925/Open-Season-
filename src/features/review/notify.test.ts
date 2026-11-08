import { describe, expect, it } from 'vitest';
import { notifyCount, notifySentence, notifyingFields, wouldNotify } from './notify';
import type { ReviewQueueRow } from '@/lib/database.types';

/** A review_queue row, shaped only as far as these functions read it. */
function review(over: Partial<ReviewQueueRow> = {}): ReviewQueueRow {
  return {
    change_type: 'update',
    target_table: 'seasons',
    current_snapshot: { status: 'published', open_date: '2026-11-19', close_date: null },
    proposed_payload: { open_date: '2026-11-13', close_date: null },
    ...over,
  } as ReviewQueueRow;
}

describe('notifyingFields', () => {
  it('announces a published opener that moved', () => {
    expect(notifyingFields(review())).toEqual(['open_date']);
    expect(wouldNotify(review())).toBe(true);
  });

  it('says nothing about a create — a new row logs nothing', () => {
    expect(notifyingFields(review({ change_type: 'create' }))).toEqual([]);
  });

  it('says nothing about a draft: a draft is not yet a promise', () => {
    const r = review({
      current_snapshot: { status: 'draft', open_date: '2026-11-19', close_date: null },
    });
    expect(notifyingFields(r)).toEqual([]);
  });

  it('says nothing about a backfill (null to a date)', () => {
    const r = review({
      current_snapshot: { status: 'published', open_date: null, close_date: null },
      proposed_payload: { open_date: '2026-11-13', close_date: null },
    });
    expect(notifyingFields(r)).toEqual([]);
  });

  it('says nothing about a retraction (a date to null)', () => {
    // This is the real 2026-11-08 application_windows row: 2026-05-31 -> null.
    // The watchdog ignores it by design, so the count must too.
    const r = review({
      target_table: 'application_windows',
      current_snapshot: { status: 'published', closes_at: '2026-05-31' },
      proposed_payload: { closes_at: null },
    });
    expect(notifyingFields(r)).toEqual([]);
  });

  it('says nothing when the date is unchanged', () => {
    const r = review({
      current_snapshot: { status: 'published', open_date: '2026-11-19', close_date: null },
      proposed_payload: { open_date: '2026-11-19', close_date: null },
    });
    expect(notifyingFields(r)).toEqual([]);
  });

  it('counts both fields when open and close both move', () => {
    const r = review({
      current_snapshot: { status: 'published', open_date: '2026-11-19', close_date: '2026-12-01' },
      proposed_payload: { open_date: '2026-11-13', close_date: '2026-12-05' },
    });
    expect(notifyingFields(r)).toEqual(['open_date', 'close_date']);
  });

  it('watches the right fields on application_windows', () => {
    const r = review({
      target_table: 'application_windows',
      current_snapshot: {
        status: 'published',
        closes_at: '2027-05-31',
        results_expected_at: '2027-06-15',
      },
      proposed_payload: { closes_at: '2027-06-07', results_expected_at: '2027-06-15' },
    });
    expect(notifyingFields(r)).toEqual(['closes_at']);
  });

  it('ignores a table the watchdog does not watch', () => {
    const r = review({
      target_table: 'regulation_summaries',
      current_snapshot: { status: 'published', open_date: '2026-11-19' },
      proposed_payload: { open_date: '2026-11-13' },
    });
    expect(notifyingFields(r)).toEqual([]);
  });

  it('survives a missing or malformed snapshot rather than guessing', () => {
    expect(notifyingFields(review({ current_snapshot: null }))).toEqual([]);
    expect(notifyingFields(review({ proposed_payload: null }))).toEqual([]);
    expect(notifyingFields(review({ current_snapshot: 'nope' as never }))).toEqual([]);
    expect(notifyingFields(review({ current_snapshot: [] as never }))).toEqual([]);
  });
});

describe('notifyCount', () => {
  it('is zero for an empty sweep', () => {
    expect(notifyCount([])).toBe(0);
  });

  it('reproduces the real 2026-11-02 sweep: 3 moves among many creates', () => {
    const creates = Array.from({ length: 191 }, () => review({ change_type: 'create' }));
    const moves = [
      review({
        current_snapshot: { status: 'published', open_date: '2026-11-19', close_date: null },
        proposed_payload: { open_date: '2026-11-13', close_date: null },
      }),
      review({
        current_snapshot: { status: 'published', open_date: '2026-12-21', close_date: null },
        proposed_payload: { open_date: '2026-12-18', close_date: null },
      }),
      review({
        current_snapshot: { status: 'published', open_date: '2026-09-15', close_date: null },
        proposed_payload: { open_date: '2026-09-19', close_date: null },
      }),
    ];
    expect(notifyCount([...creates, ...moves])).toBe(3);
  });
});

describe('notifySentence', () => {
  it('reassures plainly when nothing would be sent', () => {
    expect(notifySentence(0)).toMatch(/no alerts go out/);
  });

  it('does not say "1 of these"', () => {
    expect(notifySentence(1)).toMatch(/^One of these/);
  });

  it('states the thing before the number', () => {
    expect(notifySentence(3)).toBe(
      '3 of these move a published date. Followers of those hunts will be told.',
    );
  });
});
