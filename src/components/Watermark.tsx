/**
 * An engraved plate run large and faint behind a heading.
 *
 * The art is the same public-domain engraving set the species badges use
 * (src/assets/engravings.json), at ~5% so it reads as paper texture rather
 * than illustration — a field journal with a plate printed under the entry.
 *
 * It is never decoration: the plate is the species the screen is about, so a
 * glance at the shape says "deer" before a word is read (David, 2026-11-08:
 * "subdued antlers or other animal silhouettes"). If there is no plate for a
 * species, nothing renders — a stand-in animal would be a lie about what the
 * screen is for.
 */
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Engraving, engravingFor } from '@/components/Engraving';
import { lang } from '@/theme/tokens';

export function Watermark({
  species,
  size = 210,
  /**
   * 0.07 on #0A0A0A — chosen against all eight plates at once, not just the
   * deer (David, 2026-11-08). 0.05 read as texture on a laptop at night and
   * vanished on the thinner plates in daylight; past ~0.10 it stops being
   * paper and becomes a picture competing with the headline.
   */
  opacity = 0.07,
  tone = 'bone',
  style,
}: {
  species: string | null | undefined;
  size?: number;
  opacity?: number;
  tone?: 'bone' | 'copper';
  style?: StyleProp<ViewStyle>;
}) {
  const art = engravingFor(species);
  if (!art) return null;
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', top: -16, right: -lang.space.gutter }, style]}>
      <Engraving
        data={art}
        size={size}
        color={tone === 'copper' ? lang.color.copper : lang.color.bone}
        opacity={opacity}
      />
    </View>
  );
}
