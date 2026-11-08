/**
 * The season card's data — the one thing in this app that leaves the app.
 *
 * It is a plate, not a report: one opener per hunt, in the order they happen,
 * with the engraved species plates behind them. The art and the type are the
 * two things a competitor cannot copy, so the card carries both and nothing
 * else. Everything here is derived from what the reader already follows; the
 * card never invents a date it would not show on Home.
 *
 * Pure logic, no React Native imports — it is covered by season.test.ts under
 * supabase/vitest.config.ts.
 */
import quotes from '@/assets/quotes.json';
import { huntYear } from '@/features/coverage/gaps';
import type { SeasonWithRefs } from '@/features/reference/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type CardOpener = {
  /** Stable key for React, and the species' plate lookup goes through the name. */
  id: string;
  speciesName: string;
  stateCode: string;
  /** 'Oct 17' — no year; the card's masthead carries the year. */
  date: string;
  iso: string;
};

export type SeasonCard = {
  year: number;
  states: string[];
  openers: CardOpener[];
  /** Distinct species names in opener order — drives which plates go behind. */
  species: string[];
  quote: { text: string; attr: string } | null;
};

/** 'Oct 17' from '2026-10-17', without dragging a locale in. */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}`;
}

/**
 * Build the card from every season row the reader follows.
 *
 * One row per (species, state): a hunter follows deer in Georgia, not six
 * Georgia deer methods, and six near-identical lines would turn the plate
 * into a spreadsheet. The earliest opener still ahead wins, because that is
 * the date he is actually counting down to.
 */
export function buildSeasonCard(seasons: SeasonWithRefs[], iso: string): SeasonCard {
  const year = huntYear(iso);

  const best = new Map<string, CardOpener>();
  for (const s of seasons) {
    const open = s.open_date;
    const speciesName = s.species?.name;
    const stateCode = s.state?.code;
    if (!open || !speciesName || !stateCode) continue;
    if (open < iso) continue;

    const key = `${stateCode}|${speciesName}`;
    const existing = best.get(key);
    if (existing && existing.iso <= open) continue;
    best.set(key, { id: key, speciesName, stateCode, date: shortDate(open), iso: open });
  }

  const openers = [...best.values()].sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0));

  // State names, in the order their first opener lands — the card reads as a
  // calendar, so its states should too.
  const codeToName = new Map<string, string>();
  for (const s of seasons) {
    if (s.state?.code && s.state.name) codeToName.set(s.state.code, s.state.name);
  }
  const states: string[] = [];
  for (const o of openers) {
    const name = codeToName.get(o.stateCode) ?? o.stateCode;
    if (!states.includes(name)) states.push(name);
  }

  const species: string[] = [];
  for (const o of openers) {
    if (!species.includes(o.speciesName)) species.push(o.speciesName);
  }

  return { year, states, openers, species, quote: quoteFor(seasons, openers) };
}

/**
 * The quote belongs to the first hunt on the card — the one the reader is
 * closest to — so the plate is about this season rather than about hunting in
 * general. Falls back to nothing rather than to a generic line: an empty
 * space on a plate is better than filler.
 */
function quoteFor(
  seasons: SeasonWithRefs[],
  openers: CardOpener[],
): { text: string; attr: string } | null {
  const table = quotes as Record<string, { text: string; attr: string }>;
  const keyOf = new Map<string, string>();
  for (const s of seasons) {
    if (s.species?.name && s.species.key) keyOf.set(s.species.name, s.species.key);
  }
  for (const o of openers) {
    const q = table[keyOf.get(o.speciesName) ?? ''];
    if (q) return q;
  }
  return null;
}
