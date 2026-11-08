import { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Medallion } from '@/components/Medallion';
import type { SeasonCard as CardData } from '@/features/card/season';
import { attrName } from '@/components/LaunchQuote';
import { lang } from '@/theme/tokens';

const { color, type } = lang;

/**
 * The shareable season card.
 *
 * Composed against a 540 × 675 reference and laid out at whatever width the
 * caller asks for, with every dimension multiplied by width/540. The
 * proportions are therefore identical at any size, and the design proof
 * (scripts/compose_season_card.py) renders the same plate at the same
 * reference — keep the two in step.
 *
 * Scaled by real layout rather than by `transform: scale()` on purpose. A
 * transformed view is captured inconsistently by react-native-view-shot (iOS
 * draws the on-screen result, so the snapshot comes out at the shrunken size),
 * and this card exists to be captured. Laying it out at its true size means
 * captureRef sees exactly what the reader sees.
 *
 * Why fixed proportions rather than a responsive design: this is an image, not
 * a screen. An image that reflows is one whose typography you cannot trust.
 */
export const CARD_W = 540;
export const CARD_H = 675;
export const CARD_RATIO = CARD_H / CARD_W;

const MAX_ROWS = 6;

export const SeasonCard = forwardRef<View, { card: CardData; width?: number }>(function SeasonCard(
  { card, width = CARD_W },
  ref,
) {
  const s = width / CARD_W;
  const styles = useMemo(() => makeStyles(s), [s]);

  const rows = card.openers.slice(0, MAX_ROWS);
  const extra = card.openers.length - rows.length;
  const y1 = (card.year + 1) % 100;

  // The quote goes in only when the ledger left room. The plate must never
  // push its own footer off the card.
  const showQuote = Boolean(card.quote) && card.openers.length <= 5;

  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      {/* The plates go down first, bled hard off the edges so a ring never
          closes into a circle: a visible ring reads as a sticker, a cropped
          one reads as letterpress. */}
      {card.species[0] ? (
        <Medallion species={card.species[0]} size={330 * s} opacity={0.075} style={styles.plate1} />
      ) : null}
      {card.species[1] ? (
        <Medallion species={card.species[1]} size={250 * s} opacity={0.045} style={styles.plate2} />
      ) : null}
      {card.species[2] ? (
        <Medallion species={card.species[2]} size={200 * s} opacity={0.05} style={styles.plate3} />
      ) : null}

      <Text style={styles.masthead}>OPEN SEASON</Text>

      {/* Both years: a hunting year runs across New Year, and "2026" alone
          would misname the spring turkey opener sitting in the ledger. */}
      <Text style={styles.year}>
        {card.year}–{String(y1).padStart(2, '0')}
      </Text>
      <Text style={styles.sub}>my season</Text>

      <Text style={styles.states}>{card.states.map((x) => x.toUpperCase()).join('   ·   ')}</Text>

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

/** Every dimension in reference units, multiplied by the layout scale. */
function makeStyles(s: number) {
  return StyleSheet.create({
    card: {
      width: CARD_W * s,
      height: CARD_H * s,
      backgroundColor: color.bg,
      paddingHorizontal: 42 * s,
      paddingTop: 36 * s,
      paddingBottom: 30 * s,
      overflow: 'hidden',
    },

    plate1: { position: 'absolute', right: -150 * s, top: 30 * s },
    plate2: { position: 'absolute', left: -165 * s, top: 345 * s },
    plate3: { position: 'absolute', right: -95 * s, top: 520 * s },

    masthead: {
      fontFamily: type.uiSemiBold,
      fontSize: 10.5 * s,
      letterSpacing: 4.2 * s,
      color: color.copper,
      textAlign: 'center',
    },
    year: {
      fontFamily: type.display,
      fontSize: 86 * s,
      lineHeight: 104 * s,
      color: color.bone,
      textAlign: 'center',
      marginTop: 18 * s,
    },
    sub: {
      fontFamily: type.displayItalic,
      fontSize: 32 * s,
      lineHeight: 40 * s,
      color: color.copper,
      textAlign: 'center',
    },
    states: {
      fontFamily: type.uiMedium,
      fontSize: 10.5 * s,
      letterSpacing: 2 * s,
      color: color.dim,
      textAlign: 'center',
      marginTop: 14 * s,
    },

    rule: { height: StyleSheet.hairlineWidth, backgroundColor: '#2A2622', marginTop: 20 * s },

    ledger: { marginTop: 14 * s },
    row: { flexDirection: 'row', alignItems: 'center', height: 36 * s },
    species: { fontFamily: type.uiMedium, fontSize: 15.5 * s, color: color.bone },
    state: { fontFamily: type.ui, fontSize: 10.5 * s, color: color.dim, marginTop: 1 * s },
    // The date is the thing the card is about, so it takes the display serif.
    date: { fontFamily: type.display, fontSize: 27 * s, color: color.copper },
    more: { fontFamily: type.ui, fontSize: 12.5 * s, color: color.dim, marginTop: 4 * s },

    count: {
      fontFamily: type.ui,
      fontSize: 13.5 * s,
      color: color.muted,
      textAlign: 'center',
      marginTop: 22 * s,
    },

    quote: {
      fontFamily: type.displayItalic,
      fontSize: 19 * s,
      lineHeight: 25 * s,
      color: color.muted,
      textAlign: 'center',
    },
    attr: {
      fontFamily: type.uiSemiBold,
      fontSize: 9.5 * s,
      letterSpacing: 1.6 * s,
      color: color.copperDim,
      textAlign: 'center',
      marginTop: 10 * s,
    },

    footer: {
      fontFamily: type.uiMedium,
      fontSize: 9.5 * s,
      letterSpacing: 2.2 * s,
      color: color.dim,
      textAlign: 'center',
      marginTop: 22 * s,
    },
  });
}
