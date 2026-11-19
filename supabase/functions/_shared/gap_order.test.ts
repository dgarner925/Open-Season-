import { describe, expect, it } from 'vitest';
import { orderGapSources, RECENTLY_READ_MS, worstPriorityBySource } from './gap_order';

const flat = (ids: string[], prio = 100) => new Map(ids.map((id) => [id, prio]));

// Every test pins the clock. The cooldown is relative to "now", and a test
// that reads the real clock passes or fails depending on the day it runs.
const NOW = Date.parse('2026-11-19T04:00:00Z');
const DAY = 86_400_000;
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

describe('orderGapSources', () => {
  it('rotates instead of re-reading the same sources every night', () => {
    // The bug this exists for. Every source at the same priority, nothing read
    // yet. Night one takes three; those three get stamped; night two must take
    // the OTHER three, or the sweep skips the same pages on the content hash
    // for ever and no gap is ever filled.
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    let rows = ids.map((id) => ({ id, last_extracted_at: null as string | null }));
    const prio = flat(ids);

    const night1 = orderGapSources(rows, prio, 3, NOW).map((s) => s.id);
    rows = rows.map((s) =>
      night1.includes(s.id) ? { ...s, last_extracted_at: new Date(NOW).toISOString() } : s
    );
    const night2 = orderGapSources(rows, prio, 3, NOW + DAY).map((s) => s.id);
    rows = rows.map((s) =>
      night2.includes(s.id) ? { ...s, last_extracted_at: new Date(NOW + DAY).toISOString() } : s
    );
    const night3 = orderGapSources(rows, prio, 3, NOW + 2 * DAY).map((s) => s.id);

    expect(night2).not.toEqual(night1);
    expect(night1.some((id) => night2.includes(id))).toBe(false);
    // Three nights at three a night walks all six and comes back round.
    expect([...night1, ...night2].sort()).toEqual(ids);
    expect(night3).toEqual(night1);
  });

  it('puts the worst gap first among sources it has not just read', () => {
    const sources = [
      { id: 'stale-but-ordinary', last_extracted_at: null },
      { id: 'urgent-read-days-ago', last_extracted_at: hoursAgo(72) },
    ];
    const prio = new Map([['urgent-read-days-ago', 105], ['stale-but-ordinary', 100]]);
    expect(orderGapSources(sources, prio, 2, NOW).map((s) => s.id))
      .toEqual(['urgent-read-days-ago', 'stale-but-ordinary']);
  });

  it('sends a source read hours ago to the back, whatever its priority', () => {
    // West Virginia, 2026-11-19. Priority 106 is correct -- a season opens in
    // 44 days and is not published -- and it still took slot one on the run
    // after the one that read it, where the content hash could only skip it.
    // Urgency means this gap matters most, not read this page again today.
    const sources = [
      { id: 'wv-read-last-night', last_extracted_at: hoursAgo(4) },
      { id: 'sc-never-read', last_extracted_at: null },
      { id: 'ar-elk-july', last_extracted_at: hoursAgo(24 * 120) },
    ];
    const prio = new Map([
      ['wv-read-last-night', 106],
      ['sc-never-read', 100],
      ['ar-elk-july', 100],
    ]);
    expect(orderGapSources(sources, prio, 3, NOW).map((s) => s.id))
      .toEqual(['sc-never-read', 'ar-elk-july', 'wv-read-last-night']);
    // And it is not merely demoted out of the top slot: with two slots it does
    // not get read at all.
    expect(orderGapSources(sources, prio, 2, NOW).map((s) => s.id))
      .toEqual(['sc-never-read', 'ar-elk-july']);
  });

  it('demotes rather than excludes, so a second run the same day still works', () => {
    // Everything read today: a manual re-run an hour after the cron. Returning
    // nothing would be a run that does nothing, which is worse than re-reading.
    const sources = [
      { id: 'low', last_extracted_at: hoursAgo(1) },
      { id: 'high', last_extracted_at: hoursAgo(2) },
    ];
    const prio = new Map([['high', 150], ['low', 100]]);
    expect(orderGapSources(sources, prio, 2, NOW).map((s) => s.id)).toEqual(['high', 'low']);
  });

  it('lets a source back in once the cooldown has passed', () => {
    const sources = [
      { id: 'urgent', last_extracted_at: hoursAgo(21) },
      { id: 'ordinary', last_extracted_at: null },
    ];
    const prio = new Map([['urgent', 106], ['ordinary', 100]]);
    // 21 hours is past the 20-hour cooldown, so priority rules again.
    expect(RECENTLY_READ_MS).toBe(20 * 3_600_000);
    expect(orderGapSources(sources, prio, 2, NOW).map((s) => s.id)).toEqual(['urgent', 'ordinary']);
  });

  it('does not treat a future stamp as infinitely stale', () => {
    // A clock skew that stamps tomorrow must not win slot one for ever.
    const sources = [
      { id: 'stamped-tomorrow', last_extracted_at: hoursAgo(-24) },
      { id: 'never-read', last_extracted_at: null },
    ];
    const prio = new Map([['stamped-tomorrow', 106], ['never-read', 100]]);
    expect(orderGapSources(sources, prio, 2, NOW).map((s) => s.id))
      .toEqual(['never-read', 'stamped-tomorrow']);
  });

  it('treats an unparseable stamp as not-recently-read rather than crashing', () => {
    const sources = [
      { id: 'garbage-stamp', last_extracted_at: 'not a date' },
      { id: 'fresh', last_extracted_at: hoursAgo(1) },
    ];
    const prio = flat(['garbage-stamp', 'fresh']);
    expect(orderGapSources(sources, prio, 2, NOW).map((s) => s.id))
      .toEqual(['garbage-stamp', 'fresh']);
  });

  it('treats a never-read source as the stalest there is', () => {
    const sources = [
      { id: 'read-days-ago', last_extracted_at: hoursAgo(48) },
      { id: 'never-read', last_extracted_at: null },
      { id: 'read-last-month', last_extracted_at: hoursAgo(24 * 32) },
    ];
    expect(
      orderGapSources(sources, flat(['read-days-ago', 'never-read', 'read-last-month']), 3, NOW)
        .map((s) => s.id),
    ).toEqual(['never-read', 'read-last-month', 'read-days-ago']);
  });

  it('is deterministic when priority and staleness both tie', () => {
    const sources = [
      { id: 'b', last_extracted_at: null },
      { id: 'a', last_extracted_at: null },
    ];
    const prio = flat(['a', 'b']);
    expect(orderGapSources(sources, prio, 2, NOW).map((s) => s.id)).toEqual(['a', 'b']);
    expect(orderGapSources(sources.slice().reverse(), prio, 2, NOW).map((s) => s.id))
      .toEqual(['a', 'b']);
  });

  it('clamps the batch size the way the endpoint promises', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `s${String(i).padStart(2, '0')}`);
    const sources = ids.map((id) => ({ id, last_extracted_at: null }));
    const prio = flat(ids);
    expect(orderGapSources(sources, prio, 0, NOW)).toHaveLength(1);
    expect(orderGapSources(sources, prio, -5, NOW)).toHaveLength(1);
    expect(orderGapSources(sources, prio, 8, NOW)).toHaveLength(8);
    expect(orderGapSources(sources, prio, 999, NOW)).toHaveLength(25);
  });

  it('does not mutate the array it was given', () => {
    const sources = [
      { id: 'z', last_extracted_at: hoursAgo(48) },
      { id: 'a', last_extracted_at: null },
    ];
    orderGapSources(sources, flat(['a', 'z']), 2, NOW);
    expect(sources.map((s) => s.id)).toEqual(['z', 'a']);
  });

  it('ranks a source with no priority row last rather than crashing', () => {
    const sources = [
      { id: 'unknown', last_extracted_at: null },
      { id: 'known', last_extracted_at: null },
    ];
    expect(orderGapSources(sources, new Map([['known', 100]]), 2, NOW).map((s) => s.id))
      .toEqual(['known', 'unknown']);
  });
});

describe('worstPriorityBySource', () => {
  it('reads a source once, at its worst gap', () => {
    const prio = worstPriorityBySource([
      { source_id: 'a', priority: 100 },
      { source_id: 'a', priority: 105 },
      { source_id: 'a', priority: 1 },
      { source_id: 'b', priority: 100 },
    ]);
    expect(prio.get('a')).toBe(105);
    expect(prio.get('b')).toBe(100);
    expect(prio.size).toBe(2);
  });

  it('skips a gap with no source to read', () => {
    const prio = worstPriorityBySource([
      { source_id: null, priority: 100 },
      { source_id: undefined, priority: 100 },
      { source_id: 'a', priority: 100 },
    ]);
    expect([...prio.keys()]).toEqual(['a']);
  });

  it('treats a missing or unreadable priority as zero, not as NaN', () => {
    const prio = worstPriorityBySource([
      { source_id: 'a', priority: null },
      { source_id: 'b', priority: Number.NaN },
      { source_id: 'b', priority: 7 },
    ]);
    expect(prio.get('a')).toBe(0);
    // NaN must not poison the max -- a real priority has to win.
    expect(prio.get('b')).toBe(7);
  });
});
