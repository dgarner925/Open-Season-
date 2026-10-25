import { describe, expect, it } from 'vitest';
import { checkGrounding } from './grounding';
import {
  composeChangeNote,
  diffSeasonYears,
  identity,
  isNoteworthy,
  spokenDate,
  type SeasonRow,
} from './regdiff';

const base = (over: Partial<SeasonRow> = {}): SeasonRow => ({
  id: 'id-1',
  species_id: 'sp-deer',
  species_name: 'Deer',
  zone_id: 'z-state',
  zone_name: 'Statewide',
  method: 'archery',
  label: 'Archery',
  open_date: '2025-09-13',
  close_date: '2025-10-10',
  bag_limit_summary: '2 bucks',
  notes: null,
  season_year: 2025,
  ...over,
});

describe('identity', () => {
  it('matches the same season across years despite new ids and dates', () => {
    const y1 = base();
    const y2 = base({ id: 'id-2', open_date: '2026-09-12', season_year: 2026 });
    expect(identity(y1)).toBe(identity(y2));
  });

  it('treats a different zone as a different season', () => {
    expect(identity(base())).not.toBe(identity(base({ zone_id: 'z-b', zone_name: 'Zone B' })));
  });
});

describe('diffSeasonYears', () => {
  it('detects a moved opener', () => {
    const changes = diffSeasonYears(
      [base()],
      [base({ id: 'id-2', open_date: '2026-09-12', close_date: '2026-10-09', season_year: 2026 })],
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].change_type).toBe('modified');
    expect(changes[0].field_diffs.map((d) => d.field).sort()).toEqual(['close_date', 'open_date']);
    expect(changes[0].old_id).toBe('id-1');
    expect(changes[0].new_id).toBe('id-2');
  });

  it('detects an added season', () => {
    const changes = diffSeasonYears(
      [base()],
      [
        base({ id: 'a', season_year: 2026 }),
        base({ id: 'b', method: 'muzzleloader', label: 'Muzzleloader', season_year: 2026, open_date: '2026-10-10' }),
      ],
    );
    const added = changes.filter((c) => c.change_type === 'added');
    expect(added).toHaveLength(1);
    expect(added[0].method).toBe('muzzleloader');
    expect(added[0].new_id).toBe('b');
  });

  it('detects a removed season', () => {
    const changes = diffSeasonYears(
      [base({ id: 'old-a' }), base({ id: 'old-b', method: 'firearm', label: 'Early Gun' })],
      [base({ id: 'new-a', season_year: 2026 })],
    );
    const removed = changes.filter((c) => c.change_type === 'removed');
    expect(removed).toHaveLength(1);
    expect(removed[0].label).toBe('Early Gun');
    expect(removed[0].new_id).toBeNull();
  });

  it('detects a bag limit change', () => {
    const changes = diffSeasonYears(
      [base()],
      [base({ id: 'id-2', season_year: 2026, bag_limit_summary: '3 bucks' })],
    );
    expect(changes[0].field_diffs).toEqual([
      { field: 'bag_limit_summary', old: '2 bucks', new: '3 bucks' },
    ]);
  });

  it('reports nothing when the year is identical but for ids', () => {
    expect(diffSeasonYears([base()], [base({ id: 'different' })])).toEqual([]);
  });

  it('keeps multi-window seasons separate instead of collapsing them', () => {
    const splitA = base({ id: 'a', label: 'Segment 1', open_date: '2025-10-17', close_date: '2025-11-01' });
    const splitB = base({ id: 'b', label: 'Segment 2', open_date: '2025-12-05', close_date: '2026-01-10' });
    const changes = diffSeasonYears(
      [splitA, splitB],
      [
        { ...splitA, id: 'a2', season_year: 2026, open_date: '2026-10-16' },
        { ...splitB, id: 'b2', season_year: 2026 },
      ],
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].label).toBe('Segment 1');
  });
});

describe('composeChangeNote', () => {
  it('writes a moved season plainly', () => {
    const [c] = diffSeasonYears(
      [base()],
      [base({ id: 'id-2', open_date: '2026-09-12', close_date: '2026-10-09', season_year: 2026 })],
    );
    expect(composeChangeNote(c, 'Georgia')).toBe(
      'Georgia moved Deer Archery from Sep 13–Oct 10 to Sep 12–Oct 9.',
    );
  });

  it('names the zone when it is not statewide', () => {
    const [c] = diffSeasonYears(
      [base({ zone_id: 'z-b', zone_name: 'Zone B' })],
      [base({ id: 'x', zone_id: 'z-b', zone_name: 'Zone B', open_date: '2026-11-08', season_year: 2026 })],
    );
    expect(composeChangeNote(c, 'Georgia')).toContain('Zone B');
  });

  it('writes additions and removals', () => {
    const added = diffSeasonYears([], [base({ id: 'n', season_year: 2026, open_date: '2026-09-12' })])[0];
    expect(composeChangeNote(added, 'Georgia')).toContain('added');
    const removed = diffSeasonYears([base()], [])[0];
    expect(composeChangeNote(removed, 'Georgia')).toBe('Georgia dropped Deer Archery.');
  });

  it('produces notes that pass the grounding guard', () => {
    const [c] = diffSeasonYears(
      [base()],
      [base({ id: 'id-2', open_date: '2026-09-12', close_date: '2026-10-09', season_year: 2026 })],
    );
    expect(checkGrounding(composeChangeNote(c, 'Georgia'), c).ok).toBe(true);
  });

  it('would reject a note that invents a date', () => {
    const [c] = diffSeasonYears(
      [base()],
      [base({ id: 'id-2', open_date: '2026-09-12', close_date: '2026-10-09', season_year: 2026 })],
    );
    expect(checkGrounding('Georgia moved Deer Archery to Sep 20.', c).ok).toBe(false);
  });
});

describe('isNoteworthy', () => {
  it('ignores a notes-only edit', () => {
    const [c] = diffSeasonYears([base()], [base({ id: 'x', season_year: 2026, notes: 'typo fixed' })]);
    expect(isNoteworthy(c)).toBe(false);
  });

  it('keeps date and bag changes', () => {
    const [c] = diffSeasonYears([base()], [base({ id: 'x', season_year: 2026, open_date: '2026-09-12' })]);
    expect(isNoteworthy(c)).toBe(true);
  });
});

describe('spokenDate', () => {
  it('formats and tolerates missing dates', () => {
    expect(spokenDate('2026-09-12')).toBe('Sep 12');
    expect(spokenDate(null)).toBe('an unposted date');
  });
});
