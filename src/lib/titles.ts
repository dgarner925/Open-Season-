/**
 * Compose a draw/permit title without doubling the species when the extracted
 * name already leads with it — e.g. species "Elk" + name "Elk Permit (special
 * permit draw)" should read "Elk Permit (special permit draw)", not
 * "Elk Elk Permit …".
 */
export function drawTitle(speciesName: string | undefined | null, name: string | undefined | null): string {
  const species = (speciesName ?? '').trim();
  const n = (name ?? '').trim();
  if (!n) return `${species} Draw`.trim();
  if (species && n.toLowerCase().startsWith(species.toLowerCase())) return n;
  return `${species} ${n}`.trim();
}
