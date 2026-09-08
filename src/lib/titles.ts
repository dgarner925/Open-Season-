function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compose a draw/permit title without doubling the species. If the extracted
 * name already names the species anywhere as a whole word — "Elk Permit",
 * "Archery Mule Deer", "Gun Deer Either Sex" — it's self-describing, so we use
 * it as-is. Otherwise we prefix the species ("Elk" + "Primary Draw").
 */
export function drawTitle(speciesName: string | undefined | null, name: string | undefined | null): string {
  const species = (speciesName ?? '').trim();
  const n = (name ?? '').trim();
  if (!n) return `${species} Draw`.trim();
  if (species && new RegExp(`\\b${escapeRegExp(species)}\\b`, 'i').test(n)) return n;
  // The head noun is enough: "Bobwhite quail" + "Quail Quota Hunts" is
  // already self-describing — prefixing made "Bobwhite quail Quail Quota
  // Hunts" (David's screenshot, 2026-09-07).
  const head = species.split(/\s+/).pop() ?? '';
  if (head && new RegExp(`\\b${escapeRegExp(head)}\\b`, 'i').test(n)) return n;
  return `${species} ${n}`.trim();
}
