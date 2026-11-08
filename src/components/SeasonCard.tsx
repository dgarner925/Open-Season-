import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Medallion } from '@/components/Medallion';
import type { SeasonCard as CardData } from '@/features/card/season';
import { attrName } from '@/components/LaunchQuote';
import { lang } from '@/theme/tokens';

const { color, type } = lang;

/**
 * The shareable season card.
 *
 * Laid out at a fixed 540 × 675 and scaled by the caller, so the composition
 * is identical on every phone and the captured image is identical to the
 * design proof (scripts/compose_season_card.py renders the same plate; keep
 * the two in step).
 *
 * Why fixed rather than responsive: this is an image, not a screen. A card
 * that reflows is a card whose typography you cannot trust, and the whole
 * point of it leaving the app is that it looks composed.
 */
export const CARD_W = 540;
export const CARD_H = 675;

const GUTTER = 42;
const MAX_ROWS = 6;

export const SeasonCard = forwardRef<View, { card: CardData }>(function SeasonCard({ card }, ref) {
  const rows = card.openers.slice(0, MAX_ROWS);
  const extra = card.openers.length - rows.length;
  const y1 = (card.year + 1) % 100;

  // Enough room for the quote only when the ledger left some. The plate must
  // never push its own footer off the card.
  const showQuote = Boolean(card.quote) && card.openers.length <= 5;

  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      {/* The plates go down first, bled hard off the edges so a ring never
          closes into a circle: a visible ring reads as a sticker, a cropped
          one reads as letterpress. */}
      {card.species[0] ? (
        <Medallion species={card.species[0]} size={330} opacity={0.075} style={styles.plate1} />
      ) : null}
      {card.species[1] ? (
        <Medallion species={card.species[1]} size={250} opacity={0.045} style={styles.plate2} />
      ) : null}
      {card.species[2] ? (
        <Medallion species={card.species[2]} size={200} opacity={0.05} style={styles.plate3} />
      ) : null}

      <Text style={styles.masthead}>OPEN SEASON</Text>

      {/* Both years: a hunting year runs across New Year, and "2026" alone
          would misname the spring turkey opener sitting in the ledger. */}
      <Text style={styles.year}>
        {card.year}–{String(y1).padStart(2, '0')}
      </Text>
      <Text style={styles.sub}>my season</Text>

      <Text style={styles.states}>{card.states.map((s) => s.toUpperCase()).join('   ·   ')}</Text>

      <View style={styles.rule} />

      <View style={styles.ledger}>
        {rows.map((o) => (
          <View key={o.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.species}>{o.speciesName}</Text>
              <Text style={styles.state}>{o.stateCode}</Text>
            </View>
            <Text style={styles.date}>{o.date}</Text>
          </View>
        ))}
        {extra > 0 ? <Text style={styles.more}>and {extra} more</Text> : null}
      </View>

      <View style={styles.rule} />

      <Text style={styles.count}>
        {card.openers.length} opener{card.openers.length === 1 ? '' : 's'}. {card.species.length}{' '}
        species. {card.states.length} state{card.states.length === 1 ? '' : 's'}.
      </Text>

      <View style={{ flex: 1 }} />

      {showQuote && card.quote ? (
        <>
          <Text style={styles.quote} numberOfLines={3}>
            “{card.quote.text}”
          </Text>
          <Text style={styles.attr}>{attrName(card.quote.attr)}</Text>
        </>
      ) : null}

      <Text style={styles.footer}>OSDATESANDDRAWS.COM</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: color.bg,
    paddingHorizontal: GUTTER,
    paddingTop: 36,
    paddingBottom: 30,
    overflow: 'hidden',
  },

  plate1: { position: 'absolute', right: -150, top: 30 },
  plate2: { position: 'absolute', left: -165, top: 345 },
  plate3: { position: 'absolute', right: -95, top: 520 },

  masthead: {
    fontFamily: type.uiSemiBold,
    fontSize: 10.5,
    letterSpacing: 4.2,
    color: color.copper,
    textAlign: 'center',
  },
  year: {
    fontFamily: type.display,
    fontSize: 86,
    lineHeight: 104,
    color: color.bone,
    textAlign: 'center',
    marginTop: 18,
  },
  sub: {
    fontFamily: type.displayItalic,
    fontSize: 32,
    lineHeight: 40,
    color: color.copper,
    textAlign: 'center',
  },
  states: {
    fontFamily: type.uiMedium,
    fontSize: 10.5,
    letterSpacing: 2,
    color: color.dim,
    textAlign: 'center',
    marginTop: 14,
  },

  rule: { height: StyleSheet.hairlineWidth, backgroundColor: '#2A2622', marginTop: 20 },

  ledger: { marginTop: 14 },
  row: { flexDirection: 'row', alignItems: 'center', height: 36 },
  species: { fontFamily: type.uiMedium, fontSize: 15.5, color: color.bone },
  state: { fontFamily: type.ui, fontSize: 10.5, color: color.dim, marginTop: 1 },
  // The date is the thing the card is about, so it takes the display serif.
  date: { fontFamily: type.display, fontSize: 27, color: color.copper },
  more: { fontFamily: type.ui, fontSize: 12.5, color: color.dim, marginTop: 4 },

  count: {
    fontFamily: type.ui,
    fontSize: 13.5,
    color: color.muted,
    textAlign: 'center',
    marginTop: 22,
  },

  quote: {
    fontFamily: type.displayItalic,
    fontSize: 19,
    lineHeight: 25,
    color: color.muted,
    textAlign: 'center',
  },
  attr: {
    fontFamily: type.uiSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: color.copperDim,
    textAlign: 'center',
    marginTop: 10,
  },

  footer: {
    fontFamily: type.uiMedium,
    fontSize: 9.5,
    letterSpacing: 2.2,
    color: color.dim,
    textAlign: 'center',
    marginTop: 22,
  },
});
