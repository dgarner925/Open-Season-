import { describe, expect, it } from 'vitest';
import { buildSeasonCard, shortDate } from './season';
import type { SeasonWithRefs } from '@/features/reference/types';

function s(
  speciesKey: string,
  speciesName: string,
  stateCode: string,
  stateName: string,
  open: string | null,
): SeasonWithRefs {
  return {
    id: `${stateCode}-${speciesName}-${open}`,
    season_year: 2026,
    open_date: open,
    close_date: null,
    species: { id: speciesKey, key: speciesKey, name: speciesName },
    state: { id: stateCode, code: stateCode, name: stateName, license_url: null },
  } as unknown as SeasonWithRefs;
}

const TODAY = '2026-09-01';

describe('shortDate', () => {
  it('drops the year, which the masthead already carries', () => {
    expect(shortDate('2026-10-17')).toBe('Oct 17');
    expect(shortDate('2027-03-05')).toBe('Mar 5');
    expect(shortDate('2026-01-01')).toBe('Jan 1');
    expect(shortDate('2026-12-31')).toBe('Dec 31');
  });
});

describe('buildSeasonCard', () => {
  it('keeps one opener per state and species, the earliest still ahead', () => {
    const card = buildSeasonCard(
      [
        s('deer', 'Deer', 'GA', 'Georgia', '2026-11-07'), // later archery
        s('deer', 'Deer', 'GA', 'Georgia', '2026-10-17'), // the one to show
        s('deer', 'Deer', 'AL', 'Alabama', '2026-10-24'), // a different state
      ],
      TODAY,
    );
    expect(card.openers.map((o) => `${o.stateCode} ${o.date}`)).toEqual(['GA Oct 17', 'AL Oct 24']);
  });

  it('drops openers already behind us', () => {
    const card = buildSeasonCard(
      [s('elk', 'Elk', 'MT', 'Montana', '2026-08-15'), s('deer', 'Deer', 'GA', 'Georgia', '2026-10-17')],
      TODAY,
    );
    expect(card.openers).toHaveLength(1);
    expect(card.openers[0].speciesName).toBe('Deer');
  });

  it('orders the ledger by date, across the new year', () => {
    const card = buildSeasonCard(
      [
        s('turkey', 'Turkey', 'GA', 'Georgia', '2027-03-21'),
        s('deer', 'Deer', 'GA', 'Georgia', '2026-10-17'),
        s('elk', 'Elk', 'MT', 'Montana', '2026-09-05'),
      ],
      TODAY,
    );
    expect(card.openers.map((o) => o.date)).toEqual(['Sep 5', 'Oct 17', 'Mar 21']);
  });

  it('names the hunting year, not the calendar year', () => {
    // A card opened in March belongs to the season that started last autumn.
    expect(buildSeasonCard([], '2027-03-01').year).toBe(2026);
    expect(buildSeasonCard([], '2026-09-01').year).toBe(2026);
  });

  it('lists states and species once each, in the order their openers land', () => {
    const card = buildSeasonCard(
      [
        s('deer', 'Deer', 'GA', 'Georgia', '2026-10-17'),
        s('elk', 'Elk', 'MT', 'Montana', '2026-09-05'),
        s('turkey', 'Turkey', 'GA', 'Georgia', '2027-03-21'),
      ],
      TODAY,
    );
    expect(card.states).toEqual(['Montana', 'Georgia']);
    expect(card.species).toEqual(['Elk', 'Deer', 'Turkey']);
  });

  it('skips rows with no date, species or state rather than inventing one', () => {
    const card = buildSeasonCard(
      [
        s('deer', 'Deer', 'GA', 'Georgia', null),
        { ...s('elk', 'Elk', 'MT', 'Montana', '2026-10-01'), species: null } as SeasonWithRefs,
        { ...s('bear', 'Bear', 'MT', 'Montana', '2026-10-02'), state: null } as SeasonWithRefs,
      ],
      TODAY,
    );
    expect(card.openers).toEqual([]);
    expect(card.states).toEqual([]);
  });

  it('takes the quote from the first hunt on the card', () => {
    // quotes.json has turkey and duck; the ledger leads with turkey here.
    const card = buildSeasonCard(
      [
        s('turkey', 'Turkey', 'GA', 'Georgia', '2026-09-05'),
        s('duck', 'Duck', 'AL', 'Alabama', '2026-11-21'),
      ],
      TODAY,
    );
    expect(card.quote).not.toBeNull();
    expect(card.quote?.text.toLowerCase()).toContain('gobbler');
  });

  it('leaves the quote empty rather than filling it with something generic', () => {
    const card = buildSeasonCard([s('zzz', 'Jackalope', 'GA', 'Georgia', '2026-10-01')], TODAY);
    expect(card.quote).toBeNull();
  });

  it('survives having nothing to show', () => {
    const card = buildSeasonCard([], TODAY);
    expect(card).toMatchObject({ openers: [], states: [], species: [], quote: null });
  });
});
