/**
 * Grounding guards for Ask the Book.
 *
 * The model is never allowed to answer a regulation question from its own
 * knowledge — only from facts a tool call returned. The system prompt says so,
 * and this module enforces it in code: every date the answer mentions must
 * appear in the tool results that produced it, or the answer is rejected.
 *
 * Pure TypeScript on purpose — no Deno or Node APIs — so the Edge Function and
 * the Vitest suite can both import it.
 */

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Canonical form of one date: "2026-09-12" -> "sep 12". Month+day only — a
 *  season that moved years would still be caught by the ISO check below. */
function canonical(month: number, day: number): string {
  return `${MONTH_ABBR[month - 1]} ${day}`;
}

/**
 * Every way a known-good date may legitimately be written, so a correct answer
 * isn't rejected for spelling "2026-09-12" as "September 12".
 */
export function expandDate(iso: string): string[] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return [];
  const [, y, mm, dd] = m;
  const month = Number(mm);
  const day = Number(dd);
  if (month < 1 || month > 12) return [];
  return [
    iso.trim(),
    canonical(month, day),
    `${MONTH_NAMES[month - 1]} ${day}`,
    `${month}/${day}`,
    `${month}/${day}/${y}`,
    `${month}/${day}/${y.slice(2)}`,
  ];
}

/** Collect every ISO date appearing anywhere in a JSON-ish blob of tool results. */
export function allowedDatesFrom(toolResults: unknown): Set<string> {
  const text = typeof toolResults === 'string' ? toolResults : JSON.stringify(toolResults ?? '');
  const out = new Set<string>();
  for (const iso of text.match(/\d{4}-\d{2}-\d{2}/g) ?? []) {
    for (const form of expandDate(iso)) out.add(form.toLowerCase());
  }
  return out;
}

/**
 * Date-shaped mentions in a model answer, each normalized to the same canonical
 * forms as `expandDate` so the two can be compared.
 *
 * Returns the raw text alongside the normalized candidates, because a mention
 * is "supported" if ANY of its candidate forms is in the allowed set.
 */
export function extractDateMentions(answer: string): { raw: string; forms: string[] }[] {
  const mentions: { raw: string; forms: string[] }[] = [];
  const monthWord = `(?:${MONTH_NAMES.join('|')}|${MONTH_ABBR.join('|')})\\.?`;

  // "September 12", "Sep. 12", "Oct 9th"
  const wordFirst = new RegExp(`\\b(${monthWord})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'gi');
  // "12 September"
  const dayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthWord})\\b`, 'gi');
  // "9/12" or "9/12/2026"
  const numeric = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g;
  // bare ISO
  const isoRe = /\b\d{4}-\d{2}-\d{2}\b/g;

  const monthIndex = (word: string): number => {
    const w = word.toLowerCase().replace(/\.$/, '');
    const full = MONTH_NAMES.indexOf(w);
    if (full >= 0) return full + 1;
    const abbr = MONTH_ABBR.indexOf(w.slice(0, 3));
    return abbr >= 0 ? abbr + 1 : 0;
  };

  let m: RegExpExecArray | null;
  while ((m = wordFirst.exec(answer))) {
    const month = monthIndex(m[1]);
    if (month) mentions.push({ raw: m[0], forms: [canonical(month, Number(m[2])), `${month}/${Number(m[2])}`] });
  }
  while ((m = dayFirst.exec(answer))) {
    const month = monthIndex(m[2]);
    if (month) mentions.push({ raw: m[0], forms: [canonical(month, Number(m[1])), `${month}/${Number(m[1])}`] });
  }
  while ((m = numeric.exec(answer))) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      mentions.push({ raw: m[0], forms: [canonical(month, day), `${month}/${day}`] });
    }
  }
  while ((m = isoRe.exec(answer))) {
    mentions.push({ raw: m[0], forms: [m[0].toLowerCase(), ...expandDate(m[0]).map((f) => f.toLowerCase())] });
  }
  return mentions;
}

export type GroundingResult = { ok: boolean; unsupported: string[] };

/**
 * Reject an answer that states a date no tool call returned. This is the
 * backstop for the system prompt — a model that hallucinates "deer opens
 * September 10" when the database says the 12th never reaches the user.
 */
export function checkGrounding(answer: string, toolResults: unknown): GroundingResult {
  const allowed = allowedDatesFrom(toolResults);
  const unsupported: string[] = [];
  for (const mention of extractDateMentions(answer)) {
    const supported = mention.forms.some((f) => allowed.has(f.toLowerCase()));
    if (!supported && !unsupported.includes(mention.raw)) unsupported.push(mention.raw);
  }
  return { ok: unsupported.length === 0, unsupported };
}

/**
 * Does this input want a sentence back, or a list of matches? The Book's search
 * field serves both: question-shaped input routes to the model, everything else
 * goes to the existing on-device search, which is instant and free.
 */
export function looksLikeQuestion(input: string): boolean {
  const q = input.trim().toLowerCase();
  if (q.length < 8) return false;
  if (q.endsWith('?')) return true;
  const words = q.split(/\s+/);
  if (words.length < 3) return false;
  const openers = [
    'what', 'when', 'where', 'which', 'who', 'why', 'how', 'can', 'do', 'does',
    'is', 'are', 'am', 'should', 'may', 'must', 'will', 'did',
  ];
  if (openers.includes(words[0])) return true;
  // "tell me…", "explain…" — imperative asks that still want prose.
  return ['tell', 'explain', 'show'].includes(words[0]) && words.length >= 4;
}

/** Cache key input: same question asked any which way hits the same row. */
export function normalizeQuestion(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
