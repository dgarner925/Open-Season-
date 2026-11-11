import { describe, expect, it } from 'vitest';
import {
  confidenceFor,
  diffSale,
  isAllowedByRobots,
  normaliseForHash,
  parseResidency,
  parseSaleTime,
  saleIdentity,
  seasonYearFor,
  zoneFromAbbrev,
  type ProposedSale,
} from './leftover';

const base: ProposedSale = {
  state_code: 'CO',
  species_key: 'elk',
  season_year: 2026,
  sale_type: 'leftover',
  name: 'Leftover limited elk licences',
  sale_start_date: '2026-08-04',
  sale_start_time: '09:00:00',
  purchase_url: 'https://example.invalid/buy',
};

describe('zoneFromAbbrev', () => {
  it('reads the common abbreviations', () => {
    expect(zoneFromAbbrev('MT')).toBe('America/Denver');
    expect(zoneFromAbbrev('PT')).toBe('America/Los_Angeles');
    expect(zoneFromAbbrev('CST')).toBe('America/Chicago');
    expect(zoneFromAbbrev('EDT')).toBe('America/New_York');
  });

  it('maps the daylight and standard forms to the same zone', () => {
    // Not two zones -- one zone in two seasons. Postgres works out the offset
    // for the sale's own date, which is the only thing that survives the
    // switch leftover sales sit either side of.
    expect(zoneFromAbbrev('MST')).toBe(zoneFromAbbrev('MDT'));
    expect(zoneFromAbbrev('PST')).toBe(zoneFromAbbrev('PDT'));
  });

  it('sends Arizona to Phoenix even though the page says MST', () => {
    expect(zoneFromAbbrev('MST', 'AZ')).toBe('America/Phoenix');
    expect(zoneFromAbbrev('MT', 'az')).toBe('America/Phoenix');
  });

  it('lets the state override win over any abbreviation', () => {
    expect(zoneFromAbbrev('PT', 'AK')).toBe('America/Anchorage');
    expect(zoneFromAbbrev('PST', 'HI')).toBe('Pacific/Honolulu');
  });

  it('is null when it cannot tell', () => {
    expect(zoneFromAbbrev('', 'CO')).toBeNull();
    expect(zoneFromAbbrev(null)).toBeNull();
    expect(zoneFromAbbrev('ZZT')).toBeNull();
  });
});

describe('parseSaleTime', () => {
  it('reads an hour and a zone together', () => {
    expect(parseSaleTime('9:00 a.m. MT', 'CO')).toEqual({
      time: '09:00:00',
      zone: 'America/Denver',
    });
  });

  it('handles the afternoon', () => {
    expect(parseSaleTime('1:30 PM MT').time).toBe('13:30:00');
    expect(parseSaleTime('11:59 pm CT').time).toBe('23:59:00');
  });

  it('handles midnight and noon as numbers', () => {
    expect(parseSaleTime('12:00 am').time).toBe('00:00:00');
    expect(parseSaleTime('12:00 pm').time).toBe('12:00:00');
  });

  it('handles midnight and noon as words', () => {
    expect(parseSaleTime('sales open at noon MT').time).toBe('12:00:00');
    expect(parseSaleTime('closes at midnight').time).toBe('00:00:00');
  });

  it('accepts a bare 24-hour clock', () => {
    expect(parseSaleTime('opens 08:00').time).toBe('08:00:00');
  });

  it('tolerates the punctuation agencies actually use', () => {
    expect(parseSaleTime('9am').time).toBe('09:00:00');
    expect(parseSaleTime('9 a.m.').time).toBe('09:00:00');
    expect(parseSaleTime('9.00 am').time).toBe('09:00:00');
  });

  it('returns null rather than inventing an hour', () => {
    // The common case. A guessed midnight would render as the night before to
    // anyone east of the agency.
    expect(parseSaleTime('Tuesday, August 4')).toEqual({ time: null, zone: null });
    expect(parseSaleTime('')).toEqual({ time: null, zone: null });
    expect(parseSaleTime(null)).toEqual({ time: null, zone: null });
  });

  it('still finds the zone when there is no hour', () => {
    expect(parseSaleTime('Tuesday, August 4 MT', 'CO').zone).toBe('America/Denver');
  });

  it('refuses an impossible clock', () => {
    expect(parseSaleTime('99:99').time).toBeNull();
  });
});

describe('parseResidency', () => {
  it('defaults to both when nothing is said', () => {
    expect(parseResidency('')).toEqual(['resident', 'nonresident']);
    expect(parseResidency(null)).toEqual(['resident', 'nonresident']);
  });

  it('reads resident-only', () => {
    expect(parseResidency('Resident only')).toEqual(['resident']);
    expect(parseResidency('Available to residents')).toEqual(['resident']);
  });

  it('reads nonresident-only in both spellings', () => {
    expect(parseResidency('Nonresident only')).toEqual(['nonresident']);
    expect(parseResidency('Non-resident hunters only')).toEqual(['nonresident']);
  });

  it('does not read "nonresident" as containing "resident"', () => {
    // The whole reason the resident test strips the nonresident words first.
    expect(parseResidency('nonresidents')).toEqual(['nonresident']);
  });

  it('returns both when both are named', () => {
    expect(parseResidency('Resident and nonresident')).toEqual(['resident', 'nonresident']);
  });
});

describe('normaliseForHash', () => {
  it('ignores markup and whitespace', () => {
    const a = normaliseForHash('<div>  <b>Leftover</b> elk  </div>');
    const b = normaliseForHash('<section><span>Leftover elk</span></section>');
    expect(a).toBe(b);
  });

  it('ignores a render timestamp', () => {
    const a = normaliseForHash('<p>Leftover elk</p><footer>Generated 10:04 AM MT</footer>');
    const b = normaliseForHash('<p>Leftover elk</p><footer>Generated 10:05 AM MT</footer>');
    expect(a).toBe(b);
  });

  it('ignores a rotating session id', () => {
    const a = normaliseForHash('<p>elk</p><!-- 3f2504e0-4f89-11d3-9a0c-0305e82c3301 -->');
    const b = normaliseForHash('<p>elk</p><!-- 9c858901-8a57-4791-81fe-4c455b099bc9 -->');
    expect(a).toBe(b);
  });

  it('ignores scripts and styles entirely', () => {
    const a = normaliseForHash('<style>.a{color:red}</style><p>elk</p><script>var t=1</script>');
    expect(a).toBe('elk');
  });

  it('still notices the thing that matters', () => {
    const a = normaliseForHash('<p>Sale opens August 4</p>');
    const b = normaliseForHash('<p>Sale opens August 5</p>');
    expect(a).not.toBe(b);
  });
});

describe('diffSale', () => {
  it('is empty when nothing moved', () => {
    expect(diffSale({ ...base }, base)).toEqual([]);
  });

  it('notices a moved date', () => {
    expect(diffSale({ ...base, sale_start_date: '2026-08-03' }, base)).toEqual(['sale_start_date']);
  });

  it('notices a newly published hour', () => {
    expect(diffSale({ ...base, sale_start_time: null }, base)).toEqual(['sale_start_time']);
  });

  it('does NOT treat a page going silent as a change', () => {
    // Agencies drop the hour once a sale is close. Reading that as "the time
    // is unknown now" would erase a verified 9 a.m. and leave a bare date.
    const quiet: ProposedSale = { ...base, sale_start_time: null, purchase_url: null };
    expect(diffSale({ ...base }, quiet)).toEqual([]);
  });

  it('ignores fields nobody needs to review', () => {
    const renamedNote: ProposedSale = { ...base, notes: 'now with a note' };
    expect(diffSale({ ...base }, renamedNote)).toEqual([]);
  });

  it('reports several changes at once', () => {
    const moved: ProposedSale = { ...base, sale_start_date: '2026-08-11', sale_start_time: '10:00:00' };
    expect(diffSale({ ...base }, moved).sort()).toEqual(['sale_start_date', 'sale_start_time']);
  });

  it('treats a first sighting as all-changed', () => {
    expect(diffSale({}, base).sort()).toEqual(
      ['name', 'purchase_url', 'sale_start_date', 'sale_start_time'].sort(),
    );
  });
});

describe('confidenceFor', () => {
  const CLEAN_SWEEP = 0.85; // approve_clean_reviews' default threshold

  it('trusts a complete proposal enough to sweep', () => {
    expect(confidenceFor({ ...base, sale_end_date: '2026-08-06' })).toBeGreaterThanOrEqual(CLEAN_SWEEP);
  });

  it('holds back a sale whose unit we do not recognise', () => {
    const c = confidenceFor({ ...base, zone_code: 'GMU-999' }, { zoneMatched: false });
    expect(c).toBeLessThan(CLEAN_SWEEP);
  });

  it('does not penalise a unit we do recognise', () => {
    const c = confidenceFor({ ...base, zone_code: 'GMU-12', sale_end_date: '2026-08-06' }, { zoneMatched: true });
    expect(c).toBeGreaterThanOrEqual(CLEAN_SWEEP);
  });

  it('is lower without an hour', () => {
    expect(confidenceFor({ ...base, sale_start_time: null }))
      .toBeLessThan(confidenceFor(base));
  });

  it('never leaves the 0..1 scale', () => {
    const awful = confidenceFor(
      { ...base, sale_start_time: null, purchase_url: null, zone_code: 'X', sale_type: 'reissue' },
      { zoneMatched: false },
    );
    expect(awful).toBeGreaterThanOrEqual(0);
    expect(awful).toBeLessThanOrEqual(1);
  });
});

describe('saleIdentity', () => {
  it('matches the unique index: same sale, same key', () => {
    expect(saleIdentity(base)).toBe(saleIdentity({ ...base, name: 'renamed', notes: 'x' }));
  });

  it('separates a statewide sale from a unit sale', () => {
    expect(saleIdentity(base)).not.toBe(saleIdentity({ ...base, zone_code: 'GMU-12' }));
  });

  it('separates leftover from OTC on the same day', () => {
    expect(saleIdentity(base)).not.toBe(saleIdentity({ ...base, sale_type: 'otc' }));
  });

  it('is case-insensitive about the state', () => {
    expect(saleIdentity({ ...base, state_code: 'co' })).toBe(saleIdentity(base));
  });
});

describe('seasonYearFor', () => {
  it('files an autumn sale under its own year', () => {
    expect(seasonYearFor('2026-08-04')).toBe(2026);
    expect(seasonYearFor('2026-11-20')).toBe(2026);
  });

  it('files a January sale under the licence year that began the autumn before', () => {
    // Otherwise a hunter looking at this season's hunts never sees it.
    expect(seasonYearFor('2027-01-15')).toBe(2026);
    expect(seasonYearFor('2027-03-31')).toBe(2026);
  });

  it('turns over in April', () => {
    expect(seasonYearFor('2027-04-01')).toBe(2027);
  });
});

describe('isAllowedByRobots', () => {
  const UA = 'OpenSeasonBot/1.0 (+https://osdatesanddraws.com/bot)';

  it('allows everything when there is no file', () => {
    expect(isAllowedByRobots('', '/hunting/leftover', UA)).toBe(true);
  });

  it('honours a blanket disallow', () => {
    expect(isAllowedByRobots('User-agent: *\nDisallow: /', '/hunting/leftover', UA)).toBe(false);
  });

  it('treats an empty Disallow as allow everything', () => {
    expect(isAllowedByRobots('User-agent: *\nDisallow:', '/anything', UA)).toBe(true);
  });

  it('blocks only the path named', () => {
    const txt = 'User-agent: *\nDisallow: /admin';
    expect(isAllowedByRobots(txt, '/admin/users', UA)).toBe(false);
    expect(isAllowedByRobots(txt, '/hunting/leftover', UA)).toBe(true);
  });

  it('lets the longest rule win, so an Allow can carve out of a Disallow', () => {
    const txt = 'User-agent: *\nDisallow: /hunting\nAllow: /hunting/leftover';
    expect(isAllowedByRobots(txt, '/hunting/leftover', UA)).toBe(true);
    expect(isAllowedByRobots(txt, '/hunting/private', UA)).toBe(false);
  });

  it('prefers Allow when two rules are the same length', () => {
    const txt = 'User-agent: *\nDisallow: /x\nAllow: /x';
    expect(isAllowedByRobots(txt, '/x', UA)).toBe(true);
  });

  it('lets a rule naming us override the wildcard group', () => {
    const txt = 'User-agent: *\nDisallow: /\n\nUser-agent: OpenSeasonBot\nAllow: /';
    expect(isAllowedByRobots(txt, '/hunting', UA)).toBe(true);
  });

  it('obeys a rule aimed at us even when the wildcard is permissive', () => {
    const txt = 'User-agent: *\nAllow: /\n\nUser-agent: OpenSeasonBot\nDisallow: /';
    expect(isAllowedByRobots(txt, '/hunting', UA)).toBe(false);
  });

  it('groups consecutive user-agent lines together', () => {
    const txt = 'User-agent: BadBot\nUser-agent: OpenSeasonBot\nDisallow: /hunting';
    expect(isAllowedByRobots(txt, '/hunting/leftover', UA)).toBe(false);
  });

  it('understands wildcards and end-anchors', () => {
    expect(isAllowedByRobots('User-agent: *\nDisallow: /*.pdf$', '/docs/deer.pdf', UA)).toBe(false);
    expect(isAllowedByRobots('User-agent: *\nDisallow: /*.pdf$', '/docs/deer.pdf?x=1', UA)).toBe(true);
  });

  it('ignores comments and blank lines', () => {
    const txt = '# a comment\n\nUser-agent: *  # us\nDisallow: /admin # not here\n';
    expect(isAllowedByRobots(txt, '/admin', UA)).toBe(false);
    expect(isAllowedByRobots(txt, '/public', UA)).toBe(true);
  });

  it('ignores directives it does not understand', () => {
    const txt = 'Sitemap: https://x.invalid/s.xml\nCrawl-delay: 10\nUser-agent: *\nDisallow: /admin';
    expect(isAllowedByRobots(txt, '/public', UA)).toBe(true);
  });
});
