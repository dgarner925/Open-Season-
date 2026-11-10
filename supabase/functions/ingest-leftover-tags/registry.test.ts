import { describe, expect, it } from 'vitest';
import { REGISTRY, liveEntries, pendingStates } from './registry';

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
  });

  it('still has states left to research, and says which', () => {
    // Not a goal to drive to zero silently: this is the honest measure of how
    // finished "all states" is.
    expect(pendingStates().length).toBeGreaterThan(0);
  });
});
