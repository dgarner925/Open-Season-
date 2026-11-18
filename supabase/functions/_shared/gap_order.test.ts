import { describe, expect, it } from 'vitest';
import { orderGapSources, worstPriorityBySource } from './gap_order';

const flat = (ids: string[], prio = 100) => new Map(ids.map((id) => [id, prio]));

describe('orderGapSources', () => {
  it('rotates instead of re-reading the same sources every night', () => {
    // The bug this exists for. Every source at the same priority, nothing read
    // yet. Night one takes three; those three get stamped; night two must take
    // the OTHER three, or the sweep skips the same pages on the content hash
    // for ever and no gap is ever filled.
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    let rows = ids.map((id) => ({ id, last_extracted_at: null as string | null }));
    const prio = flat(ids);

    const night1 = orderGapSources(rows, prio, 3).map((s) => s.id);
    rows = rows.map((s) =>
      night1.includes(s.id) ? { ...s, last_extracted_at: '2026-11-19T04:00:00Z' } : s
    );
    const night2 = orderGapSources(rows, prio, 3).map((s) => s.id);
    rows = rows.map((s) =>
      night2.includes(s.id) ? { ...s, last_extracted_at: '2026-11-20T04:00:00Z' } : s
    );
    const night3 = orderGapSources(rows, prio, 3).map((s) => s.id);

    expect(night2).not.toEqual(night1);
    expect(night1.some((id) => night2.includes(id))).toBe(false);
    // Three nights at three a night walks all six and comes back round.
    expect([...night1, ...night2].sort()).toEqual(ids);
    expect(night3).toEqual(night1);
  });

  it('still puts the worst gap first, however recently it was read', () => {
    const sources = [
      { id: 'stale-but-ordinary', last_extracted_at: null },
      { id: 'urgent-and-fresh', last_extracted_at: '2026-11-18T04:00:00Z' },
    ];
    const prio = new Map([['urgent-and-fresh', 105], ['stale-but-ordinary', 100]]);
    expect(orderGapSources(sources, prio, 2).map((s) => s.id))
      .toEqual(['urgent-and-fresh', 'stale-but-ordinary']);
  });

  it('treats a never-read source as the stalest there is', () => {
    const sources = [
      { id: 'read-today', last_extracted_at: '2026-11-18T04:00:00Z' },
      { id: 'never-read', last_extracted_at: null },
      { id: 'read-last-month', last_extracted_at: '2026-10-18T04:00:00Z' },
    ];
    expect(orderGapSources(sources, flat(['read-today', 'never-read', 'read-last-month']), 3)
      .map((s) => s.id)).toEqual(['never-read', 'read-last-month', 'read-today']);
  });

  it('is deterministic when priority and staleness both tie', () => {
    const sources = [
      { id: 'b', last_extracted_at: null },
      { id: 'a', last_extracted_at: null },
    ];
    const prio = flat(['a', 'b']);
    expect(orderGapSources(sources, prio, 2).map((s) => s.id)).toEqual(['a', 'b']);
    expect(orderGapSources(sources.slice().reverse(), prio, 2).map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('clamps the batch size the way the endpoint promises', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `s${String(i).padStart(2, '0')}`);
    const sources = ids.map((id) => ({ id, last_extracted_at: null }));
    const prio = flat(ids);
    expect(orderGapSources(sources, prio, 0)).toHaveLength(1);
    expect(orderGapSources(sources, prio, -5)).toHaveLength(1);
    expect(orderGapSources(sources, prio, 8)).toHaveLength(8);
    expect(orderGapSources(sources, prio, 999)).toHaveLength(25);
  });

  it('does not mutate the array it was given', () => {
    const sources = [
      { id: 'z', last_extracted_at: '2026-11-18T04:00:00Z' },
      { id: 'a', last_extracted_at: null },
    ];
    orderGapSources(sources, flat(['a', 'z']), 2);
    expect(sources.map((s) => s.id)).toEqual(['z', 'a']);
  });

  it('ranks a source with no priority row last rather than crashing', () => {
    const sources = [{ id: 'unknown', last_extracted_at: null }, { id: 'known', last_extracted_at: null }];
    expect(orderGapSources(sources, new Map([['known', 100]]), 2).map((s) => s.id))
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
