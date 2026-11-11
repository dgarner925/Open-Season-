import { describe, expect, it } from 'vitest';
import { REGISTRY, dueFixedSales, fixedSalesFor, liveEntries, pendingStates, ruleDrivenStates } from './registry';

describe('the leftover registry', () => {
  it('names no state twice', () => {
    const codes = REGISTRY.map((e) => e.state_code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('uses two-letter upper-case state codes', () => {
    for (const e of REGISTRY) expect(e.state_code).toMatch(/^[A-Z]{2}$/);
  });

  it('only fetches entries somebody actually looked at', () => {
    for (const e of liveEntries()) {
      expect(e.verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.sources.length).toBeGreaterThan(0);
    }
  });

  it('never fetches a lead', () => {
    // An unverified entry is a note to self, not a source. If this ever fails,
    // something is about to scrape a URL nobody confirmed.
    const live = new Set(liveEntries().map((e) => e.state_code));
    for (const code of pendingStates()) expect(live.has(code)).toBe(false);
  });

  it('points only at agency domains over https', () => {
    // Never a hunting blog or a news aggregator: they carry last year's dates
    // indefinitely and read as authoritative.
    const BLOG = /gohunt|huntinfool|outdoorhub|rmef|eastmans|onx|reddit|facebook/i;
    for (const e of REGISTRY) {
      for (const s of e.sources) {
        expect(s.url).toMatch(/^https:\/\//);
        expect(s.url).not.toMatch(BLOG);
      }
    }
  });

  it('gives every verified entry a known shape', () => {
    for (const e of liveEntries()) {
      expect(['first_come', 'application_window', 'recurring', 'unknown']).toContain(e.shape);
    }
  });

  it('has Wyoming present but not fetchable, with its reason written down', () => {
    // WY publishes its leftover dates in news releases only -- neither of its
    // stable pages carries one. It must not quietly become a source until a
    // news feed is added and proven.
    const wy = REGISTRY.find((e) => e.state_code === 'WY');
    expect(wy).toBeDefined();
    expect(wy!.shape).toBe('unknown');
    expect(wy!.notes ?? '').toMatch(/news/i);
    // This test said all of the above and never checked the one field that
    // decides whether we fetch. WY sat at verified: '2026-11-10' and was read
    // twice a night, finding nothing both times, because `verified` means "the
    // date is on this page" and for Wyoming it is not.
    expect(wy!.verified).toBeNull();
  });

  it('still has states left to research, and says which', () => {
    // Not a goal to drive to zero silently: this is the honest measure of how
    // finished "all states" is.
    expect(pendingStates().length).toBeGreaterThan(0);
  });
});

describe('rule-driven sale dates', () => {
  const or = REGISTRY.find((e) => e.state_code === 'OR')!;

  it('knows Oregon without fetching anything', () => {
    // The point of the whole mechanism: this answer survives the agency's
    // site being down, redesigned or bot-blocked.
    const sales = fixedSalesFor(or, 2027);
    expect(sales.map((s) => s.date)).toEqual(['2027-07-01', '2027-03-15']);
  });

  it('carries the hour and the zone the rule is written in', () => {
    const [bigGame] = fixedSalesFor(or, 2027);
    expect(bigGame.time).toBe('10:00:00');
    expect(bigGame.zone).toBe('America/Los_Angeles');
  });

  it('keeps a species-specific rule to its own species', () => {
    const bear = fixedSalesFor(or, 2027).find((s) => s.date.endsWith('03-15'))!;
    expect(bear.species).toEqual(['bear']);
  });

  it('falls back to the entry\u2019s species only when a rule names none', () => {
    // This test used to assert that Oregon's 1 July rule covered the whole
    // entry, bear included. The fallback itself is right and worth keeping --
    // a rule naming no species should mean "all of them". Asserting it against
    // a state whose bear has its own March rule is what blessed a published
    // bear sale on 1 July under a name reading "deer, elk and pronghorn". So
    // the fallback is tested on a rule that really is general, and Oregon's
    // July rule now names its three.
    const bigGame = fixedSalesFor(or, 2027).find((s) => s.date.endsWith('07-01'))!;
    expect(bigGame.species).toEqual(['deer', 'elk', 'pronghorn']);
    expect(bigGame.species).not.toContain('bear');

    const general = fixedSalesFor(
      { ...or, fixed: [{ month: 7, day: 1, time: null, zone: 'America/Los_Angeles', name: 'All of it' }] },
      2027,
    );
    expect(general[0].species).toEqual(or.species);
  });

  it('pads single-digit months and days', () => {
    expect(fixedSalesFor(or, 2028).every((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.date))).toBe(true);
  });

  it('returns ISO days, never instants', () => {
    // Converting here would bake today's daylight-saving offset into a date
    // months away. The database trigger resolves it against the sale's own
    // date, which is the only thing that stays right across the switch.
    for (const s of fixedSalesFor(or, 2027)) {
      expect(s.date).not.toMatch(/T|Z|\+/);
    }
  });

  it('is empty for a state with no standing rule', () => {
    const mt = REGISTRY.find((e) => e.state_code === 'MT')!;
    expect(fixedSalesFor(mt, 2027)).toEqual([]);
  });

  it('names which states are rule-driven', () => {
    expect(ruleDrivenStates()).toContain('OR');
  });
});

describe('registry species keys', () => {
  /**
   * The keys `species` actually holds in production, read on 2026-11-10:
   *
   *   select key from species order by key;
   *
   * The big-game ones are all this registry needs. Every entry once said
   * mule_deer and black_bear instead, which are not keys and never were --
   * the first live run would have discarded half of Oregon's rule as
   * "unknown species" if that path had been implemented. The test is here
   * because nothing else checks it: these strings are only resolved at
   * runtime, against a database the test suite cannot see.
   */
  const REAL_KEYS = new Set([
    'deer',
    'elk',
    'bear',
    'brown-bear',
    'pronghorn',
    'turkey',
    'moose',
    'sheep',
    'goat',
    'bison',
  ]);

  it('names only species that exist', () => {
    const bad: string[] = [];
    for (const e of REGISTRY) {
      for (const k of e.species ?? []) if (!REAL_KEYS.has(k)) bad.push(`${e.state_code}: ${k}`);
      for (const f of e.fixed ?? []) {
        for (const k of f.species ?? []) if (!REAL_KEYS.has(k)) bad.push(`${e.state_code} rule: ${k}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('gives every verified entry at least one species to propose', () => {
    for (const e of REGISTRY.filter((x) => x.verified)) {
      expect((e.species ?? []).length, `${e.state_code} has no species`).toBeGreaterThan(0);
    }
  });
});

describe('dueFixedSales', () => {
  const or = REGISTRY.find((e) => e.state_code === 'OR')!;

  it('gives next year once this year has gone by', () => {
    // November: both Oregon dates are behind us.
    const dates = dueFixedSales(or, '2026-11-11').map((s) => s.date).sort();
    expect(dates).toEqual(['2027-03-15', '2027-07-01']);
  });

  it('keeps a date still ahead of us this year', () => {
    // February: March is weeks away and July is months away. Asking for
    // year + 1, as the call site did, would have hidden the March sale until
    // the day after it happened.
    const dates = dueFixedSales(or, '2027-02-01').map((s) => s.date).sort();
    expect(dates).toEqual(['2027-03-15', '2027-07-01']);
  });

  it('treats the sale day itself as still ahead', () => {
    expect(dueFixedSales(or, '2027-03-15').map((s) => s.date)).toContain('2027-03-15');
  });

  it('rolls one rule without rolling the other', () => {
    // April: March is gone, July is not.
    const dates = dueFixedSales(or, '2027-04-01').map((s) => s.date).sort();
    expect(dates).toEqual(['2027-07-01', '2028-03-15']);
  });

  it('is empty for a state with no rule', () => {
    const mt = REGISTRY.find((e) => e.state_code === 'MT')!;
    expect(dueFixedSales(mt, '2026-11-11')).toEqual([]);
  });

  it('carries the hour, zone and name each rule was written with', () => {
    const bear = dueFixedSales(or, '2026-11-11').find((s) => s.date.endsWith('03-15'))!;
    expect(bear.time).toBe('10:00:00');
    expect(bear.zone).toBe('America/Los_Angeles');
    expect(bear.species).toEqual(['bear']);
    expect(bear.name).toMatch(/bear/i);
  });
});

describe('fixed rules do not overlap', () => {
  /**
   * Oregon published a bear sale on 1 July because that rule named no species
   * and inherited all four, bear included -- while bear's own 15 March rule
   * sat right beside it. Two rules claiming one species means one of them is
   * wrong, and the wrong one gets a name that contradicts itself.
   */
  it('never lets two rules in one state claim the same species', () => {
    for (const e of REGISTRY) {
      if ((e.fixed?.length ?? 0) < 2) continue;
      const seen = new Map<string, string>();
      for (const f of e.fixed!) {
        for (const k of f.species ?? e.species ?? []) {
          const prior = seen.get(k);
          expect(
            prior,
            `${e.state_code}: ${k} is claimed by both "${prior}" and "${f.name}"`,
          ).toBeUndefined();
          seen.set(k, f.name);
        }
      }
    }
  });

  it('gives a species-specific rule a name that admits it', () => {
    // Not a style rule. A row called "deer, elk and pronghorn" attached to a
    // bear is the exact shape of the bug above, and it reaches a hunter as a
    // push notification.
    for (const e of REGISTRY) {
      for (const f of e.fixed ?? []) {
        const species = f.species ?? e.species ?? [];
        if (species.length !== 1) continue;
        expect(f.name.toLowerCase(), `${e.state_code} ${f.name}`).toContain(species[0]);
      }
    }
  });
});
