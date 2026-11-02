/**
 * The home masthead. It used to read "Open season." — the app's own name, in
 * the largest type on the screen, telling the reader what they already knew.
 * Now it reads whatever today actually says: an opener, a front, or the light.
 *
 * The words are chosen in heroLine(); this only sets them. Three layers:
 * a small-caps overline for context, the two serif lines (upright, then italic
 * copper), and the supporting line that always carries the light. The species
 * medallion sits behind it all at a whisper, so a changing hero still reads as
 * one screen rather than three different ones.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Engraving, engravingFor } from '@/components/Engraving';
import { MedallionBadge, medallionFor } from '@/components/Medallion';
import type { Hero } from '@/features/home/heroLine';
import { fontFamily, spacing, theme } from '@/theme';
import { lang } from '@/theme/tokens';

/**
 * Hold the two lines to one line each. "Deer opens" gets the full 48pt;
 * "Black bear opens" would wrap there, and a wrapped hero loses the shape the
 * whole thing is built on.
 */
function serifSize(hero: Hero): number {
  const longest = Math.max(hero.lead.length, hero.accent.length);
  if (longest > 17) return 34;
  if (longest > 14) return 38;
  if (longest > 11) return 42;
  return 48;
}

export function HomeHero({ hero }: { hero: Hero }) {
  const size = serifSize(hero);
  // Engraved plate first, the SVG engraving for everything else — the same
  // order SpeciesBadge uses, so a duck gets a watermark too.
  const plate = medallionFor(hero.species);
  const art = plate ? null : engravingFor(hero.species);
  return (
    <View style={styles.block}>
      {plate || art ? (
        <View style={styles.watermark} pointerEvents="none">
          {plate ? (
            <MedallionBadge species={hero.species} size={190} color={lang.color.copper} />
          ) : (
            <Engraving data={art!} size={170} color={lang.color.copper} />
          )}
        </View>
      ) : null}
      <View>
        <Text style={[styles.overline, hero.voice === 'opener' && styles.overlineLive]} numberOfLines={1}>
          {hero.overline}
        </Text>
        <Text style={[styles.lead, { fontSize: size, lineHeight: size * 1.06 }]} numberOfLines={1} adjustsFontSizeToFit>
          {hero.lead}
        </Text>
        <Text style={[styles.accent, { fontSize: size, lineHeight: size * 1.1 }]} numberOfLines={1} adjustsFontSizeToFit>
          {hero.accent}
        </Text>
        {hero.support ? (
          <Text style={styles.support} numberOfLines={2}>
            {hero.support}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: spacing.xl, position: 'relative', overflow: 'hidden' },
  // Cropped off the right edge on purpose — the medallion is a texture here,
  // not an illustration, and a whole animal at 0.16 reads as a mistake.
  watermark: { position: 'absolute', right: -54, top: -12, opacity: 0.16 },
  overline: {
    fontFamily: fontFamily.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: theme.color.textMuted,
  },
  overlineLive: { color: theme.color.accent },
  lead: { fontFamily: fontFamily.serif, color: theme.color.textPrimary, marginTop: spacing.sm, letterSpacing: -0.5 },
  accent: { fontFamily: fontFamily.serifItalic, color: theme.color.accent, letterSpacing: -0.5 },
  support: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 14.5,
    lineHeight: 21,
    color: theme.color.textSecondary,
    marginTop: spacing.sm,
  },
});
