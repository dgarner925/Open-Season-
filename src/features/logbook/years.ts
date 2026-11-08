/**
 * The logbook — your hunting years, one row each.
 *
 * Nothing here is new data. Every figure is read back out of what the app
 * already holds: the applications you tracked, the fees you entered, the
 * points you put behind them, the hunts you follow and when you started
 * following them. That is the point. No other app in this category keeps a
 * hunter's record across years, and a record compounds: a season's worth of
 * tracking is a nice list, three seasons is something you cannot leave behind.
 *
 * The rule the whole module obeys: never state a number we cannot source.
 * A year with no fees entered says nothing about money rather than "$0", and
 * a draw with no result says "waiting" rather than guessing. An invented zero
 * in a ledger is worse than a blank, because a blank is honest.
 *
 * Pure logic, no React Native imports — covered by years.test.ts under
 * supabase/vitest.config.ts.
 */
import { huntYear } from '@/features/coverage/gaps';

/** The shape the screen needs, independent of the database row types. */
export type LogApplication = {
  status: 'planned' | 'applied' | 'successful' | 'unsuccessful' | 'purchased';
  applied_on: string | null;
  results_on: string | null;
  fee_summary: string | null;
  points: number | null;
  created_at: string;
  stateName: string | null;
  speciesName: string | null;
};

export type LogFollow = { created_at: string; stateName: string | null; speciesName: string | null };

export type LogYear = {
  year: number;
  /** Draws entered — applications that were actually submitted. */
  entered: number;
  drawn: number;
  missed: number;
  /** Tags bought over the counter, which are not draws and are counted apart. */
  bought: number;
  /** Still waiting on a result. */
  pending: number;
  /** Null when no fee was ever entered for the year: a blank, not a zero. */
  fees: number | null;
  /** Points committed to that year's applications; null when none recorded. */
  points: number | null;
  states: string[];
  species: string[];
};

/** "$341", "341.50", "$120 res / $341 nonres" → the first dollar figure. */
export function parseFee(s: string | null): number | null {
  const m = /\$?\s*([\d,]+(?:\.\d{1,2})?)/.exec(s ?? '');
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Which hunting year an application belongs to.
 *
 * The date it was applied, when we have it — that is the act being recorded.
 * Otherwise the date the row was created, which is when the hunter told us
 * about it. results_on is deliberately NOT used to place a row: a result that
 * lands in June belongs to the season you applied for, not to the next one.
 */
export function yearOf(a: LogApplication): number {
  return huntYear((a.applied_on ?? a.created_at).slice(0, 10));
}

function push(list: string[], value: string | null | undefined) {
  if (value && !list.includes(value)) list.push(value);
}

/** Group every application into its hunting year, newest year first. */
export function logYears(apps: LogApplication[]): LogYear[] {
  const byYear = new Map<number, LogYear>();

  for (const a of apps) {
    const year = yearOf(a);
    let y = byYear.get(year);
    if (!y) {
      y = {
        year,
        entered: 0,
        drawn: 0,
        missed: 0,
        bought: 0,
        pending: 0,
        fees: null,
        points: null,
        states: [],
        species: [],
      };
      byYear.set(year, y);
    }

    if (a.status === 'purchased') y.bought += 1;
    else if (a.status !== 'planned') {
      // 'planned' is an intention, not an entry. Counting it as a draw
      // entered would overstate the record, which is the one thing a logbook
      // may never do.
      y.entered += 1;
      if (a.status === 'successful') y.drawn += 1;
      else if (a.status === 'unsuccessful') y.missed += 1;
      else y.pending += 1;
    }

    const fee = parseFee(a.fee_summary);
    if (fee !== null) y.fees = (y.fees ?? 0) + fee;
    if (a.points != null && a.points > 0) y.points = (y.points ?? 0) + a.points;

    push(y.states, a.stateName);
    push(y.species, a.speciesName);
  }

  return [...byYear.values()].sort((a, b) => b.year - a.year);
}

/**
 * The year in a sentence, in the order a hunter would tell it: where, what,
 * how it went, what it cost. Clauses with nothing behind them are left out
 * rather than written as a zero.
 */
export function yearSentence(y: LogYear): string {
  const parts: string[] = [];

  if (y.states.length) {
    parts.push(
      y.states.length <= 2
        ? y.states.join(' and ')
        : `${y.states.length} states`,
    );
  }
  if (y.species.length) {
    parts.push(
      y.species.length <= 2
        ? y.species.map((s) => s.toLowerCase()).join(' and ')
        : `${y.species.length} species`,
    );
  }

  const outcome: string[] = [];
  if (y.entered) {
    outcome.push(`${y.entered} draw${y.entered === 1 ? '' : 's'} entered`);
    if (y.drawn) outcome.push(`${y.drawn} drawn`);
    if (y.pending) outcome.push(`${y.pending} still waiting`);
  }
  if (y.bought) outcome.push(`${y.bought} tag${y.bought === 1 ? '' : 's'} bought`);

  const head = parts.length ? `${cap(parts.join(', '))}.` : '';
  const mid = outcome.length ? ` ${cap(outcome.join(', '))}.` : '';
  const money = y.fees !== null ? ` $${Math.round(y.fees).toLocaleString()} in fees.` : '';
  const pts = y.points !== null ? ` ${y.points} point${y.points === 1 ? '' : 's'} committed.` : '';

  const all = `${head}${mid}${money}${pts}`.trim();
  return all || 'Nothing recorded for this year.';
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * How long the reader has been keeping this record — the line that makes the
 * logbook worth having. Based on the oldest thing we can date: the first
 * follow, or the first application if they tracked one before following.
 *
 * Returns null in the first season, when "since 2026" would be a boast about
 * three weeks.
 */
export function keepingSince(follows: LogFollow[], apps: LogApplication[], iso: string): number | null {
  const dates = [
    ...follows.map((f) => f.created_at),
    ...apps.map((a) => a.applied_on ?? a.created_at),
  ]
    .filter(Boolean)
    .map((d) => d.slice(0, 10))
    .sort();
  if (dates.length === 0) return null;

  const first = huntYear(dates[0]);
  return first < huntYear(iso) ? first : null;
}
