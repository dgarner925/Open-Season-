import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Headline, LinkSentence, Micro, Rule, Sentence, Serif, Tile } from '@/components/system';
import { SpeciesBadge } from '@/components/midnight';
import { useSalesFeed, type LeftoverSale } from '@/features/leftover/queries';
import { saleClock, saleStatus, saleTypeLabel } from '@/features/leftover/format';
import {
  DEFAULT_OFFSETS,
  MECHANIC_LABEL,
  MECHANIC_LINE,
  PROGRAMMES,
  RESEARCHING,
  offsetLine,
  type Programme,
} from '@/features/leftover/programmes';
import { BrowseStateChip } from '@/components/BrowseStateChip';
import { openExternalUrl } from '@/lib/openUrl';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

/**
 * Leftovers.
 *
 * This screen has an unusual job: for most of the year it has no dates to
 * show. Every leftover sale in the country happens between March and
 * September, and the draws that create them are decided in spring. A screen
 * that said "nothing to show" for eight months would be worthless in the four
 * that matter, because nobody would have learned what it was for.
 *
 * So the explanation IS the screen, and the dates slot into it when they
 * exist. A hunter arriving in December should leave knowing that Montana's is
 * a sign-up list, that Oregon's is 10 a.m. Pacific on the first of July and
 * will not move, and that they will be told three times before it happens.
 *
 * The order is deliberate: what this is, what you will be told and when, then
 * your own sales if any are coming, then state by state. The reference
 * material goes last because it is the part you read once.
 */
export default function Leftovers() {
  const router = useRouter();
  const { data: sales, isLoading, browsing, stateCode } = useSalesFeed();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator color={color.copper} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ title: 'Leftovers' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Headline>The tags nobody drew.</Headline>
          <Sentence style={{ marginTop: space.x16 }}>
            Most western tags go by draw, and every year some go unclaimed. Those come back on
            sale — and in the states that sell them first come, first served, the good units are
            gone inside an hour.
          </Sentence>
          <Sentence style={{ marginTop: space.x12 }}>
            This is the one date in hunting where knowing the day is not enough.
          </Sentence>
          {browsing ? (
            <View style={{ marginTop: space.x12 }}>
              <BrowseStateChip stateCode={stateCode} />
            </View>
          ) : null}
        </View>

        {/* What you will be told, and when. Said before the dates, because for
            most of the year this is the only part with anything in it. */}
        <Tile style={styles.tile}>
          <Micro>What we do</Micro>
          <Sentence style={{ marginTop: space.x8 }}>
            We read the agencies' own pages every night. When a sale date appears for something
            you follow, you get told {DEFAULT_OFFSETS.map(offsetLine).join(', then ')}.
          </Sentence>
          <Rule space={space.x16} />
          {DEFAULT_OFFSETS.map((off) => (
            <View key={off} style={styles.offsetRow}>
              <Serif style={styles.offsetMark}>{off === 0 ? 'Today' : `−${off}`}</Serif>
              <Text style={styles.offsetText}>
                {off === 7
                  ? 'A week out. Time to decide which unit you actually want.'
                  : off === 1
                    ? 'The day before. Licence account logged in, card to hand.'
                    : 'The morning of, four hours before a 10 a.m. Mountain sale.'}
              </Text>
            </View>
          ))}
          <LinkSentence onPress={() => router.push('/alerts')} style={{ marginTop: space.x16 }}>
            Change which warnings you get
          </LinkSentence>
        </Tile>

        {/* Dates, when there are any. */}
        {sales.length > 0 ? (
          <Tile style={styles.tile}>
            <Micro>Coming up</Micro>
            {sales.map((s) => (
              <SaleRow key={s.id} sale={s} onPress={() => router.push(`/leftover/${s.id}`)} />
            ))}
          </Tile>
        ) : (
          <Tile style={styles.tile}>
            <Micro>Coming up</Micro>
            <Sentence style={{ marginTop: space.x8 }}>
              Nothing announced yet. Leftover sales land between March and September, after the
              draws they come from are settled — so an empty list in the back half of the year is
              the normal state of things, not a gap.
            </Sentence>
          </Tile>
        )}

        {/* State by state. The part that answers "exactly what happens". */}
        <View style={styles.sectionHead}>
          <Micro>State by state</Micro>
          <Sentence style={{ marginTop: space.x8 }}>
            A leftover sale is not one thing repeated six times. Montana's is a list you join by a
            deadline. Oregon's is an hour written into regulation. Utah's runs until the tags are
            gone. Turning up expecting the wrong one is how people miss them.
          </Sentence>
        </View>

        {PROGRAMMES.map((p) => (
          <ProgrammeCard key={p.code} programme={p} />
        ))}

        <View style={{ marginTop: space.section }}>
          <Micro>Not yet covered</Micro>
          <Sentence style={{ marginTop: space.x8 }}>
            {RESEARCHING.length} more states are believed to run a leftover, surplus or second-draw
            programme. Three of them cannot be read by a machine at all — Arizona refuses automated
            requests, North Dakota puts availability behind a sign-in, and South Dakota publishes a
            PDF it replaces each year rather than keeping a page. We would rather say nothing about
            a state than guess at its date.
          </Sentence>
          <Sentence style={{ marginTop: space.x12, color: color.dim }}>
            {RESEARCHING.join(' · ')}
          </Sentence>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * One state's programme.
 *
 * The mechanic is the headline, not the state name: two states' sales can
 * share a month and still want completely different behaviour from you. The
 * copper is spent on the mechanic for that reason, and nowhere else in the
 * card.
 */
function ProgrammeCard({ programme: p }: { programme: Programme }) {
  return (
    <Tile style={styles.tile}>
      <View style={styles.cardHead}>
        <Serif style={styles.cardCode}>{p.code}</Serif>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardState}>{p.state}</Text>
          <Text style={styles.cardCalls} numberOfLines={2}>
            {p.calls_them}
          </Text>
        </View>
      </View>

      <Text style={styles.mechanic}>{MECHANIC_LABEL[p.mechanic]}</Text>
      <Text style={styles.mechanicLine}>{MECHANIC_LINE[p.mechanic]}</Text>

      <Rule space={space.x16} />

      <Micro>When</Micro>
      <Text style={styles.when}>{p.when}</Text>
      {p.date_source === 'rule' ? (
        <Text style={styles.sourceNote}>
          Fixed by regulation, so this date does not move year to year.
        </Text>
      ) : p.date_source === 'announcement' ? (
        <Text style={styles.sourceNote}>
          Published in a news release rather than on a page, so this one is entered by hand.
        </Text>
      ) : (
        <Text style={styles.sourceNote}>Read from the agency's page nightly.</Text>
      )}

      {p.watch_out?.length ? (
        <>
          <Rule space={space.x16} />
          <Micro>Watch out</Micro>
          {p.watch_out.map((w) => (
            <View key={w} style={styles.bulletRow}>
              <Text style={styles.bulletMark}>·</Text>
              <Text style={styles.bullet}>{w}</Text>
            </View>
          ))}
        </>
      ) : null}

      <LinkSentence onPress={() => openExternalUrl(p.url)} style={{ marginTop: space.x16 }}>
        {p.state}'s own page
      </LinkSentence>
    </Tile>
  );
}

/** Same row as the Tags tab, so a sale reads the same wherever you meet it. */
function SaleRow({ sale, onPress }: { sale: LeftoverSale; onPress: () => void }) {
  const status = saleStatus(sale);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <SpeciesBadge name={sale.species?.name} size={34} muted={!status.urgent} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {sale.state?.code} {sale.name}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {saleTypeLabel(sale.sale_type)} · {saleClock(sale)}
        </Text>
      </View>
      <Text style={[styles.metric, { color: status.urgent ? color.copper : color.muted }]}>
        {status.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.bg },
  content: { paddingHorizontal: space.gutter, paddingTop: space.x16, paddingBottom: 56 },
  header: { marginTop: space.x12 },
  sectionHead: { marginTop: space.section },

  tile: { marginTop: space.x12 },

  offsetRow: { flexDirection: 'row', gap: space.x12, alignItems: 'baseline', paddingVertical: 5 },
  offsetMark: {
    fontFamily: type.display,
    fontSize: 19,
    color: color.copper,
    width: 54,
    fontVariant: ['tabular-nums'],
  },
  offsetText: { flex: 1, fontFamily: type.ui, fontSize: 13.5, lineHeight: 20, color: color.muted },

  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.x12 },
  cardCode: {
    fontFamily: type.display,
    fontSize: 28,
    color: color.bone,
    width: 54,
    fontVariant: ['tabular-nums'],
  },
  cardState: { fontFamily: type.uiMedium, fontSize: 16, color: color.bone },
  cardCalls: { fontFamily: type.ui, fontSize: 12.5, color: color.dim, marginTop: 2 },

  mechanic: {
    fontFamily: type.uiMedium,
    fontSize: 13,
    color: color.copper,
    marginTop: space.x16,
  },
  mechanicLine: {
    fontFamily: type.ui,
    fontSize: 13.5,
    lineHeight: 20,
    color: color.muted,
    marginTop: 4,
  },

  when: { fontFamily: type.ui, fontSize: 14.5, lineHeight: 22, color: color.bone, marginTop: 6 },
  sourceNote: { fontFamily: type.ui, fontSize: 12.5, lineHeight: 19, color: color.dim, marginTop: 6 },

  bulletRow: { flexDirection: 'row', gap: space.x8, marginTop: 7 },
  bulletMark: { fontFamily: type.ui, fontSize: 13.5, color: color.dim },
  bullet: { flex: 1, fontFamily: type.ui, fontSize: 13.5, lineHeight: 20, color: color.muted },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.x12, paddingVertical: 11 },
  rowTitle: { fontFamily: type.uiMedium, fontSize: 15.5, color: color.bone },
  rowSub: { fontFamily: type.ui, fontSize: 12.5, color: color.muted, marginTop: 1 },
  metric: {
    fontFamily: type.uiMedium,
    fontSize: 12.5,
    marginLeft: space.x8,
    fontVariant: ['tabular-nums'],
  },

  pressed: { opacity: 0.6 },
});
