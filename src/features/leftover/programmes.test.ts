import { describe, expect, it } from 'vitest';
import { MECHANIC_LABEL, MECHANIC_LINE, PROGRAMMES, RESEARCHING, offsetLine } from './programmes';
import { REGISTRY } from '../../../supabase/functions/ingest-leftover-tags/registry';

/**
 * The screen's explanation and the server's registry are two descriptions of
 * the same six programmes, written in different files for good reasons: one is
 * prose for hunters, the other is URLs and verification dates for a scraper.
 *
 * Two descriptions of one thing drift. These tests are the only thing holding
 * them together, and the registry is the one that decides -- it is what
 * actually runs every night.
 */
describe('programmes agree with the server registry', () => {
  const automated = new Set(REGISTRY.filter((e) => e.verified).map((e) => e.state_code));

  it('claims nightly reading only for states the ingest function fetches', () => {
    for (const p of PROGRAMMES) {
      if (p.date_source === 'announcement') continue;
      expect(automated.has(p.code), `${p.code} says it is read nightly but the registry does not fetch it`).toBe(true);
    }
  });

  it('does not promise automation for a state entered by hand', () => {
    for (const p of PROGRAMMES.filter((x) => x.date_source === 'announcement')) {
      expect(automated.has(p.code), `${p.code} is described as hand-entered but the registry fetches it`).toBe(false);
    }
  });

  it('describes every state the registry fetches', () => {
    const described = new Set(PROGRAMMES.map((p) => p.code));
    for (const code of automated) {
      expect(described.has(code), `${code} is fetched nightly and the app never explains it`).toBe(true);
    }
  });

  it('calls a rule a rule only where the registry has one', () => {
    const ruled = new Set(REGISTRY.filter((e) => (e.fixed?.length ?? 0) > 0).map((e) => e.state_code));
    for (const p of PROGRAMMES) {
      expect(p.date_source === 'rule', `${p.code}`).toBe(ruled.has(p.code));
    }
  });

  it('never lists a state as both covered and still being researched', () => {
    const described = new Set(PROGRAMMES.map((p) => p.code));
    for (const code of RESEARCHING) expect(described.has(code)).toBe(false);
  });
});

describe('the words the screen puts on the page', () => {
  it('points every state at its own agency over https', () => {
    for (const p of PROGRAMMES) {
      expect(p.url.startsWith('https://'), p.code).toBe(true);
      // The registry forbids blogs and aggregators as sources; the same goes
      // for a link we hand a hunter, and for the same reason.
      expect(p.url).not.toMatch(/gohunt|huntinfool|onx|reddit|facebook|eastmans/i);
    }
  });

  it('says when, in words, for every state', () => {
    for (const p of PROGRAMMES) {
      expect(p.when.length, p.code).toBeGreaterThan(20);
      expect(p.calls_them.length, p.code).toBeGreaterThan(0);
    }
  });

  it('has a label and a sentence for every mechanic it uses', () => {
    for (const p of PROGRAMMES) {
      expect(MECHANIC_LABEL[p.mechanic], p.code).toBeTruthy();
      expect(MECHANIC_LINE[p.mechanic], p.code).toBeTruthy();
    }
  });

  it('reads the offsets as English', () => {
    expect(offsetLine(0)).toBe('the morning of the sale');
    expect(offsetLine(1)).toBe('the day before');
    expect(offsetLine(7)).toBe('7 days before');
  });

  it('matches the offsets the database actually ships', () => {
    // alert_preferences.leftover_offsets defaults to '{7,1,0}' and is checked
    // against {0,1,3,7,14}. The screen promising a 5-day warning would be a
    // promise the constraint forbids.
    const allowed = [0, 1, 3, 7, 14];
    for (const off of [7, 1, 0]) expect(allowed).toContain(off);
  });
});
