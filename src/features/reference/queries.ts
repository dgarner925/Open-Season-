import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { daysUntil } from '@/lib/date';
import { drawTitle } from '@/lib/titles';
import type { SpeciesRow, StateRow } from '@/lib/database.types';
import { useFollows } from '@/features/follows/queries';
import type {
  ApplicationWindowWithRefs,
  CountdownItem,
  RegulationSummaryWithRefs,
  SeasonWithRefs,
} from './types';

const SEASON_SELECT =
  '*, state:states(id,code,name,license_url), species:species(id,key,name), zone:zones(id,name,type), source:sources(id,agency_name,url)';
const WINDOW_SELECT = SEASON_SELECT;
const REG_SELECT =
  '*, state:states(id,code,name,license_url), species:species(id,key,name), source:sources(id,agency_name,url)';

/** Active states (world-readable). */
export function useActiveStates() {
  return useQuery({
    queryKey: ['states', 'active'],
    queryFn: async (): Promise<StateRow[]> => {
      const { data, error } = await supabase.from('states').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSpecies() {
  return useQuery({
    queryKey: ['species'],
    queryFn: async (): Promise<SpeciesRow[]> => {
      const { data, error } = await supabase.from('species').select('*').order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** The species that are actually huntable in a given state (from state_species). */
export function useStateSpecies(stateId: string | null | undefined) {
  return useQuery({
    queryKey: ['state_species', stateId],
    enabled: Boolean(stateId),
    queryFn: async (): Promise<SpeciesRow[]> => {
      const { data, error } = await supabase
        .from('state_species')
        .select('species:species(*)')
        .eq('state_id', stateId!);
      if (error) throw error;
      const rows = ((data ?? []).map((r: any) => r.species).filter(Boolean)) as SpeciesRow[];
      return rows.sort((a, b) => a.sort_order - b.sort_order);
    },
  });
}

/** Union of species huntable across several states (deduped) — for onboarding. */
export function useStateSpeciesMulti(stateIds: string[]) {
  const key = [...stateIds].sort();
  return useQuery({
    queryKey: ['state_species', 'multi', key],
    enabled: stateIds.length > 0,
    queryFn: async (): Promise<SpeciesRow[]> => {
      const { data, error } = await supabase
        .from('state_species')
        .select('species:species(*)')
        .in('state_id', stateIds);
      if (error) throw error;
      const byId = new Map<string, SpeciesRow>();
      for (const r of data ?? []) {
        const sp = (r as any).species as SpeciesRow | null;
        if (sp) byId.set(sp.id, sp);
      }
      return [...byId.values()].sort((a, b) => a.sort_order - b.sort_order);
    },
  });
}

/** Filter a list of rows to the exact (state, species) pairs the user follows. */
function keepFollowed<T extends { state_id: string; species_id: string }>(
  rows: T[],
  pairs: Set<string>,
): T[] {
  return rows.filter((r) => pairs.has(`${r.state_id}:${r.species_id}`));
}

function followPairs(follows: { state_id: string; species_id: string }[]): {
  pairs: Set<string>;
  stateIds: string[];
  speciesIds: string[];
} {
  return {
    pairs: new Set(follows.map((f) => `${f.state_id}:${f.species_id}`)),
    stateIds: [...new Set(follows.map((f) => f.state_id))],
    speciesIds: [...new Set(follows.map((f) => f.species_id))],
  };
}

/** Published seasons for the user's followed state+species combos. */
/**
 * Weekend discovery for the brief card: seasons opening in [fromISO, toISO]
 * across the given states, followed or not (the card filters followed pairs
 * out — those already speak through the followed lines). Mirrors the push's
 * priority-4 discovery arm.
 */
export function useWeekendStateOpeners(stateIds: string[], fromISO: string, toISO: string) {
  return useQuery({
    queryKey: ['weekend-openers', [...stateIds].sort(), fromISO, toISO],
    enabled: stateIds.length > 0,
    queryFn: async (): Promise<SeasonWithRefs[]> => {
      const { data, error } = await supabase
        .from('seasons')
        .select(SEASON_SELECT)
        .in('state_id', stateIds)
        .eq('status', 'published')
        .gte('open_date', fromISO)
        .lte('open_date', toISO)
        .order('open_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SeasonWithRefs[];
    },
  });
}

export function useFollowedSeasons() {
  const { data: follows = [] } = useFollows();
  return useQuery({
    queryKey: ['seasons', 'followed', follows.map((f) => f.id).sort()],
    enabled: follows.length > 0,
    queryFn: async (): Promise<SeasonWithRefs[]> => {
      const { pairs, stateIds, speciesIds } = followPairs(follows);
      const { data, error } = await supabase
        .from('seasons')
        .select(SEASON_SELECT)
        .in('state_id', stateIds)
        .in('species_id', speciesIds)
        .order('open_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return keepFollowed((data ?? []) as unknown as SeasonWithRefs[], pairs);
    },
  });
}

export function useFollowedWindows() {
  const { data: follows = [] } = useFollows();
  return useQuery({
    queryKey: ['windows', 'followed', follows.map((f) => f.id).sort()],
    enabled: follows.length > 0,
    queryFn: async (): Promise<ApplicationWindowWithRefs[]> => {
      const { pairs, stateIds, speciesIds } = followPairs(follows);
      const { data, error } = await supabase
        .from('application_windows')
        .select(WINDOW_SELECT)
        .in('state_id', stateIds)
        .in('species_id', speciesIds)
        .order('closes_at', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return keepFollowed((data ?? []) as unknown as ApplicationWindowWithRefs[], pairs);
    },
  });
}

export function useFollowedRegs() {
  const { data: follows = [] } = useFollows();
  return useQuery({
    queryKey: ['regs', 'followed', follows.map((f) => f.id).sort()],
    enabled: follows.length > 0,
    queryFn: async (): Promise<RegulationSummaryWithRefs[]> => {
      const { pairs, stateIds, speciesIds } = followPairs(follows);
      const { data, error } = await supabase
        .from('regulation_summaries')
        .select(REG_SELECT)
        .in('state_id', stateIds)
        .in('species_id', speciesIds);
      if (error) throw error;
      return keepFollowed((data ?? []) as unknown as RegulationSummaryWithRefs[], pairs);
    },
  });
}

export function useSeasonById(id: string | undefined) {
  return useQuery({
    queryKey: ['season', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<SeasonWithRefs | null> => {
      const { data, error } = await supabase.from('seasons').select(SEASON_SELECT).eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as unknown as SeasonWithRefs | null;
    },
  });
}

export function useRegById(id: string | undefined) {
  return useQuery({
    queryKey: ['reg', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<RegulationSummaryWithRefs | null> => {
      const { data, error } = await supabase.from('regulation_summaries').select(REG_SELECT).eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as unknown as RegulationSummaryWithRefs | null;
    },
  });
}

export function useWindowById(id: string | undefined) {
  return useQuery({
    queryKey: ['window', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<ApplicationWindowWithRefs | null> => {
      const { data, error } = await supabase.from('application_windows').select(WINDOW_SELECT).eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as unknown as ApplicationWindowWithRefs | null;
    },
  });
}

/**
 * The home screen's "Next up": upcoming openers + deadlines across all followed
 * items, unified and sorted by soonest. Past events are dropped.
 */
export function useUpcomingCountdown(limit = 12) {
  const seasons = useFollowedSeasons();
  const windows = useFollowedWindows();

  const isLoading = seasons.isLoading || windows.isLoading;
  const items: CountdownItem[] = [];

  for (const s of seasons.data ?? []) {
    const d = daysUntil(s.open_date);
    if (s.open_date && d !== null && d >= 0) {
      items.push({
        kind: 'opener',
        id: s.id,
        title: `${s.state?.code ?? ''} ${s.species?.name ?? ''} — ${methodLabel(s.method)}`.trim(),
        subtitle: s.zone?.name ?? 'Season opens',
        speciesKey: s.species?.key ?? 'default',
        stateCode: s.state?.code ?? '',
        date: s.open_date,
        daysUntil: d,
      });
    }
  }
  for (const w of windows.data ?? []) {
    const d = daysUntil(w.closes_at);
    if (w.closes_at && d !== null && d >= 0) {
      items.push({
        kind: 'deadline',
        id: w.id,
        title: `${w.state?.code ?? ''} ${drawTitle(w.species?.name, w.name)}`.trim(),
        subtitle: 'Application deadline',
        speciesKey: w.species?.key ?? 'default',
        stateCode: w.state?.code ?? '',
        date: w.closes_at,
        daysUntil: d,
      });
    }
  }

  items.sort((a, b) => a.daysUntil - b.daysUntil);
  return { isLoading, items: items.slice(0, limit) };
}

function methodLabel(method: string): string {
  return method.charAt(0).toUpperCase() + method.slice(1);
}
