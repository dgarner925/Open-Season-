/**
 * On the Water -- Waters. Real, as of Phase 3.
 *
 * Georgia's 76 published waters and the 94 rules read off the agency's pages
 * for them. No migration was needed for this screen: `waters` and
 * `fishing_rules` have been in production carrying hand-checked data since
 * the fishing schema landed, and the Phase 1 placeholder was only ever
 * waiting for someone to render them.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT WILL NOT DO
 *
 * The brief calls this tab "the waters you follow". It cannot follow anything
 * yet -- `user_waters` is proposed in 20261209000000 and not applied -- so
 * this is every published water in your state rather than a subset you
 * chose. That is a smaller promise, kept, instead of a bigger one faked with
 * a hardcoded list.
 *
 * A water with no rules still appears, and WHICH heading it appears under is
 * the point: "no exception exists, the statewide rules are your answer" and
 * "nobody has read this water's rules yet" are both a water with no rules,
 * and only one of them is safe to act on. waters.rules_complete_at tells them
 * apart; see watersList.ts and migration 20261213000000.
 *
 * Tapping a water opens it. Rows used to expand in place, which was the right
 * shape for "which waters does this state regulate differently" -- a question
 * about our table -- and the wrong one for "what may I keep here". The answer
 * to that is never just the water's own rules: Lake Burton carries exactly
 * one, and every other species on it is governed by Georgia's statewide
 * limits, which an expanding row has no room to repeat. See waters/[slug].
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { WavyRule } from '@/components/otw/WavyRule';
import { useActiveStates } from '@/features/reference/queries';
import { ruleInForce, ruleSubtitle, speciesPhrase, windowPhrase } from '@/features/otw/format';
import { useFishingRules, useWaters, type FishingRuleWithRefs } from '@/features/otw/queries';
import {
  buildWatersList,
  filterWatersList,
  statewideFallback,
  waterCount,
  waterSubtitle,
  type WaterWithRules,
} from '@/features/otw/watersList';
import { useAuth } from '@/providers/AuthProvider';
import { useBrowseStateCode } from '@/lib/browseState';
import type { WaterRow } from '@/lib/database.types';
import { otwLang } from '@/theme/otwTokens';

const { color, space, type } = otwLang;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** One rule, formatted exactly as the Home's ledger formats it. */
function RuleLine({ rule, today }: { rule: FishingRuleWithRefs; today: string }) {
  const inForce = ruleInForce(rule, today);
  const window = windowPhrase(rule);
  return (
    <View style={styles.ruleLine}>
      <View style={styles.bullet} />
      <View style={styles.ruleBody}>
        <Text style={styles.ruleTitle}>{speciesPhrase(rule.speciesNames)}</Text>
        <Text style={styles.ruleSub}>{ruleSubtitle(rule)}</Text>
        {rule.extentNote ? <Text style={styles.ruleExtent}>{rule.extentNote}</Text> : null}
      </View>
      {/* A rule outside its window is not a closed water -- it is a rule that
          applies at another time of year -- so it shows the window rather
          than the word "closed". */}
      <Text style={[styles.ruleStatus, inForce ? styles.ruleOpen : styles.ruleDated]}>
        {inForce ? '● Open' : (window ?? '—')}
      </Text>
    </View>
  );
}

/**
 * A water with no rules, under either heading.
 *
 * `notes` is rendered here and that is load-bearing rather than decorative.
 * It is where a fact goes when fishing_rules cannot hold its shape: Lake
 * Seminole's closure applies to five marked refuge areas and not to the lake,
 * and the Georgia-South Carolina aggregate of 40 game fish is a limit across
 * every species rather than one of them. Neither can be a rule row without
 * saying something false. If this screen did not print them, they would be
 * regulations we had written down and hidden -- which is worse than not
 * holding them, because nobody would go looking.
 */
function PlainWaterRow({ water, onOpen }: { water: WaterRow; onOpen: () => void }) {
  const subtitle = waterSubtitle(water);
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${water.name}. Open for the rules that apply here.`}
      style={({ pressed }) => [styles.plainRow, pressed && styles.pressed]}
    >
      <View style={styles.plainBody}>
        <Text style={styles.plainName}>{water.name}</Text>
        {subtitle ? (
          <Text style={styles.plainSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {water.notes ? <Text style={styles.plainNote}>{water.notes}</Text> : null}
      </View>
      {/* A water with no rules of its own is still worth opening: the
          statewide rules ARE its rules, and the detail screen is where that
          gets said per species. A row that looked inert was the old bug. */}
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function WaterCard({ entry, onOpen }: { entry: WaterWithRules; onOpen: () => void }) {
  const subtitle = waterSubtitle(entry.water);
  const n = entry.rules.length;

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${entry.water.name}. ${n} ${n === 1 ? 'rule' : 'rules'}. Open for the rules that apply here.`}
        style={({ pressed }) => [styles.cardHead, pressed && styles.pressed]}
      >
        <View style={styles.cardHeadBody}>
          <Text style={styles.waterName}>{entry.water.name}</Text>
          {subtitle ? (
            <Text style={styles.waterSub} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Text style={styles.count}>
          {n} {n === 1 ? 'rule' : 'rules'}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </View>
  );
}

export default function OtwWaters() {
  const router = useRouter();
  const { profile } = useAuth();
  const { code: browseCode } = useBrowseStateCode();
  const { data: states = [] } = useActiveStates();
  const stateCode =
    states.find((st) => st.id === profile?.resident_state_id)?.code ?? browseCode ?? null;
  const stateName = states.find((st) => st.code === stateCode)?.name ?? stateCode ?? '';

  const { data: waters = [], isPending: watersPending } = useWaters(stateCode);
  const { data: ruleData, isPending: rulesPending } = useFishingRules(stateCode);
  const [query, setQuery] = useState('');
  const today = todayISO();

  const full = useMemo(
    () => buildWatersList(waters as WaterRow[], ruleData?.rules ?? []),
    [waters, ruleData],
  );
  const list = useMemo(() => filterWatersList(full, query), [full, query]);

  const pending = watersPending || rulesPending;
  const shown = waterCount(list);

  // When a search matches no water, the statewide rules are usually the
  // correct answer rather than an empty result -- see statewideFallback.
  const fallback = useMemo(
    () => statewideFallback(full, list, query),
    [full, list, query],
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>ON THE WATER</Text>
        <Text style={styles.title}>Waters</Text>
        {/*
          This line has been wrong twice, in opposite directions, and both
          times because it described the table rather than what the table now
          holds.

          "Every water Georgia publishes rules for" read as "every water", so
          a reader who could not find Lake Sinclair concluded we did not cover
          it. Replacing it with "waters Georgia regulates differently" was
          true of an exceptions table and stopped being true the moment the
          agency's own list of major lakes and rivers was added -- most of
          which it does NOT regulate differently.
        */}
        <Text style={styles.blurb}>
          {stateName
            ? `${stateName}'s major lakes and rivers, and every water it regulates differently.`
            : 'Pick a state to see its waters.'}
        </Text>

        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name, county or kind"
          placeholderTextColor={color.dim}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Search waters"
        />

        <WavyRule tone="brass" style={styles.rule} />

        {/*
          Nothing below renders until BOTH queries have landed, and that is
          load-bearing rather than tidy.

          `waters` and `fishing_rules` are separate queries. When waters
          resolved first, buildWatersList had every water and no rules, so all
          63 fell out as unregulated -- under the heading "We have not
          transcribed rules for them yet, so check the regulations before you
          fish one." That sentence was false for 47 of them, and it is exactly
          the failure class where a default reads as data: a water whose rules
          are still in flight must not look like a water whose rules we do not
          have.

          Splitting that heading in two did not remove the need for this gate.
          It made it sharper: a regulated water arriving before its rules now
          lands in whichever of the two groups its rules_complete_at points
          at, and for a water we HAVE cleared that is "no exception exists" --
          a positive claim, made against rules that simply had not loaded.
        */}
        {pending ? <Text style={styles.note}>Reading the ledger…</Text> : null}

        {!pending && shown === 0 ? (
          fallback.length ? (
            /*
              NOT "Nothing matching". Georgia publishes statewide rules plus a
              list of named exceptions, so a water is in the table BECAUSE it
              differs from the default. Lake Sinclair is absent because it has
              no exception -- and the rules below are the ones that govern it.
              Saying "nothing matching" told the reader the opposite.
            */
            <>
              <Text style={styles.note}>
                {stateName} publishes no special rules for “{query.trim()}”.
              </Text>
              <Text style={styles.sectionNote}>
                That usually means the statewide rules apply. {stateName} lists a water
                here only when its rules differ from the state default, so a water
                missing from this list is not a water we have skipped. Confirm the
                name with the state before you rely on it.
              </Text>
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.cardHeadBody}>
                    <Text style={styles.waterName}>Statewide</Text>
                    <Text style={styles.waterSub}>Applies wherever you are in {stateName}</Text>
                  </View>
                  <Text style={styles.count}>{fallback.length} rules</Text>
                </View>
                <View style={styles.rules}>
                  {fallback.map((rule) => (
                    <RuleLine key={rule.id} rule={rule} today={today} />
                  ))}
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.note}>
              {query ? `Nothing matching “${query.trim()}”.` : 'No waters published for this state yet.'}
            </Text>
          )
        ) : null}

        {!pending && list.statewide.length ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardHeadBody}>
                <Text style={styles.waterName}>Statewide</Text>
                <Text style={styles.waterSub}>Applies wherever you are in {stateName}</Text>
              </View>
              <Text style={styles.count}>{list.statewide.length} rules</Text>
            </View>
            <View style={styles.rules}>
              {list.statewide.map((rule) => (
                <RuleLine key={rule.id} rule={rule} today={today} />
              ))}
            </View>
          </View>
        ) : null}

        {!pending && list.regulated.length ? (
          <>
            <Text style={styles.sectionHead}>
              Regulated waters · {list.regulated.length}
            </Text>
            {list.regulated.map((entry) => (
              <WaterCard
                key={entry.water.id}
                entry={entry}
                onOpen={() =>
                  router.push({
                    pathname: '/(otw)/waters/[slug]',
                    params: { slug: entry.water.slug },
                  })
                }
              />
            ))}
          </>
        ) : null}

        {/*
          TWO HEADINGS, BECAUSE THE TWO GROUPS WANT OPPOSITE THINGS FROM THE
          READER. One says "stop reading, you already have the rules". The
          other says "go and check". A single heading had to pick one, and
          whichever it picked was wrong about the other half.
        */}
        {!pending && list.noExceptions.length ? (
          <>
            <WavyRule tone="river" style={styles.rule} />
            <Text style={styles.sectionHead}>
              Statewide rules apply · {list.noExceptions.length}
            </Text>
            <Text style={styles.sectionNote}>
              {stateName} publishes no special rules for these waters, so the statewide rules
              above are the ones that govern them. That is a checked answer, not a gap.
            </Text>
            {list.noExceptions.map((water) => (
              <PlainWaterRow
                key={water.id}
                water={water}
                onOpen={() =>
                  router.push({
                    pathname: '/(otw)/waters/[slug]',
                    params: { slug: water.slug },
                  })
                }
              />
            ))}
          </>
        ) : null}

        {!pending && list.notTranscribed.length ? (
          <>
            <WavyRule tone="river" style={styles.rule} />
            <Text style={styles.sectionHead}>
              Not read yet · {list.notTranscribed.length}
            </Text>
            <Text style={styles.sectionNote}>
              {stateName} names these waters and we have not read their rules. There may be
              limits here that differ from the statewide ones, so check the regulations before
              you fish one.
            </Text>
            {list.notTranscribed.map((water) => (
              <PlainWaterRow
                key={water.id}
                water={water}
                onOpen={() =>
                  router.push({
                    pathname: '/(otw)/waters/[slug]',
                    params: { slug: water.slug },
                  })
                }
              />
            ))}
          </>
        ) : null}

        <Text style={styles.footnote}>
          Informational only. Always confirm seasons, limits and special regulations with the
          state agency before fishing.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: space.gutter, paddingTop: space.x32, paddingBottom: space.x38 },

  label: {
    fontFamily: type.uiMedium,
    fontSize: type.size.micro,
    letterSpacing: type.microTracking,
    color: color.dim,
  },
  title: { fontFamily: type.otwDisplay, fontSize: 33, color: color.ink, marginTop: space.x8 },
  blurb: {
    fontFamily: type.ui,
    fontSize: type.size.body,
    lineHeight: 23,
    color: color.muted,
    marginTop: space.x8,
  },

  search: {
    marginTop: space.x16,
    paddingHorizontal: space.x12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: color.hair,
    backgroundColor: color.surface,
    fontFamily: type.ui,
    fontSize: 15,
    color: color.ink,
  },
  rule: { marginTop: space.x16, marginBottom: space.x12 },

  note: {
    fontFamily: type.uiMedium,
    fontSize: type.size.micro,
    letterSpacing: type.microTracking,
    color: color.brassText,
    marginTop: space.x8,
  },

  sectionHead: {
    fontFamily: type.uiMedium,
    fontSize: type.size.micro,
    letterSpacing: type.microTracking,
    color: color.dim,
    marginTop: space.section,
    marginBottom: space.x8,
  },
  sectionNote: {
    fontFamily: type.ui,
    fontSize: 13,
    lineHeight: 19,
    color: color.muted,
    marginBottom: space.x12,
  },

  card: {
    backgroundColor: color.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: color.hair,
    marginBottom: space.x8,
    overflow: 'hidden',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.x12,
    padding: space.x12,
  },
  pressed: { backgroundColor: color.tile },
  cardHeadBody: { flex: 1, gap: 2 },
  waterName: { fontFamily: type.uiSemiBold, fontSize: 15.5, color: color.ink },
  waterSub: { fontFamily: type.ui, fontSize: 12.5, lineHeight: 17, color: color.muted },
  count: {
    fontFamily: type.uiMedium,
    fontSize: 12,
    color: color.brassText,
    flexShrink: 0,
  },

  rules: {
    borderTopWidth: 1,
    borderTopColor: color.hair,
    paddingHorizontal: space.x12,
    paddingVertical: space.x8,
    gap: space.x8,
  },
  ruleLine: { flexDirection: 'row', alignItems: 'flex-start', gap: space.x8 },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: color.river,
    marginTop: 6,
    flexShrink: 0,
  },
  ruleBody: { flex: 1, gap: 1 },
  ruleTitle: { fontFamily: type.uiMedium, fontSize: 14, color: color.ink },
  ruleSub: { fontFamily: type.ui, fontSize: 12.5, lineHeight: 18, color: color.muted },
  ruleExtent: {
    fontFamily: type.ui,
    fontSize: 12,
    lineHeight: 17,
    color: color.dim,
    fontStyle: 'italic',
  },
  ruleStatus: { fontFamily: type.uiMedium, fontSize: 11.5, flexShrink: 0, marginTop: 1 },
  ruleOpen: { color: color.mossText },
  ruleDated: { color: color.brassText },

  plainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.x8,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: color.hair,
  },
  plainBody: { flex: 1, gap: 1 },
  chevron: {
    fontFamily: type.ui,
    fontSize: 18,
    color: color.dim,
    flexShrink: 0,
  },
  plainName: { fontFamily: type.uiMedium, fontSize: 14.5, color: color.ink },
  plainSub: { fontFamily: type.ui, fontSize: 12, color: color.dim },
  plainNote: {
    fontFamily: type.ui,
    fontSize: 12.5,
    lineHeight: 18,
    color: color.muted,
    marginTop: 3,
  },
  cardNote: {
    fontFamily: type.ui,
    fontSize: 12.5,
    lineHeight: 18,
    color: color.muted,
    paddingBottom: space.x8,
    borderBottomWidth: 1,
    borderBottomColor: color.hair,
  },

  footnote: {
    fontFamily: type.ui,
    fontSize: 12.5,
    lineHeight: 18,
    color: color.dim,
    marginTop: space.section,
  },
});
