/**
 * The daily brief's deterministic half.
 *
 * SQL decides what is true (daily_brief_facts); this file decides whether
 * there is anything worth saying, and composes the plain sentence we fall back
 * to when the model is unavailable, over budget, or ungrounded. The model only
 * ever rephrases what `composeBrief` could already say on its own — which is
 * exactly why it can't invent anything.
 *
 * Pure TypeScript: imported by the Edge Function and the test suite.
 */

export type BriefFacts = {
  today: string;
  open_now: { species: string; state: string; method?: string }[];
  opening_soon: { species: string; state: string; open_date: string; in_days: number }[];
  next_deadline: { species: string; state: string; closes_at: string; in_days: number } | null;
  counts: { open_now: number; opening_soon: number };
};

/** Nothing open, nothing opening, no deadline — say nothing at all. */
export function hasSomethingToSay(f: BriefFacts | null | undefined): boolean {
  if (!f) return false;
  return (
    (f.open_now?.length ?? 0) > 0 ||
    (f.opening_soon?.length ?? 0) > 0 ||
    Boolean(f.next_deadline)
  );
}

function list(names: string[]): string {
  const uniq = [...new Set(names)];
  if (uniq.length === 1) return uniq[0];
  if (uniq.length === 2) return `${uniq[0]} and ${uniq[1]}`;
  return `${uniq.slice(0, -1).join(', ')}, and ${uniq[uniq.length - 1]}`;
}

function days(n: number): string {
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  return `in ${n} days`;
}

/**
 * The brief, composed without a model. Numerals, not spelled-out numbers.
 * This is both the fallback and the yardstick the model's version is checked
 * against.
 */
export function composeBrief(f: BriefFacts): string {
  const parts: string[] = [];

  if (f.open_now?.length) {
    const species = f.open_now.map((o) => o.species);
    const states = [...new Set(f.open_now.map((o) => o.state))];
    parts.push(
      states.length === 1
        ? `${list(species)} open in ${states[0]}.`
        : `${list(species)} open across ${states.length} states.`,
    );
  }

  if (f.opening_soon?.length) {
    const next = f.opening_soon[0];
    const also = f.opening_soon.length - 1;
    parts.push(
      also > 0
        ? `${next.species} opens ${days(next.in_days)} in ${next.state}, with ${also} more inside a week.`
        : `${next.species} opens ${days(next.in_days)} in ${next.state}.`,
    );
  }

  if (f.next_deadline) {
    const d = f.next_deadline;
    parts.push(`The ${d.state} ${d.species.toLowerCase()} draw closes ${days(d.in_days)}.`);
  }

  // Two sentences is the ceiling — this sits under legal light, not above it.
  return parts.slice(0, 2).join(' ');
}

/**
 * Every date and number the model is allowed to use, as strings. Anything
 * numeric in its sentence that isn't in here didn't come from our data.
 */
export function allowedNumbers(f: BriefFacts): Set<string> {
  const out = new Set<string>();
  for (const o of f.opening_soon ?? []) {
    out.add(String(o.in_days));
    out.add(o.open_date);
  }
  if (f.next_deadline) {
    out.add(String(f.next_deadline.in_days));
    out.add(f.next_deadline.closes_at);
  }
  out.add(String(f.counts?.open_now ?? 0));
  out.add(String(f.counts?.opening_soon ?? 0));
  out.add(String(f.open_now?.length ?? 0));
  out.add(String(f.opening_soon?.length ?? 0));
  out.add(String(new Set((f.open_now ?? []).map((o) => o.state)).size));
  out.add(String(Math.max((f.opening_soon?.length ?? 0) - 1, 0)));
  return out;
}

/**
 * Reject a phrased brief that introduces a number our facts don't contain —
 * a wrong day count is as damaging here as a wrong date.
 */
export function checkBriefNumbers(brief: string, f: BriefFacts): { ok: boolean; unsupported: string[] } {
  const allowed = allowedNumbers(f);
  const unsupported: string[] = [];
  for (const m of brief.match(/\b\d{1,4}(?:-\d{2}-\d{2})?\b/g) ?? []) {
    if (!allowed.has(m) && !unsupported.includes(m)) unsupported.push(m);
  }
  return { ok: unsupported.length === 0, unsupported };
}
