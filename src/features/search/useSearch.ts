/**
 * All-states search: one lightweight fetch of every published season, draw
 * window, and federal permit hunt (~1,700 rows total), indexed in memory.
 * The query understands species (fuzzy — "whitetail" finds White-tailed
 * deer), states (name or code), months, and "open now". No per-keystroke
 * network; results are instant after the first load.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { FederalPermitHuntRow } from '@/lib/database.types';

export type SearchResultType = 'season' | 'deadline' | 'permit';

export type SearchResult = {
  type: SearchResultType;
  id: string;
  title: string;
  caption: string;
  stateCode: string | null;
  speciesName: string | null;
  openDate: string | null;
  closeDate: string | null;
  url?: string;
  /** Normalized haystack for text matching. */
  hay: string;
};

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function fmt(d: string | null): string {
  if (!d) return 'TBD';
  const [y, m, day] = d.split('-').map(Number);
  return `${MONTHS[m - 1].slice(0, 3).replace(/^./, (c) => c.toUpperCase())} ${day}`;
}

export function useSearchCorpus() {
  return useQuery({
    queryKey: ['search-corpus'],
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<{ results: SearchResult[]; states: { code: string; name: string }[] }> => {
      const [seasons, windows, permits, states] = await Promise.all([
        supabase
          .from('seasons')
          .select('id,label,method,open_date,close_date,state:states(code,name),species:species(name)')
          .eq('status', 'published')
          .limit(3000),
        supabase
          .from('application_windows')
          .select('id,name,closes_at,state:states(code,name),species:species(name)')
          .eq('status', 'published')
          .limit(1000),
        supabase.from('federal_permit_hunts').select('*').limit(500),
        supabase.from('states').select('code,name').eq('is_active', true),
      ]);
      const err = seasons.error ?? windows.error ?? permits.error ?? states.error;
      if (err) throw err;

      const out: SearchResult[] = [];
      for (const s of (seasons.data ?? []) as any[]) {
        const label = s.label ?? s.method.charAt(0).toUpperCase() + s.method.slice(1);
        out.push({
          type: 'season',
          id: s.id,
          title: `${s.species?.name ?? ''} · ${label}`,
          caption: `${s.state?.code ?? ''} · ${fmt(s.open_date)} – ${fmt(s.close_date)}`,
          stateCode: s.state?.code ?? null,
          speciesName: s.species?.name ?? null,
          openDate: s.open_date,
          closeDate: s.close_date,
          hay: norm(`${s.species?.name} ${label} ${s.method} ${s.state?.name} ${s.state?.code}`),
        });
      }
      for (const w of (windows.data ?? []) as any[]) {
        out.push({
          type: 'deadline',
          id: w.id,
          title: `${w.species?.name ?? ''} · ${w.name ?? 'Draw'}`,
          caption: `${w.state?.code ?? ''} · closes ${fmt(w.closes_at)}`,
          stateCode: w.state?.code ?? null,
          speciesName: w.species?.name ?? null,
          openDate: w.closes_at,
          closeDate: w.closes_at,
          hay: norm(`${w.species?.name} ${w.name} draw deadline tag ${w.state?.name} ${w.state?.code}`),
        });
      }
      const stateByName = new Map((states.data ?? []).map((st: any) => [st.name, st.code]));
      for (const p of (permits.data ?? []) as FederalPermitHuntRow[]) {
        const code = p.state_code ? (stateByName.get(p.state_code) ?? p.state_code) : null;
        out.push({
          type: 'permit',
          id: p.id,
          title: p.name,
          caption: `${p.agency ?? 'Federal'}${p.city ? ` · ${p.city}` : ''}`,
          stateCode: code && code.length === 2 ? code : null,
          speciesName: null,
          openDate: null,
          closeDate: null,
          url: p.url,
          hay: norm(`${p.name} ${p.agency} ${p.state_code} ${p.city} permit federal`),
        });
      }
      return { results: out, states: (states.data ?? []) as any[] };
    },
  });
}

export type SearchFilters = { openNow: boolean; myState: string | null; deadlinesOnly: boolean };

export function runSearch(
  corpus: SearchResult[],
  states: { code: string; name: string }[],
  rawQuery: string,
  filters: SearchFilters,
  todayISO: string,
): SearchResult[] {
  const words = rawQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);

  let month: number | null = null;
  let openNow = filters.openNow;
  let stateCode: string | null = filters.myState;
  const textTokens: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const mi = MONTHS.findIndex((m) => m === w || (w.length >= 3 && m.startsWith(w)));
    if (mi !== -1 && w.length >= 3) {
      month = mi + 1;
      continue;
    }
    if (w === 'open' || w === 'now' || w === 'today') {
      openNow = true;
      continue;
    }
    const st = states.find(
      (s) => s.code.toLowerCase() === w || norm(s.name) === norm(w) || (i + 1 < words.length && norm(s.name) === norm(w + words[i + 1])),
    );
    if (st) {
      stateCode = st.code;
      if (norm(st.name) === norm(w + (words[i + 1] ?? ''))) i++;
      continue;
    }
    textTokens.push(norm(w));
  }
  const text = textTokens.join('');

  const scored = corpus.filter((r) => {
    if (filters.deadlinesOnly && r.type !== 'deadline') return false;
    if (stateCode && r.stateCode !== stateCode) return false;
    if (text && !r.hay.includes(text)) return false;
    if (openNow) {
      if (r.type === 'permit') return !text ? false : true; // permits have no dates; keep only when explicitly searched
      if (!r.openDate || r.openDate > todayISO) return false;
      if (r.type === 'season' && r.closeDate && r.closeDate < todayISO) return false;
      if (r.type === 'deadline' && r.closeDate && r.closeDate < todayISO) return false;
    }
    if (month !== null) {
      if (!r.openDate) return false;
      const om = Number(r.openDate.split('-')[1]);
      const cm = r.closeDate ? Number(r.closeDate.split('-')[1]) : om;
      const oy = Number(r.openDate.split('-')[0]);
      const cy = r.closeDate ? Number(r.closeDate.split('-')[0]) : oy;
      const span = (cy - oy) * 12 + (cm - om);
      const inSpan = span >= 11 ? true : ((month - om + 12) % 12) <= ((cm - om + 12) % 12);
      if (!inSpan) return false;
    }
    return true;
  });

  // Upcoming (or open) first by date; permits last within equal footing.
  return scored.sort((a, b) => {
    const tw = (r: SearchResult) => (r.type === 'permit' ? 1 : 0);
    if (tw(a) !== tw(b)) return tw(a) - tw(b);
    const ad = a.openDate ?? '9999';
    const bd = b.openDate ?? '9999';
    const aPast = a.closeDate && a.closeDate < todayISO ? 1 : 0;
    const bPast = b.closeDate && b.closeDate < todayISO ? 1 : 0;
    if (aPast !== bPast) return aPast - bPast;
    return ad.localeCompare(bd);
  });
}

export function useSearchMemo(query: string, filters: SearchFilters) {
  const { data, isLoading } = useSearchCorpus();
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const results = useMemo(() => {
    if (!data) return [];
    if (!query.trim() && !filters.openNow && !filters.myState && !filters.deadlinesOnly) return [];
    return runSearch(data.results, data.states, query, filters, todayISO);
  }, [data, query, filters.openNow, filters.myState, filters.deadlinesOnly, todayISO]);
  return { results, isLoading, ready: Boolean(data) };
}
