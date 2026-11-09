/**
 * The sentences Home speaks, as pure strings.
 *
 * Kept out of the component so they can be tested without a renderer. One of
 * them — lightRuleNote — states the law, so it is not allowed to be a guess:
 * see the note on that function.
 */

/** Species named as plurals take the plural verb: "Ducks open", "Deer opens". */
const PLURAL_SPECIES = new Set(['Ducks', 'Geese', 'Doves', 'Rails', 'Snipe']);

export function openVerb(name: string | null | undefined): string {
  return PLURAL_SPECIES.has((name ?? '').trim()) ? 'open' : 'opens';
}

function beVerb(name: string | null | undefined): string {
  return PLURAL_SPECIES.has((name ?? '').trim()) ? 'are' : 'is';
}

/** "today", "tomorrow", "in 7 days" — the countdown, spoken. */
export function whenPhrase(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/**
 * What is open, as a sentence.
 *
 * One or two species get named, because a name is worth more than a count
 * ("state the thing before the number"). Past two the sentence would wrap to
 * four lines at headline size, so it names the first two and counts the rest
 * — still leading with the things.
 */
export function todaySentence(names: string[]): string {
  const n = names.map((s) => (s ?? '').trim()).filter((s) => s.length > 0);
  if (n.length === 0) return '';
  if (n.length === 1) return `${n[0]} ${beVerb(n[0])} open.`;
  if (n.length === 2) return `${n[0]} and ${n[1].toLowerCase()} are open.`;
  return `${n[0]}, ${n[1].toLowerCase()} and ${n.length - 2} more are open.`;
}

/** The next opener as the same kind of sentence, for when nothing is open. */
export function nextOpenerSentence(speciesName: string, days: number): string {
  return `${speciesName} ${openVerb(speciesName)} ${whenPhrase(days)}.`;
}

/**
 * The headline steps down as it lengthens, so a six-species day and a
 * one-species day both read as one object rather than one of them running off
 * the screen. Thresholds are character counts because the headline is tightly
 * tracked and close to even-width at this weight.
 */
/**
 * Where the next opener actually is, when that is narrower than the state.
 *
 * The headline says what opens and when; it does not have room for a park
 * name, and a 40pt serif is the wrong place for one anyway. This is the quiet
 * line underneath. Statewide seasons get nothing, which is most of them.
 *
 * Keyed on zone_type rather than the zone's name: a zone called "Statewide"
 * is not what decides it.
 */
export function zoneNote(zoneName?: string | null, zoneType?: string | null): string {
  if (zoneType === 'statewide') return '';
  const z = (zoneName ?? '').trim();
  return z ? `at ${z}` : '';
}

export function headlineSize(sentence: string): number {
  if (sentence.length <= 24) return 40;
  if (sentence.length <= 42) return 34;
  return 28;
}

/**
 * The state's own shooting-hours rule, said in words.
 *
 * Always derived from the offsets the window was actually computed with
 * (src/assets/legal-light.json), never assumed. Most states are 30/30, but
 * Connecticut is 30/0 and Arizona is sunrise-to-sunset — printing "30 minutes
 * either side" in Phoenix would be a wrong answer about the law, which is the
 * one kind of wrong this app cannot afford.
 */
export function lightRuleNote(before: number, after: number): string {
  if (before === 0 && after === 0) return 'sunrise to sunset';
  if (before === after) return `${before} minutes either side of the sun`;
  if (after === 0) return `${before} min before sunrise, to sunset`;
  if (before === 0) return `sunrise, to ${after} min after sunset`;
  return `${before} min before sunrise, ${after} after sunset`;
}
