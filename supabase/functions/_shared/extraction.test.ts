import { describe, expect, it } from 'vitest';
import {
  accuracyReport,
  dropSummarySpans,
  normalizeLabel,
  seasonGroup,
  isLocalISODate,
  LOW_CONFIDENCE,
  normalizeExtractedDate,
  scoreConfidence,
  seasonIdentity,
  validateSeason,
  dateRenderings,
  expandCompressedRanges,
  groundDates,
  distinctiveNameTokens,
  groundWindow,
  headingFor,
  nameMatchScore,
  textBlocks,
  scoreWindowConfidence,
  validateWindow,
  type CurrentSeason,
  type ExtractedSeason,
  type ExtractedWindow,
} from './extraction';

const season = (over: Partial<ExtractedSeason> = {}): ExtractedSeason => ({
  species: 'deer',
  method: 'archery',
  zone: 'Statewide',
  label: 'Archery',
  season_year: 2026,
  open_date: '2026-09-12',
  close_date: '2026-10-09',
  confidence: 0.9,
  evidence: { page: 12, quote: 'Archery: September 12 - October 9' },
  ...over,
});

describe('isLocalISODate', () => {
  it('accepts real calendar days only', () => {
    expect(isLocalISODate('2026-09-12')).toBe(true);
    expect(isLocalISODate('2026-02-29')).toBe(false); // 2026 is not a leap year
    expect(isLocalISODate('2024-02-29')).toBe(true);
    expect(isLocalISODate('2026-13-01')).toBe(false);
    expect(isLocalISODate('2026-09-31')).toBe(false);
    expect(isLocalISODate('09/12/2026')).toBe(false);
    expect(isLocalISODate(20260912)).toBe(false);
  });
});

describe('normalizeExtractedDate — no UTC shifting, ever', () => {
  it('keeps a plain calendar day exactly as written', () => {
    expect(normalizeExtractedDate('2026-09-12')).toBe('2026-09-12');
  });

  it('slices a trailing time off without moving the day', () => {
    // The bug this prevents: new Date("2026-09-12T00:00:00Z") is Sep 11 in the US.
    expect(normalizeExtractedDate('2026-09-12T00:00:00Z')).toBe('2026-09-12');
    expect(normalizeExtractedDate('2026-09-12 00:00:00')).toBe('2026-09-12');
  });

  it('refuses to guess at ambiguous formats', () => {
    expect(normalizeExtractedDate('09/12/2026')).toBeNull();
    expect(normalizeExtractedDate('Sep 12, 2026')).toBeNull();
    expect(normalizeExtractedDate('TBD')).toBeNull();
  });

  it('passes null through', () => {
    expect(normalizeExtractedDate(null)).toBeNull();
    expect(normalizeExtractedDate('')).toBeNull();
  });
});

describe('seasonIdentity — multi-window seasons must not collapse', () => {
  it('separates two windows that differ only by label', () => {
    const archery = season({ label: 'Archery' });
    const extended = season({ label: 'Extended Archery', close_date: '2027-01-31' });
    expect(seasonIdentity(archery)).not.toBe(seasonIdentity(extended));
  });

  it('separates duck splits', () => {
    const a = season({ species: 'duck', method: 'general', label: 'Segment 1' });
    const b = season({ species: 'duck', method: 'general', label: 'Segment 2' });
    expect(seasonIdentity(a)).not.toBe(seasonIdentity(b));
  });

  it('still matches the same window across years of ids and casing', () => {
    expect(seasonIdentity(season({ label: 'archery' }))).toBe(seasonIdentity(season({ label: 'Archery ' })));
  });

  it('defaults a missing zone to Statewide rather than colliding on empty', () => {
    expect(seasonIdentity(season({ zone: null }))).toBe(seasonIdentity(season({ zone: 'Statewide' })));
  });
});

describe('validateSeason', () => {
  it('passes a clean row', () => {
    expect(validateSeason(season()).ok).toBe(true);
  });

  it('flags an unparseable date instead of inventing one', () => {
    const v = validateSeason(season({ open_date: 'Sep 12, 2026' }));
    expect(v.ok).toBe(false);
    expect(v.errors[0]).toContain('unparseable open_date');
    expect(v.dates.open).toBeNull();
  });

  it('flags a close date before the open date', () => {
    const v = validateSeason(season({ open_date: '2026-10-09', close_date: '2026-09-12' }));
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes('precedes'))).toBe(true);
  });

  it('flags an implausible season year', () => {
    expect(validateSeason(season({ season_year: 26 as number })).ok).toBe(false);
  });

  it('flags evidence that is a paraphrase rather than a quote', () => {
    const v = validateSeason(season({ evidence: { page: 1, quote: 'word '.repeat(30) } }));
    expect(v.errors).toContain('evidence quote longer than 25 words');
  });
});

describe('scoreConfidence', () => {
  it('keeps a high score for a clean, evidenced row', () => {
    const r = season();
    expect(scoreConfidence(r, validateSeason(r))).toBeGreaterThanOrEqual(LOW_CONFIDENCE);
  });

  it('drops any invalid row well below the review threshold', () => {
    const r = season({ open_date: 'whenever', confidence: 0.99 });
    expect(scoreConfidence(r, validateSeason(r))).toBeLessThan(LOW_CONFIDENCE);
  });

  it('distrusts a row with no quoted evidence', () => {
    const r = season({ evidence: null, confidence: 1 });
    expect(scoreConfidence(r, validateSeason(r))).toBeLessThan(LOW_CONFIDENCE);
  });

  it('distrusts a row with no opening date', () => {
    const r = season({ open_date: null, confidence: 1 });
    expect(scoreConfidence(r, validateSeason(r))).toBeLessThan(LOW_CONFIDENCE);
  });
});

describe('accuracyReport', () => {
  const current: CurrentSeason[] = [
    { id: '1', species: 'deer', zone: 'Statewide', method: 'archery', label: 'Archery', season_year: 2026, open_date: '2026-09-12', close_date: '2026-10-09' },
    { id: '2', species: 'deer', zone: 'Statewide', method: 'firearm', label: 'Firearms', season_year: 2026, open_date: '2026-10-17', close_date: '2027-01-10' },
  ];

  it('scores a perfect extraction', () => {
    const r = accuracyReport(
      [season(), season({ method: 'firearm', label: 'Firearms', open_date: '2026-10-17', close_date: '2027-01-10' })],
      current,
    );
    expect(r.exact).toBe(2);
    expect(r.accuracy).toBe(1);
    expect(r.date_mismatch).toEqual([]);
  });

  it('reports a wrong date rather than hiding it', () => {
    const r = accuracyReport([season({ open_date: '2026-09-10' })], current);
    expect(r.exact).toBe(0);
    expect(r.date_mismatch[0].current).toBe('2026-09-12..2026-10-09');
    expect(r.date_mismatch[0].extracted).toBe('2026-09-10..2026-10-09');
    expect(r.only_current).toHaveLength(1); // the firearm season wasn't extracted
  });

  it('reports seasons the model invented', () => {
    const r = accuracyReport([season(), season({ label: 'Phantom Season' })], current);
    expect(r.only_extracted).toHaveLength(1);
  });

  it('handles an empty baseline without dividing by zero', () => {
    expect(accuracyReport([season()], []).accuracy).toBe(0);
  });
});

describe('label noise — the real Georgia accuracy-run failures (2026-10-25)', () => {
  it('treats "youth-only firearms" and "youth firearms" as the same window', () => {
    expect(normalizeLabel('Primitive Weapons & Youth-Only Firearms')).toBe(
      normalizeLabel('Primitive Weapons & Youth Firearms'),
    );
  });

  it('ignores a parenthetical qualifier', () => {
    expect(normalizeLabel('Firearms (one day)')).toBe(normalizeLabel('Firearms'));
    expect(normalizeLabel('Firearms (select days)')).toBe(normalizeLabel('Firearms'));
  });

  it('still separates genuinely different windows', () => {
    expect(normalizeLabel('Segment 1')).not.toBe(normalizeLabel('Segment 2'));
    expect(normalizeLabel('Archery')).not.toBe(normalizeLabel('Extended Archery'));
  });

  it('matches identity across those wording differences', () => {
    const a = season({ label: 'Primitive Weapons & Youth-Only Firearms', method: 'muzzleloader' });
    const b = season({ label: 'Primitive Weapons & Youth Firearms', method: 'muzzleloader' });
    expect(seasonIdentity(a)).toBe(seasonIdentity(b));
  });

  it('groups ignore the label entirely', () => {
    expect(seasonGroup(season({ label: 'anything' }))).toBe(seasonGroup(season({ label: 'else' })));
    expect(seasonGroup(season({ zone: 'Zone B' }))).not.toBe(seasonGroup(season()));
  });
});

describe('accuracyReport — second pass on dates', () => {
  const current: CurrentSeason[] = [
    { id: '1', species: 'bear', zone: 'Central Zone', method: 'firearm', label: 'Firearms (one day)', season_year: 2026, open_date: '2026-12-05', close_date: '2026-12-05' },
  ];

  it('matches a differently-worded label when the dates are identical', () => {
    const r = accuracyReport(
      [season({ species: 'bear', zone: 'Central Zone', method: 'firearm', label: 'Firearms', open_date: '2026-12-05', close_date: '2026-12-05' })],
      current,
    );
    expect(r.exact).toBe(1);
    expect(r.only_extracted).toEqual([]);
    expect(r.only_current).toEqual([]);
  });

  it('does not match across groups just because dates agree', () => {
    const r = accuracyReport(
      [season({ species: 'deer', zone: 'Central Zone', method: 'firearm', label: 'Firearms', open_date: '2026-12-05', close_date: '2026-12-05' })],
      current,
    );
    expect(r.exact).toBe(0);
    expect(r.only_current).toHaveLength(1);
    expect(r.only_extracted).toHaveLength(1);
  });

  it('never counts one extracted row against two current rows', () => {
    const twoWindows: CurrentSeason[] = [
      { id: 'a', species: 'duck', zone: 'Statewide', method: 'general', label: 'Segment 1', season_year: 2026, open_date: '2026-11-21', close_date: '2026-11-29' },
      { id: 'b', species: 'duck', zone: 'Statewide', method: 'general', label: 'Segment 2', season_year: 2026, open_date: '2026-12-12', close_date: '2027-01-31' },
    ];
    const r = accuracyReport(
      [season({ species: 'duck', zone: 'Statewide', method: 'general', label: 'Segment 1', open_date: '2026-11-21', close_date: '2026-11-29' })],
      twoWindows,
    );
    expect(r.exact).toBe(1);
    expect(r.only_current).toHaveLength(1); // segment 2 genuinely missing
  });
});

describe('dropSummarySpans', () => {
  const row = (o: string | null, c: string | null, over: Partial<ExtractedSeason> = {}): ExtractedSeason => ({
    species: 'goose', method: 'general', zone: 'Goose Zone A', label: null,
    season_year: 2026, open_date: o, close_date: c, ...over,
  });

  it('drops the agency summary line when its splits are in the batch', () => {
    // Ohio, 2026-27: the chart prints Oct 17 - Feb 1 above the two splits.
    // The 12 days between them are days the season is SHUT.
    const rows = [
      row('2026-10-17', '2027-02-01', { label: 'Regular Season' }),
      row('2026-10-17', '2026-11-01', { label: 'First Split' }),
      row('2026-11-14', '2027-02-01', { label: 'Second Split' }),
    ];
    const { kept, dropped } = dropSummarySpans(rows);
    expect(dropped.map((r) => r.label)).toEqual(['Regular Season']);
    expect(kept.map((r) => r.label)).toEqual(['First Split', 'Second Split']);
  });

  it('keeps a season that runs on past its last split', () => {
    // Virginia falconry: Nov 18 - Feb 7 over the gun segments, but it does not
    // end where they end. DWR publishes it as its own season and so do we.
    const rows = [
      row('2026-11-18', '2027-02-07', { species: 'duck', label: 'Falconry Segment 2' }),
      row('2026-11-18', '2026-11-29', { species: 'duck', label: 'Segment 2' }),
      row('2026-12-19', '2027-01-31', { species: 'duck', label: 'Segment 3' }),
    ];
    expect(dropSummarySpans(rows).dropped).toEqual([]);
  });

  it('keeps a container whose splits leave no gap', () => {
    // Back-to-back windows hide no closure, so the span tells no lie.
    const rows = [
      row('2026-10-01', '2026-10-31', { label: 'Season' }),
      row('2026-10-01', '2026-10-15', { label: 'A' }),
      row('2026-10-16', '2026-10-31', { label: 'B' }),
    ];
    expect(dropSummarySpans(rows).dropped).toEqual([]);
  });

  it('never compares across zones', () => {
    // Missouri's North Zone really does run longer than its Middle Zone.
    const rows = [
      row('2026-10-31', '2026-12-29', { zone: 'North Zone' }),
      row('2026-11-07', '2026-12-13', { zone: 'Middle Zone' }),
      row('2026-11-26', '2026-11-29', { zone: 'South Zone' }),
    ];
    expect(dropSummarySpans(rows).dropped).toEqual([]);
  });

  it('needs two splits before it calls anything a summary', () => {
    const rows = [
      row('2026-10-17', '2027-02-01', { label: 'Regular Season' }),
      row('2026-10-17', '2026-11-01', { label: 'First Split' }),
    ];
    expect(dropSummarySpans(rows).dropped).toEqual([]);
  });

  it('leaves rows with unusable dates alone', () => {
    const rows = [row(null, null, { label: 'TBA' }), row('2026-10-17', '2026-11-01')];
    expect(dropSummarySpans(rows).dropped).toEqual([]);
  });
});


// ---------------------------------------------------------------------------
// Application windows
// ---------------------------------------------------------------------------

const win = (over: Partial<ExtractedWindow> = {}): ExtractedWindow => ({
  species: 'elk',
  zone: null,
  season_year: 2027,
  name: 'Primary Draw',
  opens_at: '2027-03-01',
  closes_at: '2027-04-07',
  results_expected_at: null,
  fee_summary: null,
  application_url: null,
  confidence: 0.9,
  evidence: { page: null, quote: 'Applications accepted March 1 through April 7, 2027.' },
  ...over,
});

describe('validateWindow', () => {
  it('accepts a well-formed window', () => {
    expect(validateWindow(win()).ok).toBe(true);
  });

  it('rejects a window with no closing date', () => {
    const v = validateWindow(win({ closes_at: null }));
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toContain('nothing to apply by');
  });

  it('rejects a deadline that precedes its opening', () => {
    const v = validateWindow(win({ opens_at: '2027-04-07', closes_at: '2027-03-01' }));
    expect(v.errors.join(' ')).toContain('precedes');
  });

  it('rejects results that land before the deadline', () => {
    const v = validateWindow(win({ results_expected_at: '2027-03-15' }));
    expect(v.errors.join(' ')).toContain('results');
  });

  it('rejects a paraphrased evidence quote', () => {
    const v = validateWindow(win({
      evidence: { page: null, quote: Array.from({ length: 30 }, () => 'word').join(' ') },
    }));
    expect(v.errors.join(' ')).toContain('25 words');
  });

  it('normalises the dates it validated', () => {
    expect(validateWindow(win()).dates).toEqual({
      opens: '2027-03-01', closes: '2027-04-07', results: null,
    });
  });
});

describe('dateRenderings', () => {
  it('covers the ways an agency prints one day', () => {
    const r = dateRenderings('2027-04-07');
    expect(r).toContain('April 7, 2027');
    expect(r).toContain('Apr 7');
    expect(r).toContain('4/7/2027');
    expect(r).toContain('04/07/2027');
    expect(r).toContain('2027-04-07');
  });

  it('never renders a different day', () => {
    expect(dateRenderings('2027-04-07').join(' ')).not.toContain('April 8');
  });
});

describe('groundDates', () => {
  const page = 'Elk applications open March 1, 2027 and close on Apr. 7, 2027. Results posted later.';

  it('finds every date the page states, however it is written', () => {
    const g = groundDates(page, null, ['2027-03-01', '2027-04-07']);
    expect(g.basis).toBe('document');
    expect(g.missing).toEqual([]);
    expect(g.found).toEqual(['2027-03-01', '2027-04-07']);
  });

  it('reports a date the page does not state', () => {
    const g = groundDates(page, null, ['2027-04-09']);
    expect(g.missing).toEqual(['2027-04-09']);
    expect(g.found).toEqual([]);
  });

  it('falls back to the model quote when there is no page text (a PDF)', () => {
    const g = groundDates(null, 'close on April 7, 2027', ['2027-04-07']);
    expect(g.basis).toBe('quote');
    expect(g.missing).toEqual([]);
  });

  it('reports no basis at all when there is neither', () => {
    expect(groundDates(null, null, ['2027-04-07']).basis).toBe('none');
  });

  it('returns a snippet of the page around what it matched', () => {
    const g = groundDates(page, null, ['2027-03-01']);
    expect(g.quote).toBeTruthy();
    expect(g.quote!).toContain('March 1, 2027');
  });

  it('is not fooled by punctuation or spacing', () => {
    const g = groundDates('deadline  Apr.  7 ,  2027', null, ['2027-04-07']);
    expect(g.missing).toEqual([]);
  });
});

describe('scoreWindowConfidence', () => {
  const score = (over: Partial<ExtractedWindow>, page: string | null) => {
    const row = win(over);
    const v = validateWindow(row);
    const g = groundDates(page, row.evidence?.quote ?? null,
      [row.opens_at, row.closes_at, row.results_expected_at]);
    return scoreWindowConfidence(row, v, g);
  };

  // Page-level grounding alone no longer clears the gate: it says the date is
  // printed somewhere on the site, not that it belongs to this hunt. Only
  // groundWindow, which checks the row, can reach 0.9 -- see below.
  it('holds a page-level match below the gate', () => {
    const s = score({}, 'open March 1, 2027 close April 7, 2027');
    expect(s).toBeLessThanOrEqual(0.6);
    expect(s).toBeGreaterThan(0.3);
  });

  it('refuses a date the page does not contain, however sure the model is', () => {
    expect(score({ confidence: 1 }, 'open March 1, 2027')).toBeLessThanOrEqual(0.3);
  });

  it('keeps a PDF below the gate even when the quote agrees', () => {
    const s = score({ evidence: { page: 3, quote: 'March 1, 2027 to April 7, 2027' } }, null);
    expect(s).toBeLessThanOrEqual(0.8);
    expect(s).toBeGreaterThan(0.3);
  });

  it('refuses a window that failed validation', () => {
    expect(score({ closes_at: null }, 'open March 1, 2027')).toBeLessThanOrEqual(0.3);
  });

  it('caps a row with no evidence quote', () => {
    expect(score({ evidence: null }, 'open March 1, 2027 close April 7, 2027'))
      .toBeLessThanOrEqual(0.6);
  });
});

describe('expandCompressedRanges', () => {
  it('writes out the far end of a same-month range', () => {
    const out = expandCompressedRanges('application period is Feb. 3–24, 2027');
    expect(out).toContain('Feb 24, 2027');
  });

  it('handles a plain hyphen and a full month name', () => {
    expect(expandCompressedRanges('March 1-15, 2027')).toContain('March 15, 2027');
  });

  it('leaves text with no range untouched', () => {
    const s = 'closes April 7, 2027';
    expect(expandCompressedRanges(s)).toBe(s);
  });

  it('does not invent a month that is not there', () => {
    expect(expandCompressedRanges('3-24')).toBe('3-24');
  });
});

describe('groundDates with compressed ranges', () => {
  // The real sentence from eregulations.com/tennessee, which scored 0.30 on
  // 2026-11-21 for a deadline the page states.
  const tn = 'The application period for the elk quota hunts is Feb. 3–24, 2027.';

  it('finds both ends of the range', () => {
    const g = groundDates(tn, null, ['2027-02-03', '2027-02-24']);
    expect(g.missing).toEqual([]);
  });

  it('still refuses a date the range does not cover', () => {
    const g = groundDates(tn, null, ['2027-02-25']);
    expect(g.missing).toEqual(['2027-02-25']);
  });
});

describe('textBlocks', () => {
  it('keeps a table row whole, cells and all', () => {
    const html = '<table><tr><td>Spring Turkey Phase I</td><td>Nov 30, 2026</td></tr>' +
                 '<tr><td>Quail Quota Phase I</td><td>Dec 14, 2026</td></tr></table>';
    const b = textBlocks(html);
    expect(b.some((x) => x.includes('Spring Turkey Phase I') && x.includes('Nov 30, 2026'))).toBe(true);
    expect(b.some((x) => x.includes('Spring Turkey') && x.includes('Dec 14'))).toBe(false);
  });

  it('drops scripts and styles', () => {
    expect(textBlocks('<p>real</p><script>var x = "fake"</script>').join(' ')).not.toContain('fake');
  });
});

describe('nameMatchScore', () => {
  it('scores a row that says the name', () => {
    expect(nameMatchScore('Statewide Alligator Harvest Phase I', 'Statewide Alligator Harvest Permits Phase I'))
      .toBeGreaterThan(0.6);
  });

  it('matches a word by prefix, so hunt finds hunts', () => {
    expect(nameMatchScore('the elk quota hunts close soon', 'Elk Quota Hunt')).toBe(1);
  });

  it('ignores generic hunting words, so unrelated rows do not match', () => {
    expect(nameMatchScore('Dove Hunt Permits application', 'Alligator Harvest Permits')).toBeLessThan(0.6);
  });

  it('requires the phase marker, so Phase I is not Phase II', () => {
    const row = 'Statewide Alligator Harvest Permits Phase II Applications: 5/22/2026 - 6/1/2026';
    expect(nameMatchScore(row, 'Statewide Alligator Harvest Permits Phase II')).toBe(1);
    // Everything matches except the one character that matters.
    expect(nameMatchScore(row, 'Statewide Alligator Harvest Permits Phase I')).toBe(0);
  });

  it('requires a period letter the same way', () => {
    const row = 'Regular Season Waterfowl Period B Phase I Applications';
    expect(nameMatchScore(row, 'Regular Season Waterfowl Period B Phase I')).toBe(1);
    expect(nameMatchScore(row, 'Regular Season Waterfowl Period C Phase I')).toBe(0);
  });

  it('does not match a marker inside a longer word', () => {
    // "Island" starts with "i"; the marker is a word, not a prefix.
    expect(nameMatchScore('Merritt Island Waterfowl Applications', 'Merritt Island Waterfowl Phase I')).toBe(0);
  });

  it('is zero without a name', () => {
    expect(nameMatchScore('anything', null)).toBe(0);
  });

  it('counts only the words that say what the hunt is', () => {
    expect(distinctiveNameTokens('Phase I')).toEqual(['phase']);
    expect(distinctiveNameTokens('Statewide Alligator Harvest Permits Phase I'))
      .toEqual(['statewide', 'alligator', 'harvest', 'phase']);
  });
});

describe('groundWindow', () => {
  const html =
    '<table>' +
    '<tr><td>Spring Turkey Phase I</td><td>Nov 2 - Nov 30, 2026</td></tr>' +
    '<tr><td>Quail Quota Phase I</td><td>Nov 2 - Dec 14, 2026</td></tr>' +
    '</table>';
  const blocks = textBlocks(html);
  const text = textBlocks(html).join(' ');

  it('recognises the row that names the hunt', () => {
    const g = groundWindow(blocks, text, null, 'Spring Turkey Phase I',
      ['2026-11-30'], '2026-11-30');
    expect(g.missing).toEqual([]);
    expect(g.rowMatch).toBeGreaterThanOrEqual(0.6);
    expect(g.rowText).toContain('Spring Turkey');
  });

  it('refuses to credit a date that sits on another hunt row', () => {
    // Dec 14 is on the page, but it is Quail's date, not Spring Turkey's.
    const g = groundWindow(blocks, text, null, 'Spring Turkey Phase I',
      ['2026-12-14'], '2026-12-14');
    expect(g.missing).toEqual([]);          // the date IS on the page
    expect(g.rowMatch).toBeLessThan(0.6);   // but not on this hunt's row
  });

  it('still reports a date that is nowhere on the page', () => {
    const g = groundWindow(blocks, text, null, 'Spring Turkey Phase I',
      ['2026-12-25'], '2026-12-25');
    expect(g.missing).toEqual(['2026-12-25']);
  });

  it('leaves rowMatch null when there are no blocks (a PDF)', () => {
    const g = groundWindow(null, null, 'closes Nov 30, 2026', 'Spring Turkey',
      ['2026-11-30'], '2026-11-30');
    expect(g.rowMatch).toBeNull();
  });
});

describe('scoreWindowConfidence with rows', () => {
  const html =
    '<table>' +
    '<tr><td>Spring Turkey Phase I</td><td>Nov 2 - Nov 30, 2026</td></tr>' +
    '<tr><td>Quail Quota Phase I</td><td>Nov 2 - Dec 14, 2026</td></tr>' +
    '</table>';
  const blocks = textBlocks(html);
  const text = blocks.join(' ');

  const scoreRow = (name: string, closes: string) => {
    const row = win({ name, opens_at: '2026-11-02', closes_at: closes, season_year: 2026 });
    const v = validateWindow(row);
    const g = groundWindow(blocks, text, row.evidence?.quote ?? null, name,
      [row.opens_at, row.closes_at, row.results_expected_at], closes);
    return scoreWindowConfidence(row, v, g);
  };

  it('auto-approves a date found on its own row', () => {
    expect(scoreRow('Spring Turkey Phase I', '2026-11-30')).toBeGreaterThanOrEqual(0.85);
  });

  it('holds back a date that belongs to a different hunt', () => {
    expect(scoreRow('Spring Turkey Phase I', '2026-12-14')).toBeLessThanOrEqual(0.6);
  });
});

describe('headingFor', () => {
  // Florida's limited-entry page, reduced: the hunt is named once in a
  // heading and its phases are listed under it, so the row carrying the date
  // never says which hunt it belongs to.
  const html =
    '<h3>Statewide Alligator Harvest Permits</h3>' +
    '<p>Phase I Applications: 5/8/2026 - 5/18/2026</p>' +
    '<p>Phase II Applications: 5/22/2026 - 6/1/2026</p>' +
    '<h3>Snipe Permit</h3>' +
    '<p>Phase I Applications: 9/4/2026 - 9/14/2026</p>';
  const blocks = textBlocks(html);

  it('walks back to the nearest block with no date in it', () => {
    const i = blocks.findIndex((b) => b.includes('5/18/2026'));
    expect(headingFor(blocks, i)).toContain('Statewide Alligator Harvest Permits');
  });

  it('does not reach past a nearer heading', () => {
    const i = blocks.findIndex((b) => b.includes('9/14/2026'));
    expect(headingFor(blocks, i)).toContain('Snipe');
    expect(headingFor(blocks, i)).not.toContain('Alligator');
  });

  it('is empty for the first block', () => {
    expect(headingFor(blocks, 0)).toBe('');
  });

  it('grounds a window whose name lives in the heading above it', () => {
    const text = blocks.join(' ');
    const ok = groundWindow(blocks, text, null, 'Statewide Alligator Harvest Permits Phase I',
      ['2026-05-18'], '2026-05-18');
    expect(ok.rowMatch).toBe(1);
    expect(ok.nameTokens).toBeGreaterThanOrEqual(2);

    // Phase II's date under Phase I's name: everything matches but the marker.
    const shuffled = groundWindow(blocks, text, null, 'Statewide Alligator Harvest Permits Phase I',
      ['2026-06-01'], '2026-06-01');
    expect(shuffled.missing).toEqual([]);   // the date is on the page
    expect(shuffled.rowMatch).toBe(0);      // but it is not this phase's

    // And a name too vague to verify cannot clear the gate on a perfect match.
    const vague = groundWindow(blocks, text, null, 'Phase I', ['2026-09-14'], '2026-09-14');
    expect(vague.rowMatch).toBe(1);
    expect(vague.nameTokens).toBe(1);
  });
});
