/**
 * On the Water — Home.
 *
 * The hunting Home is organised around dates: what opens, and when. This one
 * is organised around conditions: what the water is doing right now, then
 * what is open, then your species. Same bones -- micro label, greeting, one
 * headline, one card that outranks everything, then sections -- in the other
 * mode's voice.
 *
 * WHAT IS REAL AND WHAT IS NOT, which the screen says out loud:
 *
 *   Seasons & stocking   REAL, from the published fishing_rules already in
 *                        production -- Georgia's 29 waters and 33 rules were
 *                        transcribed from the agency pages by hand.
 *   The Today card       PLACEHOLDER. Flow, water temperature, the release
 *                        window and the almanac are invented until Phase 2
 *                        wires USGS and NWS.
 *   Licence banner       PLACEHOLDER. There is no licence-expiry model yet.
 *   Field plates         PLACEHOLDER. "Your species" implies a follow model
 *                        that fishing does not have.
 *
 * The marker in the header reflects which of those is true, because a screen
 * that looks finished while inventing limits is the thing that gets shown to
 * someone and believed.
 */
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Monogram } from '@/components/system';
import { ModeToggle } from '@/components/ModeToggle';
import { FlyPlateCard } from '@/components/otw/FlyPlateCard';
import { OtwLedgerRow } from '@/components/otw/OtwLedgerRow';
import { OtwLicenseBanner } from '@/components/otw/OtwLicenseBanner';
import { TodayOnTheWaterCard } from '@/components/otw/TodayOnTheWaterCard';
import { WavyRule } from '@/components/otw/WavyRule';
import { MODE_LABEL } from '@/content/brand';
import { useAuth } from '@/providers/AuthProvider';
import { useBrowseStateCode } from '@/lib/browseState';
import { useActiveStates } from '@/features/reference/queries';
import { useFishingRules } from '@/features/otw/queries';
import { ruleInForce, ruleSubtitle, speciesPhrase, windowPhrase } from '@/features/otw/format';
import { PLACEHOLDER_PLATES } from '@/features/otw/placeholder';
import { useOtwLicence } from '@/features/otw/useOtwLicence';
import { sublineFor } from '@/features/otw/conditions';
import { useGaugeConditions, useOtwAlmanac } from '@/features/otw/useGaugeConditions';
import { useGaugeSiteNo } from '@/lib/otwGauge';
import { conditionSentence, otwHeadlineSize, sentenceText } from '@/features/otw/sentences';
import { useMemo } from 'react';
import { otwLang, OTW_DISCLAIMER } from '@/theme/otwTokens';

const { color, space, type } = otwLang;

const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function partOfDayFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function OtwHome() {
  const router = useRouter();
  const { profile } = useAuth();

  const now = new Date();
  // Same field and same split as the hunting Home, so a name that renders in
  // one mode renders in the other.
  const firstName = (profile?.display_name ?? '').trim().split(' ')[0];
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // The same order the hunting Home uses: the state you said you live in,
  // else the one you are browsing. The header used to say "Georgia" whatever
  // you had picked, which was a lie for everyone else.
  const { code: browseCode } = useBrowseStateCode();
  const { data: states = [] } = useActiveStates();
  const stateCode =
    states.find((st) => st.id === profile?.resident_state_id)?.code ?? browseCode ?? null;
  const stateName = states.find((st) => st.code === stateCode)?.name ?? stateCode ?? '';
  // The row, not just the code: states.license_url is the angler's own
  // renewal page, and the banner used to hardcode Georgia's for all 50.
  const stateRow = states.find((st) => st.code === stateCode) ?? null;

  const { data: ruleData, isPending: rulesPending } = useFishingRules(stateCode);

  /**
   * The three rules worth leading with: a named water before statewide, and a
   * rule in force today before one that is not. A rule outside its window is
   * NOT a closed water -- see ruleInForce -- so it still earns a place, just a
   * lower one, and it shows its window instead of a status.
   */
  const realRows = useMemo(() => {
    if (!ruleData || !ruleData.speciesResolved) return null;
    const usable = ruleData.rules.filter((r) => r.speciesNames.length > 0);
    if (usable.length === 0) return null;
    const rank = (r: (typeof usable)[number]) =>
      (r.waterName ? 0 : 2) + (ruleInForce(r, todayISO) ? 0 : 1);
    return [...usable].sort((a, b) => rank(a) - rank(b)).slice(0, 3);
  }, [ruleData, todayISO]);

  /**
   * What on this screen is still invented.
   *
   * Just the plates. Conditions came off in Phase 2; the licence came off
   * next, reading user_licenses and showing nothing when there is nothing to
   * show; and the seasons came off here -- a state with no published rules
   * now says so instead of borrowing three invented ones, so "seasons" can
   * no longer appear in this marker because there are no example seasons
   * left to mark.
   *
   * "Your species" is the last of it: the heading implies a follow model
   * that exists in the schema (user_waters, 20261209000000) but has nothing
   * to write a row with yet, so every angler sees the same three fish.
   * Whether that section ships or waits is a design call, not this file's.
   */
  const stillExample = 'PLATES';

  // Live conditions: USGS for the flow, NWS at the gauge's own coordinates
  // for air and sky, suncalc on-device for the sun and the moon.
  // Null for everyone until somebody records an expiry, which is why the
  // banner is simply absent rather than showing a number nobody gave us.
  const licence = useOtwLicence(stateRow);

  const { siteNo } = useGaugeSiteNo();
  const { conditions, isPending } = useGaugeConditions(siteNo);
  const almanac = useOtwAlmanac(conditions?.gauge ?? null);

  const sentence = conditions
    ? conditionSentence(conditions.gauge.waterName, conditions.reading)
    : null;
  const size = sentence ? otwHeadlineSize(sentenceText(sentence)) : 37;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header — the mark, where you are, and the mode toggle. */}
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <Monogram size={20} tint={color.river} dotTint={color.brass} />
            <View style={styles.locChip}>
              <View style={styles.locDot} />
              <Text style={styles.locText} numberOfLines={1}>
                {stateName || 'Pick a state'}
              </Text>
            </View>
          </View>
          <ModeToggle />
        </View>

        {/* Names what is STILL example, which as of Phase 2 is no longer the
            conditions. A blanket "EXAMPLE DATA" over a card now showing a real
            USGS reading would be false in the other direction, and a marker
            that is wrong either way stops being read. */}
        {stillExample ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>EXAMPLE {stillExample}</Text>
          </View>
        ) : null}

        <View style={styles.hero}>
          <Text style={styles.micro}>
            {WEEKDAYS[now.getDay()]}, {MONTHS[now.getMonth()]} {now.getDate()} ·{' '}
            {MODE_LABEL.otw.long.toUpperCase()}
          </Text>
          {firstName ? (
            <Text style={styles.greeting}>
              {partOfDayFor(now.getHours())}, <Text style={styles.greetingName}>{firstName}</Text>
            </Text>
          ) : (
            <Text style={styles.greeting}>{partOfDayFor(now.getHours())}</Text>
          )}

          {/* One headline per screen, with one accent word in italic river. */}
          {sentence ? (
            <Text
              style={[styles.headline, { fontSize: size, lineHeight: Math.round(size * 1.12) }]}
              accessibilityRole="header"
              accessibilityLabel={sentenceText(sentence)}
            >
              {sentence.lead}
              <Text style={styles.headlineAccent}>{sentence.emphasis}</Text>
              {sentence.tail}
            </Text>
          ) : null}
          {conditions ? <Text style={styles.subline}>{sublineFor(conditions)}</Text> : null}
        </View>

        <OtwLicenseBanner daysLeft={licence.daysLeft} renewUrl={licence.renewUrl} />

        {conditions && almanac ? (
          <TodayOnTheWaterCard
            gaugeName={conditions.gauge.name}
            reading={conditions.reading}
            waterTempF={conditions.waterTempF}
            sky={almanac.sky}
            // TODO (Phase 2+): USACE generation schedules are out of scope, so
            // there is no release window to show. Hidden rather than static --
            // a frozen "Release 2:00 – 6:00 PM" beside a live flow reads as
            // today's schedule because everything around it is today's.
            releaseLabel={null}
            history={conditions.history}
            // The dashed tail is the scheduled release, which needs the same
            // schedules. Nothing is projected, so nothing is drawn.
            projection={[]}
            almanac={almanac}
            pending={isPending}
            onPickGauge={() => router.push('/otw-gauge')}
          />
        ) : null}

        <WavyRule tone="brass" style={styles.rule} />

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Seasons &amp; stocking</Text>
          <Text style={styles.sectionLink} onPress={() => router.push('/(otw)/waters')}>
            All waters ›
          </Text>
        </View>
        {realRows
          ? realRows.map((r, i) => {
              const inForce = ruleInForce(r, todayISO);
              const window = windowPhrase(r);
              return (
                <OtwLedgerRow
                  key={r.id}
                  kind={r.waterName ? 'rule' : 'season'}
                  title={[r.waterName ?? 'Statewide', speciesPhrase(r.speciesNames)]
                    .filter(Boolean)
                    .join(' · ')}
                  subtitle={ruleSubtitle(r) || r.extentNote || 'See the regulations'}
                  status={
                    inForce
                      ? { text: 'In force', tone: 'open' }
                      : { text: window ?? '—', tone: 'date' }
                  }
                  first={i === 0}
                />
              );
            })
          : /* Nothing invented here any more.
             *
             * This branch used to render PLACEHOLDER_LEDGER -- three made-up
             * seasons -- under an "EXAMPLE SEASONS" marker. Georgia and five
             * of its neighbours have real rules; the other forty-three
             * states have none, so every angler outside the Southeast met
             * invented regulations on the first screen of the fishing side.
             * A marker makes that honest, not harmless: it is still a
             * season-shaped sentence where the app has no season, and it is
             * the one thing this project cannot ship (see the span-row and
             * swallowed-failure classes).
             *
             * It also showed WHILE LOADING, because realRows returns null
             * for "no data yet" and "no data at all" alike -- the same
             * defect 8a58017 fixed in the waters list. Hence `pending`
             * first: a slow network must not look like an empty state. */
            <Text style={styles.ledgerNote}>
              {rulesPending
                ? 'Reading the ledger…'
                : stateName
                  ? `No fishing regulations published for ${stateName} yet. The hunting side is unaffected.`
                  : 'Pick a state to see its fishing regulations.'}
            </Text>}

        <WavyRule tone="river" style={styles.rule} />

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Your species</Text>
          <Text style={styles.sectionLink} onPress={() => router.push('/(otw)/regs')}>
            Field plates ›
          </Text>
        </View>
        <View style={styles.plates}>
          {PLACEHOLDER_PLATES.map((p) => (
            <FlyPlateCard
              key={p.artKey}
              artKey={p.artKey}
              plate={p.plate}
              commonName={p.commonName}
              latinName={p.latinName}
            />
          ))}
        </View>

        <Text style={styles.disclaimer}>{OTW_DISCLAIMER}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: space.gutter, paddingTop: space.x12, paddingBottom: space.x38 },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: space.x12, flexShrink: 1 },
  locChip: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  locDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.moss },
  locText: { fontFamily: type.ui, fontSize: 13, color: color.muted },

  notice: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: color.brass,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: space.x12,
  },
  noticeText: {
    fontFamily: type.uiMedium,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: color.brassText,
  },

  hero: { marginTop: space.x16 },
  micro: {
    fontFamily: type.uiMedium,
    fontSize: type.size.micro,
    letterSpacing: type.microTracking,
    color: color.dim,
  },
  greeting: { fontFamily: type.ui, fontSize: 17, color: color.ink, marginTop: 5 },
  greetingName: { fontFamily: type.uiSemiBold, color: color.river },
  headline: { fontFamily: type.otwDisplay, color: color.ink, marginTop: space.x12 },
  headlineAccent: { fontFamily: type.otwDisplayItalic, color: color.river },
  subline: { fontFamily: type.ui, fontSize: 14.5, lineHeight: 21, color: color.muted, marginTop: 6 },

  rule: { marginTop: space.section, marginBottom: space.x8 },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: space.x8,
    gap: space.x8,
  },
  sectionTitle: { fontFamily: type.otwDisplay, fontSize: 21, color: color.ink },
  sectionLink: { fontFamily: type.uiMedium, fontSize: 13, color: color.brassText },

  plates: { flexDirection: 'row', gap: space.x8, marginTop: space.x12 },

  /* Sits where the ledger rows would be, so the section never collapses to
     a bare heading with nothing under it. */
  ledgerNote: {
    fontFamily: type.ui,
    fontSize: 13.5,
    lineHeight: 20,
    color: color.dim,
    marginTop: space.x12,
  },

  disclaimer: {
    fontFamily: type.ui,
    fontSize: 11.5,
    lineHeight: 17,
    color: color.dim,
    marginTop: space.section,
  },
});
