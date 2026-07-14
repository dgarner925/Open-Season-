import type {
  ApplicationWindowRow,
  RegulationSummaryRow,
  SeasonRow,
  SourceRow,
  SpeciesRow,
  StateRow,
  ZoneRow,
} from '@/lib/database.types';

/** Rows enriched with their joined reference objects (from Supabase nested selects). */
export type SeasonWithRefs = SeasonRow & {
  state: Pick<StateRow, 'id' | 'code' | 'name' | 'license_url'> | null;
  species: Pick<SpeciesRow, 'id' | 'key' | 'name'> | null;
  zone: Pick<ZoneRow, 'id' | 'name' | 'type'> | null;
  source: Pick<SourceRow, 'id' | 'agency_name' | 'url'> | null;
};

export type ApplicationWindowWithRefs = ApplicationWindowRow & {
  state: Pick<StateRow, 'id' | 'code' | 'name' | 'license_url'> | null;
  species: Pick<SpeciesRow, 'id' | 'key' | 'name'> | null;
  zone: Pick<ZoneRow, 'id' | 'name' | 'type'> | null;
  source: Pick<SourceRow, 'id' | 'agency_name' | 'url'> | null;
};

export type RegulationSummaryWithRefs = RegulationSummaryRow & {
  state: Pick<StateRow, 'id' | 'code' | 'name' | 'license_url'> | null;
  species: Pick<SpeciesRow, 'id' | 'key' | 'name'> | null;
  source: Pick<SourceRow, 'id' | 'agency_name' | 'url'> | null;
};

/** A normalized "next up" item unifying openers and deadlines for the home screen. */
export type CountdownItem = {
  kind: 'opener' | 'deadline';
  id: string; // underlying season/window id
  title: string; // e.g. 'Georgia Deer — Firearm'
  subtitle: string; // e.g. 'Statewide' or 'Opens' / 'Application closes'
  speciesKey: string;
  stateCode: string;
  date: string; // YYYY-MM-DD
  daysUntil: number;
};
