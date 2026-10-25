/**
 * Year-over-year regulation diffing.
 *
 * The comparison is pure code — no model touches it. A season's identity
 * across years is (species, zone, method, label); matching rows are compared
 * field by field, unmatched new rows are additions, unmatched old rows are
 * removals. The model's only job, later, is to put one of these objects into a
 * sentence, and it may not introduce a date this file didn't produce.
 */

export type SeasonRow = {
  id: string;
  species_id: string;
  species_name: string;
  zone_id: string | null;
  zone_name: string | null;
  method: string;
  label: string | null;
  open_date: string | null;
  close_date: string | null;
  bag_limit_summary: string | null;
  notes: string | null;
  season_year: number;
};

export type ChangeType = 'added' | 'removed' | 'modified';

export type FieldDiff = { field: string; old: string | null; new: string | null };

export type RegChange = {
  change_type: ChangeType;
  species_name: string;
  zone_name: string | null;
  method: string;
  label: string | null;
  old_id: string | null;
  new_id: string | null;
  old_year: number | null;
  new_year: number | null;
  field_diffs: FieldDiff[];
};

/** What makes a season "the same season" a year later. */
export function identity(r: SeasonRow): string {
  const label = (r.label ?? '').trim().toLowerCase();
  return [r.species_id, r.zone_id ?? '-', r.method, label].join('|');
}

const COMPARED: (keyof SeasonRow)[] = ['open_date', 'close_date', 'bag_limit_summary', 'notes'];

export function diffSeasonYears(oldRows: SeasonRow[], newRows: SeasonRow[]): RegChange[] {
  const oldBy = new Map(oldRows.map((r) => [identity(r), r]));
  const newBy = new Map(newRows.map((r) => [identity(r), r]));
  const changes: RegChange[] = [];

  for (const [key, next] of newBy) {
    const prev = oldBy.get(key);
    if (!prev) {
      changes.push({
        change_type: 'added',
        species_name: next.species_name,
        zone_name: next.zone_name,
        method: next.method,
        label: next.label,
        old_id: null,
        new_id: next.id,
        old_year: null,
        new_year: next.season_year,
        field_diffs: [
          { field: 'open_date', old: null, new: next.open_date },
          { field: 'close_date', old: null, new: next.close_date },
        ].filter((d) => d.new !== null),
      });
      continue;
    }
    const diffs: FieldDiff[] = [];
    for (const f of COMPARED) {
      const a = (prev[f] ?? null) as string | null;
      const b = (next[f] ?? null) as string | null;
      if ((a ?? '') !== (b ?? '')) diffs.push({ field: f, old: a, new: b });
    }
    if (diffs.length > 0) {
      changes.push({
        change_type: 'modified',
        species_name: next.species_name,
        zone_name: next.zone_name,
        method: next.method,
        label: next.label,
        old_id: prev.id,
        new_id: next.id,
        old_year: prev.season_year,
        new_year: next.season_year,
        field_diffs: diffs,
      });
    }
  }

  for (const [key, prev] of oldBy) {
    if (newBy.has(key)) continue;
    changes.push({
      change_type: 'removed',
      species_name: prev.species_name,
      zone_name: prev.zone_name,
      method: prev.method,
      label: prev.label,
      old_id: prev.id,
      new_id: null,
      old_year: prev.season_year,
      new_year: null,
      field_diffs: [
        { field: 'open_date', old: prev.open_date, new: null },
        { field: 'close_date', old: prev.close_date, new: null },
      ].filter((d) => d.old !== null),
    });
  }

  // Biggest news first: things that vanished, then new things, then shifts.
  const rank: Record<ChangeType, number> = { removed: 0, added: 1, modified: 2 };
  return changes.sort(
    (a, b) => rank[a.change_type] - rank[b.change_type] || a.species_name.localeCompare(b.species_name),
  );
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function spokenDate(iso: string | null): string {
  if (!iso) return 'an unposted date';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${MON[Number(m[2]) - 1]} ${Number(m[3])}`;
}

/** How the season is named in a sentence: "Deer archery, Zone B". */
export function describeSeason(c: RegChange): string {
  const bits = [c.species_name, c.label ?? c.method].filter(Boolean);
  const base = bits.join(' ');
  return c.zone_name && c.zone_name !== 'Statewide' ? `${base}, ${c.zone_name}` : base;
}

/**
 * The change, stated plainly without a model. This is the fallback when the
 * model is unavailable or ungrounded, and the yardstick its version is held to.
 */
export function composeChangeNote(c: RegChange, stateName: string): string {
  const what = describeSeason(c);
  if (c.change_type === 'added') {
    const open = c.field_diffs.find((d) => d.field === 'open_date')?.new ?? null;
    const close = c.field_diffs.find((d) => d.field === 'close_date')?.new ?? null;
    return open
      ? `${stateName} added ${what}, ${spokenDate(open)}${close ? ` to ${spokenDate(close)}` : ''}.`
      : `${stateName} added ${what}.`;
  }
  if (c.change_type === 'removed') {
    return `${stateName} dropped ${what}.`;
  }

  const open = c.field_diffs.find((d) => d.field === 'open_date');
  const close = c.field_diffs.find((d) => d.field === 'close_date');
  if (open && close) {
    return `${stateName} moved ${what} from ${spokenDate(open.old)}–${spokenDate(close.old)} to ${spokenDate(open.new)}–${spokenDate(close.new)}.`;
  }
  if (open) return `${stateName} moved the ${what} opener from ${spokenDate(open.old)} to ${spokenDate(open.new)}.`;
  if (close) return `${stateName} moved the ${what} closer from ${spokenDate(close.old)} to ${spokenDate(close.new)}.`;

  const bag = c.field_diffs.find((d) => d.field === 'bag_limit_summary');
  if (bag) return `${stateName} changed the ${what} bag limit.`;
  return `${stateName} updated ${what}.`;
}

/** Is this change worth telling a hunter about? Note-only edits are noise. */
export function isNoteworthy(c: RegChange): boolean {
  if (c.change_type !== 'modified') return true;
  return c.field_diffs.some((d) => d.field !== 'notes');
}
