/**
 * Is this proposal about the season we are in, or about last year's?
 *
 * On 2026-11-17 the review queue held 48 season proposals and 42 of them were
 * Wisconsin's 2025-26 dates. Nothing had gone wrong with the extraction: the
 * quote on the deer row was "Gun (Hunters with Disabilities): October 4 - 12,
 * 2025", which is genuinely on the page, genuinely supports the date, and
 * scored 0.95. The page was the problem -- eregulations.com still said "We've
 * included dates for the 2025-2026 season" a year after the agency moved on.
 *
 * Grounding asks "does the source say this?". It cannot ask "is the source
 * still true?". This module adds the second question, which is the only one
 * that catches a stale mirror.
 *
 * Pure TypeScript on purpose -- no Deno or Node APIs -- so the Edge Function
 * and the Vitest suite can both import it.
 */

/**
 * The season year a date in `today` belongs to.
 *
 * A hunting licence year is not a calendar year. Wisconsin's 2026 deer season
 * closes in January 2027, and a hunter reading the app on 2 January 2027 is
 * still inside the 2026 season -- so a 2026 row is current, not stale, and
 * rejecting it would delete the dates out from under the people using them.
 * January through to the end of April therefore still counts as the previous
 * year; from May, when agencies start publishing the coming autumn, the new
 * year has begun.
 */
export function licenceYear(today: string): number {
  const m = /^(\d{4})-(\d{2})/.exec(today);
  if (!m) return NaN;
  const year = Number(m[1]);
  const month = Number(m[2]);
  return month <= 4 ? year - 1 : year;
}

export type YearVerdict = { stale: boolean; reason?: string };

/**
 * Whether a proposal's season year is far enough behind to be a stale source
 * rather than a late-breaking correction.
 *
 * One year behind the current licence year is the line. An agency revising
 * last season's record is a real thing and lands exactly one year back, so
 * this does not reject on `year < licenceYear` alone -- it rejects when the
 * source is behind AND the dates it carries have already been and gone.
 */
export function staleSeasonYear(
  seasonYear: number | null | undefined,
  today: string,
  closeDate?: string | null,
): YearVerdict {
  const current = licenceYear(today);
  if (!Number.isInteger(current)) return { stale: false };
  if (seasonYear === null || seasonYear === undefined || !Number.isInteger(seasonYear)) {
    return { stale: false };
  }
  if (seasonYear >= current) return { stale: false };
  // A season labelled last year whose close date is still ahead of us is a
  // real season running long, not a stale page.
  if (closeDate && closeDate >= today) return { stale: false };
  return {
    stale: true,
    reason:
      `season_year ${seasonYear} is behind the ${current} licence year` +
      (closeDate ? ` and closed on ${closeDate}` : '') +
      ' -- the source page is a year out of date',
  };
}

/**
 * The year a piece of quoted evidence names, if it names one.
 *
 * A source can carry the right season year in its own markup while the prose
 * quotes last year's dates, and the other way round. Reading the quote is a
 * second, independent check on the same question.
 */
export function yearInQuote(quote: string | null | undefined): number | null {
  if (!quote) return null;
  const years = [...String(quote).matchAll(/\b(19|20)\d{2}\b/g)].map((m) => Number(m[0]));
  if (!years.length) return null;
  // The latest year named: "October 4 - 12, 2025" has one, "2025-2026 season"
  // has two, and the later of the pair is the one that dates the document.
  return Math.max(...years);
}

/**
 * Both checks together, for a caller that has a proposal and its evidence.
 * Either one firing is enough -- they look at different things, and a source
 * that fails one is not to be trusted on the other.
 */
export function staleProposal(
  args: {
    seasonYear?: number | null;
    closeDate?: string | null;
    quote?: string | null;
  },
  today: string,
): YearVerdict {
  const byYear = staleSeasonYear(args.seasonYear, today, args.closeDate);
  if (byYear.stale) return byYear;

  const quoted = yearInQuote(args.quote);
  const current = licenceYear(today);
  if (quoted !== null && Number.isInteger(current) && quoted < current) {
    if (args.closeDate && args.closeDate >= today) return { stale: false };
    return {
      stale: true,
      reason: `the quoted evidence names ${quoted}, behind the ${current} licence year -- the source page is a year out of date`,
    };
  }
  return { stale: false };
}
