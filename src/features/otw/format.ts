/**
 * Turning a fishing rule into the two lines a ledger row shows.
 *
 * Pure, and tested, because this is where a correct row in the database
 * becomes a wrong sentence on a phone. Georgia corrected the schema three
 * times before any data loaded, and each correction exists to stop a specific
 * wrong answer. The formatters have to honour all three:
 *
 *   1. AN AGGREGATE LIMIT IS SHARED. "10 black bass" across ten species is
 *      ten fish between them, not ten of each. Printing "10/day" beside a
 *      list of ten species invites the wrong reading, so limit_basis is said
 *      out loud whenever more than one species shares a number.
 *
 *   2. A RULE WINDOW IS NOT A SEASON. "Nov 1 - May 14" on a delayed-harvest
 *      rule is when the RULE applies. The water is open all year. Nothing
 *      here may render a window as a closure.
 *
 *   3. "NO LIMIT" IS AN ANSWER AND "UNKNOWN" IS NOT. daily_limit_kind
 *      distinguishes them, and a null daily_limit means different things
 *      under each.
 */
import type {
  DailyLimitKind,
  FishingRestriction,
  LimitBasis,
  SizeRule,
} from '@/lib/database.types';

export type RuleForDisplay = {
  waterName: string | null;
  speciesNames: string[];
  limitBasis: LimitBasis;
  dailyLimitKind: DailyLimitKind;
  dailyLimit: number | null;
  sizeRule: SizeRule;
  minLengthInches: number | null;
  maxLengthInches: number | null;
  trophyAllowance: number | null;
  trophyMinLengthInches: number | null;
  restrictions: FishingRestriction[];
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

/** How each restriction reads in a sentence. */
const RESTRICTION_WORDS: Record<FishingRestriction, string> = {
  artificial_only: 'artificial lures only',
  flies_only: 'flies only',
  single_hook: 'single hook',
  barbless: 'barbless',
  no_live_bait: 'no live bait',
  one_pole_handheld: 'one pole, handheld',
  catch_and_release: 'catch & release',
  reservation_required: 'reservation required',
  daylight_only: 'daylight only',
  no_night_fishing: 'no night fishing',
  youth_senior_disabled_only: 'youth, senior & disabled only',
  trout_licence_required: 'trout licence required',
};

/** "Brook, Brown and Rainbow trout" -> the title of a ledger row. */
export function speciesPhrase(names: string[]): string {
  const n = names.map((s) => (s ?? '').trim()).filter(Boolean);
  if (n.length === 0) return '';
  if (n.length === 1) return n[0];
  if (n.length === 2) return `${n[0]} & ${n[1].toLowerCase()}`;
  if (n.length === 3) return `${n[0]}, ${n[1].toLowerCase()} & ${n[2].toLowerCase()}`;
  // Past three the list stops being readable and starts being a wall.
  return `${n[0]}, ${n[1].toLowerCase()} & ${n.length - 2} more`;
}

/** A length as printed: 22, not 22.00. */
export function inches(v: number | null): string | null {
  if (v === null || !Number.isFinite(v)) return null;
  const n = Number(v);
  return Number.isInteger(n) ? `${n}"` : `${n.toFixed(1)}"`;
}

/**
 * The daily limit, said so the basis cannot be mistaken.
 *
 * This is correction 1. With several species sharing one number, "10/day"
 * alone reads as ten of each.
 */
export function limitPhrase(rule: RuleForDisplay): string | null {
  const several = rule.speciesNames.length > 1;
  switch (rule.dailyLimitKind) {
    case 'prohibited':
      return 'May not be taken';
    case 'no_limit':
      return 'No daily limit';
    case 'unknown':
      // Say nothing rather than imply there is no limit. A page about gear
      // rules says nothing about limits, and silence is not permission.
      return null;
    case 'count': {
      if (rule.dailyLimit === null || !Number.isFinite(rule.dailyLimit)) return null;
      const n = rule.dailyLimit;
      if (!several) return `${n}/day`;
      return rule.limitBasis === 'aggregate' ? `${n}/day combined` : `${n}/day each`;
    }
    default:
      return null;
  }
}

/** The size rule, or null when the document set none. */
export function sizePhrase(rule: RuleForDisplay): string | null {
  const min = inches(rule.minLengthInches);
  const max = inches(rule.maxLengthInches);
  switch (rule.sizeRule) {
    case 'minimum':
      return min ? `${min} minimum` : null;
    case 'maximum':
      return max ? `${max} maximum` : null;
    case 'slot_release':
      return min && max ? `release ${min}–${max}` : null;
    case 'slot_keep':
      return min && max ? `keep ${min}–${max} only` : null;
    case 'see_notes':
      return 'special size rule';
    case 'none':
      // A STATEMENT, and often the entire content of the rule: Georgia names
      // Lake Blue Ridge, Lake Burton and Lake Juliette as having no minimum
      // on largemouth bass, against a statewide 12". Rendering that as null
      // -- which this did until migration 20261212000000 gave `unknown` a
      // value of its own -- left those three cards blank, so the only
      // largemouth size rule visible in the app was the statewide one the
      // lakes exist to cancel.
      return 'No size limit';
    case 'unknown':
    default:
      // Silence, because the source did not address size. Saying "no size
      // limit" here would invent permission; the statewide rule still
      // applies and resolve.ts is what surfaces it.
      return null;
  }
}

/** "only 2 over 22\"" — a trophy allowance needs the length it is measured against. */
export function trophyPhrase(rule: RuleForDisplay): string | null {
  if (rule.trophyAllowance === null) return null;
  const len = inches(rule.trophyMinLengthInches);
  return len ? `only ${rule.trophyAllowance} over ${len}` : `only ${rule.trophyAllowance} oversize`;
}

export function restrictionPhrase(restrictions: FishingRestriction[]): string | null {
  const words = (restrictions ?? []).map((r) => RESTRICTION_WORDS[r]).filter(Boolean);
  return words.length ? words.join(' · ') : null;
}

/**
 * The subtitle: limit, size, trophy and restrictions, in that order.
 *
 * Order is deliberate -- how many, then how big, then how you may fish.
 */
export function ruleSubtitle(rule: RuleForDisplay): string {
  return [limitPhrase(rule), sizePhrase(rule), trophyPhrase(rule), restrictionPhrase(rule.restrictions)]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Whether a rule is in force on a given day.
 *
 * This is correction 2, and the single most dangerous function here. A rule
 * window is NOT a season: a rule that is not in force does not mean the water
 * is shut. The caller must phrase the false case as "the rule does not apply
 * today", never as "closed".
 *
 * Windows may wrap the new year (Nov 1 to May 14), and that is the common
 * shape for delayed harvest, so a naive from <= d <= to is wrong half the
 * year.
 */
export function ruleInForce(rule: RuleForDisplay, todayISO: string): boolean {
  const { effectiveFrom: from, effectiveTo: to } = rule;
  // No window at all means the rule applies all year, which is the common case.
  if (!from || !to) return true;
  // Compare month-day so an annually recurring window works in any year.
  const md = (iso: string) => iso.slice(5, 10);
  const d = md(todayISO);
  const a = md(from);
  const b = md(to);
  return a <= b ? d >= a && d <= b : d >= a || d <= b;
}

/** How a rule window reads to someone, when there is one. */
export function windowPhrase(rule: RuleForDisplay): string | null {
  const { effectiveFrom: from, effectiveTo: to } = rule;
  if (!from || !to) return null;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmt = (iso: string) => {
    const [, m, d] = iso.split('-').map(Number);
    return `${MONTHS[m - 1]} ${d}`;
  };
  return `${fmt(from)} – ${fmt(to)}`;
}
