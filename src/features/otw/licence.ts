/**
 * How many days are left on a fishing licence.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT `new Date(expiresOn) - Date.now()`
 *
 * `user_licenses.expires_on` is a SQL `date` -- "2027-03-31", a calendar day
 * with no time and no zone. `new Date('2027-03-31')` parses it as midnight
 * UTC, which is 7pm on the 30th in Georgia. Subtracting that from a local
 * `now` and dividing by 86400000 gives a number that is right for most of the
 * day and wrong for the rest of it, and the hours it is wrong are the evening
 * -- when somebody is checking whether they can fish tomorrow morning.
 *
 * A licence expires at the end of its day. The only correct question is how
 * many CALENDAR days separate today from that date in the reader's own zone,
 * so both sides are reduced to year/month/day and compared as such. No
 * arithmetic ever crosses a timezone or a DST boundary.
 *
 *   daysUntil('2027-03-31', 30 March, 11pm local) === 1   ("expires tomorrow")
 *   daysUntil('2027-03-31', 31 March, 11pm local) === 0   (last day, still valid)
 *   daysUntil('2027-03-31', 1 April,  1am local) === -1   (expired)
 *
 * ---------------------------------------------------------------------------
 * WHY A COMBINATION LICENCE WINS
 *
 * `user_licenses` is keyed (user_id, state_id, kind), so somebody can hold
 * both a lapsed `fishing` licence and a current `combination` one. They are
 * licensed to fish on the later of the two dates -- a combination licence
 * covers fishing -- so the banner must read the LATEST expiry among the kinds
 * that permit fishing, not the first row it happens to receive. Taking the
 * earliest would nag a licensed angler every day about a licence they have
 * already replaced.
 *
 * `hunting` is not one of those kinds and is ignored here.
 */

/** The licence kinds that let you fish. `hunting` does not. */
export const FISHING_KINDS = ['fishing', 'combination'] as const;
export type FishingKind = (typeof FISHING_KINDS)[number];

export type LicenceLike = {
  kind: string;
  expires_on: string | null;
};

/** Year, month and day of a `YYYY-MM-DD` string, or null if it is not one. */
export function parseDateOnly(value: string | null | undefined): [number, number, number] | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  // Round-trip through a UTC date to reject 2027-02-30 and friends, which
  // would otherwise roll silently into March and move an expiry.
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return [y, mo, d];
}

/**
 * Whole calendar days from `now`'s local date to `expiresOn`.
 *
 * 0 means it expires today and is still valid; negative means it has lapsed.
 * null means we do not know, and the banner shows nothing rather than guessing.
 */
export function daysUntil(expiresOn: string | null | undefined, now: Date): number | null {
  const parts = parseDateOnly(expiresOn);
  if (!parts) return null;
  const [y, mo, d] = parts;
  // Both sides as UTC midnights of their calendar day. The expiry never had a
  // zone, and `now` is reduced to the day the reader is actually living in.
  const end = Date.UTC(y, mo - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((end - today) / 86_400_000);
}

/**
 * The expiry that actually governs whether this person may fish.
 *
 * The latest date among licences that permit fishing. Null when they hold
 * none, which is a real answer: we do not know when their licence runs out
 * because we have never been told they have one.
 */
export function governingExpiry(licences: readonly LicenceLike[] | null | undefined): string | null {
  if (!licences || licences.length === 0) return null;
  let best: string | null = null;
  let bestKey = -Infinity;
  for (const l of licences) {
    if (!(FISHING_KINDS as readonly string[]).includes(l.kind)) continue;
    const parts = parseDateOnly(l.expires_on);
    if (!parts) continue;
    const key = Date.UTC(parts[0], parts[1] - 1, parts[2]);
    if (key > bestKey) {
      bestKey = key;
      best = l.expires_on;
    }
  }
  return best;
}

/** Days left on the governing licence, or null when there is nothing to say. */
export function licenceDaysLeft(
  licences: readonly LicenceLike[] | null | undefined,
  now: Date,
): number | null {
  return daysUntil(governingExpiry(licences), now);
}
