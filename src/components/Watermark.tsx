/**
 * A species medallion run large and faint behind a heading.
 *
 * The plate is the one in src/assets/medallions — the ringed copper art, which
 * Medallion.tsx was always built for ("the full ringed plate for watermarks").
 * The first cut of this used the SVG engravings instead, which are the badge
 * art, and David caught it on build 100: "it looks like the background is
 * using the old animal carvings instead of the new medallions."
 *
 * It is never decoration: the plate is the species the screen is about, so the
 * shape says "deer" before a word is read. Only seven species have a plate,
 * and the rest get nothing rather than a stand-in — a deer behind a turkey
 * season would be an illustration pretending to be information.
 *
 * Unlike the engravings, this art carries its own fade: it is pale copper at
 * roughly 12% mean coverage, so the opacity here multiplies an already-soft
 * plate rather than knocking back a solid fill.
 */
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Medallion } from '@/components/Medallion';
import { lang } from '@/theme/tokens';

export function Watermark({
  species,
  size = 210,
  /**
   * 5%, David's call (2026-11-08) after the switch from the engravings. Note
   * this multiplies art that is already pale copper at roughly 12% mean
   * coverage, so it lands far fainter than 5% did on the solid engravings —
   * a hint of a plate rather than a plate.
   */
  opacity = 0.05,
  style,
}: {
  species: string | null | undefined;
  size?: number;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', top: -16, right: -lang.space.gutter }, style]}>
      <Medallion species={species} size={size} opacity={opacity} />
    </View>
  );
}
