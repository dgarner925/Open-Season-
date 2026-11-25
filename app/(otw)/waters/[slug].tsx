/**
 * One water, every species: the third step of State -> Water -> Fish.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A ROUTE AND NOT AN EXPANDING ROW
 *
 * The Waters tab used to expand a water in place to show its rules. That is
 * the right shape for "which waters does Georgia regulate differently", which
 * is a question about our table. It is the wrong shape for "what may I keep
 * here", because the answer to that is never just the water's own rules --
 * Lake Burton carries exactly one, and the other twenty-odd species on it are
 * governed by Georgia's statewide limits, which an expanding row has no room
 * to repeat and no business repeating per water.
 *
 * ---------------------------------------------------------------------------
 * NO QUERY OF ITS OWN, DELIBERATELY
 *
 * Both hooks below are the same ones the Waters tab calls, keyed by state and
 * cached for an hour, so arriving here is instant and reads no new rows. A
 * per-water fetch would be a second way to read the same rules, and two
 * readers of one table eventually disagree -- one filters by status, the other
 * forgets, and a draft rule shows up on one screen only.
 *
 * The cost is that a cold deep link into this route fetches the whole state's
 * rules. For Georgia that is 109 rows.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WavyRule } from '@/components/otw/WavyRule';
import { useActiveStates } from '@/features/reference/queries';
import {
  limitPhrase,
  restrictionPhrase,
  ruleInForce,
  sizePhrase,
  trophyPhrase,
  windowPhrase,
} from '@/features/otw/format';
import { useFishingRules, useWaters } from '@/features/otw/queries';
import {
  answeredSpecies,
  buildWaterDetail,
  differsFromStatewide,
  rulesForWater,
  speciesHeadline,
  statewideRules,
  type SpeciesEntry,
} from '@/features/otw/waterDetail';
import { waterSubtitle } from '@/features/otw/watersList';
import type { ApplicableRule } from '@/features/otw/resolve';
import { useAuth } from '@/providers/AuthProvider';
import { useBrowseStateCode } from '@/lib/browseState';
import type { WaterRow } from '@/lib/database.types';
import { otwLang, OTW_DISCLAIMER } from '@/theme/otwTokens';

const { color, space, type } = otwLang;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Statewide" or "Lake Burton" -- where this particular line comes from. */
function OriginTag({ origin, stateName }: { origin: ApplicableRule['origin']; stateName: string }) {
  const here = origin === 'water';
  return (
    <Text style={[styles.tag, here ? styles.tagHere : styles.tagState]}>
      {here ? 'HERE' : (stateName.toUpperCase() || 'STATEWIDE')}
    </Text>
  );
}

function Line({
  label,
  value,
  origin,
  stateName,
  muted,
}: {
  label: string;
  value: string;
  origin?: ApplicableRule['origin'];
  stateName: string;
  muted?: boolean;
}) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <View style={styles.lineBody}>
        <Text style={[styles.lineValue, muted && styles.lineValueMuted]}>{value}</Text>
      </View>
      {origin ? <OriginTag origin={origin} stateName={stateName} /> : null}
    </View>
  );
}

function SpeciesCard({
  entry,
  stateName,
  today,
}: {
  entry: SpeciesEntry;
  stateName: string;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const headline = speciesHeadline(entry);
  const differs = differsFromStatewide(entry);
  const { resolved } = entry;
  const restrictions = restrictionPhrase(resolved.restrictions as never);

  return (
    <View style={[styles.card, differs && styles.cardDiffers]}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${entry.species}. ${headline ?? 'No limit or size stated.'}`}
        style={({ pressed }) => [styles.cardHead, pressed && styles.pressed]}
      >
        <View style={styles.cardHeadBody}>
          <Text style={styles.speciesName}>{entry.species}</Text>
          {/*
            Nothing rather than a reassuring phrase when neither level states
            a limit or a size. See speciesHeadline: "No limit" would assert
            something the source never said, and the summary line is exactly
            where that gets skimmed.
          */}
          {headline ? (
            <Text style={styles.headline}>{headline}</Text>
          ) : (
            <Text style={styles.headlineQuiet}>Nothing stated — open for detail</Text>
          )}
        </View>
        {differs ? <Text style={styles.differsFlag}>DIFFERS HERE</Text> : null}
        <Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>

      {open ? (
        <View style={styles.cardBody}>
          {resolved.governingSize ? (
            <Line
              label="Size"
              value={sizePhrase(resolved.governingSize.rule) ?? 'Not stated'}
              origin={resolved.governingSize.origin}
              stateName={stateName}
            />
          ) : (
            <Line
              label="Size"
              value="No size limit stated in the regulations we hold."
              stateName={stateName}
              muted
            />
          )}

          {/*
            THE DISPLACED RULE IS SHOWN, NOT DROPPED. On Lake Burton the
            screen above says "No size limit"; a reader who has just read
            Georgia's 12-inch minimum on the Waters tab needs to be told that
            this is the exception to it, or the two screens simply contradict
            each other and they have to guess which is current.
          */}
          {resolved.supersededSize.map((a) => (
            <Line
              key={`ss-${a.rule.id}`}
              label=""
              value={`${sizePhrase(a.rule) ?? 'A size limit'} does not apply here.`}
              stateName={stateName}
              muted
            />
          ))}

          {resolved.limits.length ? (
            resolved.limits.map((a) => {
              const limit = limitPhrase(a.rule);
              const trophy = trophyPhrase(a.rule);
              const window = windowPhrase(a.rule);
              const inForce = ruleInForce(a.rule, today);
              return (
                <View key={`l-${a.rule.id}`}>
                  <Line
                    label="Daily limit"
                    value={[limit ?? 'Not stated', trophy].filter(Boolean).join(' · ')}
                    origin={a.origin}
                    stateName={stateName}
                  />
                  {/* A rule outside its window is not a closed water: it is a
                      rule that applies at another time of year. */}
                  {window ? (
                    <Text style={[styles.sub, inForce ? styles.subNow : styles.subLater]}>
                      {inForce ? `In force now · ${window}` : window}
                    </Text>
                  ) : null}
                </View>
              );
            })
          ) : (
            <Line
              label="Daily limit"
              value="No daily limit stated in the regulations we hold."
              stateName={stateName}
              muted
            />
          )}

          {resolved.supersededLimits.map((a) => (
            <Line
              key={`sl-${a.rule.id}`}
              label=""
              value={`${limitPhrase(a.rule) ?? 'A daily limit'} does not apply here.`}
              stateName={stateName}
              muted
            />
          ))}

          {/* Restrictions are a UNION and never replaced, so they carry no
              origin tag: every one of them binds, wherever it came from. */}
          {restrictions ? (
            <Line label="Also" value={restrictions} stateName={stateName} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function OtwWaterDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { code: browseCode } = useBrowseStateCode();
  const { data: states = [] } = useActiveStates();
  const stateCode =
    states.find((st) => st.id === profile?.resident_state_id)?.code ?? browseCode ?? null;
  const stateName = states.find((st) => st.code === stateCode)?.name ?? stateCode ?? '';

  const { data: waters = [], isPending: watersPending } = useWaters(stateCode);
  const { data: ruleData, isPending: rulesPending } = useFishingRules(stateCode);
  const pending = watersPending || rulesPending;
  const today = todayISO();

  const water = (waters as WaterRow[]).find((w) => w.slug === slug) ?? null;

  const detail = useMemo(() => {
    if (!water) return null;
    const all = ruleData?.rules ?? [];
    const known = new Set((waters as WaterRow[]).map((w) => w.slug));
    return buildWaterDetail(water, statewideRules(all, known), rulesForWater(water, all));
  }, [water, ruleData, waters]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to waters"
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={18} color={color.muted} />
          <Text style={styles.backText}>Waters</Text>
        </Pressable>

        {/*
          The same gate the Waters tab has, for the same reason: waters and
          rules are two queries, and a water whose rules have not landed yet
          looks exactly like a water with no rules. Here that would render the
          statewide answer under the heading that says it is the complete one.
        */}
        {pending ? (
          <Text style={styles.note}>Reading the ledger…</Text>
        ) : !water ? (
          <>
            <Text style={styles.title}>Not found</Text>
            <Text style={styles.blurb}>
              {stateName
                ? `${stateName} does not publish a water under that name, or it is not in the list yet.`
                : 'Pick a state first.'}
            </Text>
          </>
        ) : !detail ? null : (
          <>
            <Text style={styles.label}>
              {stateName ? stateName.toUpperCase() : 'ON THE WATER'}
            </Text>
            <Text style={styles.title}>{water.name}</Text>
            {waterSubtitle(water) ? (
              <Text style={styles.blurb}>{waterSubtitle(water)}</Text>
            ) : null}

            {/*
              THE STANDING BANNER IS THE POINT OF THIS SCREEN.

              `statewideOnly` and `unread` render the same numbers -- the
              statewide rules, because that is all there is for a water with
              no rules of its own. They are not the same answer, and the
              difference cannot be carried by the numbers, so it has to be
              carried here. One tells the reader they are done; the other
              tells them to go and check.
            */}
            {detail.standing === 'regulated' ? (
              <Text style={styles.bannerRules}>
                {detail.waterRules.length}{' '}
                {detail.waterRules.length === 1 ? 'rule' : 'rules'} published for this water, on
                top of {stateName}'s statewide rules.
              </Text>
            ) : detail.standing === 'statewideOnly' ? (
              <Text style={styles.bannerGood}>
                {stateName} publishes no special rules for this water. The statewide rules below
                are the complete answer.
              </Text>
            ) : (
              <Text style={styles.bannerWarn}>
                We have not read {stateName}'s rules for this water. What follows is the
                statewide answer, which applies everywhere in {stateName} — there may be limits
                here that differ from it. Check the regulations before you fish.
              </Text>
            )}

            {/* notes holds what fishing_rules cannot: a closure that applies
                to marked areas rather than a whole lake, an aggregate across
                every species, which state an agreement is with. */}
            {water.notes ? <Text style={styles.waterNote}>{water.notes}</Text> : null}

            <WavyRule tone="brass" style={styles.rule} />

            {detail.species.length === 0 ? (
              <Text style={styles.note}>
                No species rules published for {stateName} yet.
              </Text>
            ) : (
              <>
                <Text style={styles.sectionHead}>
                  {answeredSpecies(detail)} species · tap for detail
                </Text>
                {detail.species.map((entry) => (
                  <SpeciesCard
                    key={entry.species}
                    entry={entry}
                    stateName={stateName}
                    today={today}
                  />
                ))}
              </>
            )}
          </>
        )}

        {/* The constant, not a copy. These two screens each carried their
            own wording, so the compliance sentence would have reached four
            screens and missed these. */}
        <Text style={styles.footnote}>{OTW_DISCLAIMER}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: space.gutter, paddingTop: space.x16, paddingBottom: space.x38 },

  back: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: space.x8 },
  backText: { fontFamily: type.uiMedium, fontSize: 14, color: color.muted },

  label: {
    fontFamily: type.uiMedium,
    fontSize: type.size.micro,
    letterSpacing: type.microTracking,
    color: color.dim,
    marginTop: space.x8,
  },
  title: { fontFamily: type.otwDisplay, fontSize: 31, color: color.ink, marginTop: space.x8 },
  blurb: {
    fontFamily: type.ui,
    fontSize: type.size.body,
    lineHeight: 23,
    color: color.muted,
    marginTop: space.x8,
  },

  bannerRules: {
    fontFamily: type.ui,
    fontSize: 13.5,
    lineHeight: 20,
    color: color.brassText,
    marginTop: space.x12,
  },
  bannerGood: {
    fontFamily: type.ui,
    fontSize: 13.5,
    lineHeight: 20,
    color: color.mossText,
    marginTop: space.x12,
  },
  bannerWarn: {
    fontFamily: type.uiMedium,
    fontSize: 13.5,
    lineHeight: 20,
    color: color.brassText,
    marginTop: space.x12,
  },
  waterNote: {
    fontFamily: type.ui,
    fontSize: 13,
    lineHeight: 19,
    color: color.muted,
    marginTop: space.x8,
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
    marginBottom: space.x8,
  },

  card: {
    backgroundColor: color.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: color.hair,
    marginBottom: space.x8,
    overflow: 'hidden',
  },
  // A water-specific answer gets a left edge in the water tone. The flag text
  // beside it carries the same information for anyone who cannot see the
  // colour; the border is the shortcut, never the only signal.
  cardDiffers: { borderLeftWidth: 3, borderLeftColor: color.river },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.x8, padding: space.x12 },
  pressed: { backgroundColor: color.tile },
  cardHeadBody: { flex: 1, gap: 2 },
  speciesName: { fontFamily: type.uiSemiBold, fontSize: 15.5, color: color.ink },
  headline: { fontFamily: type.ui, fontSize: 13, lineHeight: 18, color: color.muted },
  headlineQuiet: {
    fontFamily: type.ui,
    fontSize: 12.5,
    lineHeight: 18,
    color: color.dim,
    fontStyle: 'italic',
  },
  differsFlag: {
    fontFamily: type.uiSemiBold,
    fontSize: 9,
    letterSpacing: 0.7,
    color: color.river,
    flexShrink: 0,
  },
  chevron: { fontFamily: type.ui, fontSize: 13, color: color.dim, flexShrink: 0 },

  cardBody: {
    borderTopWidth: 1,
    borderTopColor: color.hair,
    paddingHorizontal: space.x12,
    paddingVertical: space.x8,
    gap: space.x8,
  },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: space.x8 },
  lineLabel: {
    fontFamily: type.uiMedium,
    fontSize: 11,
    letterSpacing: 0.4,
    color: color.dim,
    width: 74,
    flexShrink: 0,
    paddingTop: 2,
  },
  lineBody: { flex: 1 },
  lineValue: { fontFamily: type.ui, fontSize: 13.5, lineHeight: 19, color: color.ink },
  lineValueMuted: { color: color.dim },
  tag: {
    fontFamily: type.uiSemiBold,
    fontSize: 8.5,
    letterSpacing: 0.7,
    flexShrink: 0,
    paddingTop: 3,
  },
  tagHere: { color: color.river },
  tagState: { color: color.dim },
  sub: { fontFamily: type.ui, fontSize: 12, lineHeight: 17, marginLeft: 82 },
  subNow: { color: color.mossText },
  subLater: { color: color.brassText },

  footnote: {
    fontFamily: type.ui,
    fontSize: 12.5,
    lineHeight: 18,
    color: color.dim,
    marginTop: space.section,
  },
});
