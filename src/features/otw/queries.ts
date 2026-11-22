/**
 * Reading the fishing data that is already in production.
 *
 * Georgia is loaded and hand-checked: 29 waters and 33 published rules,
 * transcribed from the agency pages by a person before the extractor existed,
 * precisely so there would be something true to measure against. These hooks
 * put that on the screen in place of placeholder.ts.
 *
 * ---------------------------------------------------------------------------
 * THE SPECIES GATE IS OPEN. THIS COMMENT USED TO SAY IT WAS SHUT.
 *
 * It said `species` was gated to `pursuit = 'hunting'` for anon and
 * authenticated -- a launch gate, so fishing names could not leak before the
 * data was ready. Checked against production on 2026-11-21:
 * `species_public_read` is `using (true)`, permissive, for anon and
 * authenticated, and there are 72 fishing species behind it. The gate is not
 * there, and the OTW ledger has been showing real Georgia rules.
 *
 * `speciesResolved` stays, demoted from load-bearing to defensive. Rendering
 * a rule whose subject did not resolve would be a row saying "15/day
 * combined" about nothing, and that is worth a guard whether or not a policy
 * is currently in the way. It is no longer the reason the Home has a
 * placeholder path -- it is a seatbelt.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { RuleForDisplay } from './format';
import type { FishingRuleRow, SpeciesRow, WaterRow } from '@/lib/database.types';

export type FishingRuleWithRefs = RuleForDisplay & {
  id: string;
  waterSlug: string | null;
  /** The state's own wording for a regulated stretch. Shown verbatim. */
  extentNote: string | null;
};

export type FishingRulesResult = {
  rules: FishingRuleWithRefs[];
  /**
   * False when the species table returned nothing, which today means the
   * launch gate is still closed. The caller must not render rules without
   * their species.
   */
  speciesResolved: boolean;
};

/** Fish species, which the launch gate currently hides. */
export function useFishSpecies() {
  return useQuery({
    queryKey: ['otw', 'species'],
    queryFn: async (): Promise<SpeciesRow[]> => {
      const { data, error } = await supabase
        .from('species')
        .select('*')
        .eq('pursuit', 'fishing')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60 * 60 * 1000,
  });
}

/** Published waters in one state. */
export function useWaters(stateCode: string | null | undefined) {
  return useQuery({
    enabled: !!stateCode,
    queryKey: ['otw', 'waters', stateCode],
    queryFn: async (): Promise<WaterRow[]> => {
      const { data: state, error: stateError } = await supabase
        .from('states')
        .select('id')
        .eq('code', stateCode!)
        .maybeSingle();
      if (stateError) throw stateError;
      if (!state) return [];

      const { data, error } = await supabase
        .from('waters')
        .select('*')
        .eq('state_id', state.id)
        .eq('status', 'published')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60 * 60 * 1000,
  });
}

/**
 * Published fishing rules in one state, with their water and species resolved.
 *
 * Three queries rather than one nested select, because the species join has
 * to go through fishing_rule_species and PostgREST's embedding of a
 * many-to-many through a join table is both awkward to read and silently
 * affected by RLS on the far side. Doing it explicitly makes the gate's
 * effect visible rather than mysterious.
 */
export function useFishingRules(stateCode: string | null | undefined) {
  return useQuery({
    enabled: !!stateCode,
    queryKey: ['otw', 'rules', stateCode],
    queryFn: async (): Promise<FishingRulesResult> => {
      const { data: state, error: stateError } = await supabase
        .from('states')
        .select('id')
        .eq('code', stateCode!)
        .maybeSingle();
      if (stateError) throw stateError;
      if (!state) return { rules: [], speciesResolved: true };

      const { data: ruleRows, error: ruleError } = await supabase
        .from('fishing_rules')
        .select('*')
        .eq('state_id', state.id)
        .eq('status', 'published');
      if (ruleError) throw ruleError;
      const rules = (ruleRows ?? []) as FishingRuleRow[];
      if (rules.length === 0) return { rules: [], speciesResolved: true };

      const ruleIds = rules.map((r) => r.id);
      const waterIds = Array.from(new Set(rules.map((r) => r.water_id).filter((x): x is string => !!x)));

      const [linkRes, waterRes, speciesRes] = await Promise.all([
        supabase.from('fishing_rule_species').select('rule_id, species_id').in('rule_id', ruleIds),
        waterIds.length
          ? supabase.from('waters').select('id, name, slug, extent_note').in('id', waterIds)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('species').select('id, name').eq('pursuit', 'fishing'),
      ]);
      if (linkRes.error) throw linkRes.error;
      if (waterRes.error) throw waterRes.error;
      if (speciesRes.error) throw speciesRes.error;

      const speciesById = new Map((speciesRes.data ?? []).map((s: any) => [s.id, s.name as string]));
      const waterById = new Map((waterRes.data ?? []).map((w: any) => [w.id, w]));

      const namesByRule = new Map<string, string[]>();
      for (const link of linkRes.data ?? []) {
        const name = speciesById.get((link as any).species_id);
        if (!name) continue;
        const list = namesByRule.get((link as any).rule_id) ?? [];
        list.push(name);
        namesByRule.set((link as any).rule_id, list);
      }

      // The gate: links exist but no name resolved for any of them.
      const speciesResolved = (linkRes.data ?? []).length === 0 || namesByRule.size > 0;

      const shaped: FishingRuleWithRefs[] = rules.map((r) => {
        const water = r.water_id ? waterById.get(r.water_id) : null;
        return {
          id: r.id,
          waterName: water?.name ?? null,
          waterSlug: water?.slug ?? null,
          extentNote: water?.extent_note ?? null,
          speciesNames: (namesByRule.get(r.id) ?? []).sort(),
          limitBasis: r.limit_basis,
          dailyLimitKind: r.daily_limit_kind,
          dailyLimit: r.daily_limit,
          sizeRule: r.size_rule,
          minLengthInches: r.min_length_inches,
          maxLengthInches: r.max_length_inches,
          trophyAllowance: r.trophy_allowance,
          trophyMinLengthInches: r.trophy_min_length_inches,
          restrictions: r.restrictions ?? [],
          effectiveFrom: r.effective_from,
          effectiveTo: r.effective_to,
        };
      });

      return { rules: shaped, speciesResolved };
    },
    staleTime: 30 * 60 * 1000,
  });
}
