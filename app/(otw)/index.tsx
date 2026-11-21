/**
 * On the Water — Home.
 *
 * The hunting Home is organised around dates: what opens, and when. This one
 * is organised around conditions: what the water is doing right now, then
 * what is open, then your species. Same bones -- micro label, greeting, one
 * headline, one card that outranks everything, then sections -- in the other
 * mode's voice.
 *
 * EVERY NUMBER ON THIS SCREEN IS PLACEHOLDER DATA in Phase 1, which is why it
 * carries a visible EXAMPLE DATA marker. The screen looks finished, and a
 * screen that looks finished while inventing flows and limits is exactly the
 * thing that gets shown to someone and believed. The marker comes off when
 * placeholder.ts does.
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
import {
  PLACEHOLDER_ALMANAC,
  PLACEHOLDER_GAUGE,
  PLACEHOLDER_LEDGER,
  PLACEHOLDER_LICENSE,
  PLACEHOLDER_NOTICE,
  PLACEHOLDER_PLATES,
  PLACEHOLDER_SUBLINE,
} from '@/features/otw/placeholder';
import { conditionSentence, otwHeadlineSize, sentenceText } from '@/features/otw/sentences';
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

  const sentence = conditionSentence(PLACEHOLDER_GAUGE.waterName, PLACEHOLDER_GAUGE.reading);
  const size = otwHeadlineSize(sentenceText(sentence));

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
                Georgia
              </Text>
            </View>
          </View>
          <ModeToggle />
        </View>

        {/* Phase 1 only. See the header comment. */}
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{PLACEHOLDER_NOTICE}</Text>
        </View>

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
          <Text
            style={[styles.headline, { fontSize: size, lineHeight: Math.round(size * 1.12) }]}
            accessibilityRole="header"
            accessibilityLabel={sentenceText(sentence)}
          >
            {sentence.lead}
            <Text style={styles.headlineAccent}>{sentence.emphasis}</Text>
            {sentence.tail}
          </Text>
          <Text style={styles.subline}>{PLACEHOLDER_SUBLINE}</Text>
        </View>

        <OtwLicenseBanner daysLeft={PLACEHOLDER_LICENSE.daysLeft} renewUrl={PLACEHOLDER_LICENSE.renewUrl} />

        <TodayOnTheWaterCard
          gaugeName={PLACEHOLDER_GAUGE.gaugeName}
          reading={PLACEHOLDER_GAUGE.reading}
          waterTempF={PLACEHOLDER_GAUGE.waterTempF}
          sky={PLACEHOLDER_GAUGE.sky}
          releaseLabel={PLACEHOLDER_GAUGE.releaseLabel}
          history={PLACEHOLDER_GAUGE.history}
          projection={PLACEHOLDER_GAUGE.projection}
          almanac={PLACEHOLDER_ALMANAC}
        />

        <WavyRule tone="brass" style={styles.rule} />

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Seasons &amp; stocking</Text>
          <Text style={styles.sectionLink} onPress={() => router.push('/(otw)/waters')}>
            All waters ›
          </Text>
        </View>
        {PLACEHOLDER_LEDGER.map((row, i) => (
          <OtwLedgerRow
            key={row.id}
            kind={row.kind}
            title={row.title}
            subtitle={row.subtitle}
            status={row.status}
            first={i === 0}
          />
        ))}

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

  disclaimer: {
    fontFamily: type.ui,
    fontSize: 11.5,
    lineHeight: 17,
    color: color.dim,
    marginTop: space.section,
  },
});
