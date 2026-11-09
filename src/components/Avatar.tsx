import { Image } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import { lang } from '@/theme/tokens';

const { color, type } = lang;

/**
 * A face, or the next best thing.
 *
 * Most people will never set a photo, so the fallback is the common case and
 * is treated as the real design rather than a grey circle: the initial in the
 * display serif on a warm plate, which is the same material the species
 * medallions use. A roster of these reads as a roster, not as a list of
 * missing images.
 */
function initial(name: string): string {
  const n = (name ?? '').trim();
  if (!n) return '?';
  // Codepoint-aware, so an emoji or an accented letter does not come back
  // as half a character.
  return [...n][0].toUpperCase();
}

export function Avatar({
  name,
  url,
  size = 36,
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  const r = size / 2;
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[styles.img, { width: size, height: size, borderRadius: r }]}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View
      style={[styles.plate, { width: size, height: size, borderRadius: r }]}
      accessible={false}
    >
      <Text style={[styles.letter, { fontSize: Math.round(size * 0.44) }]}>{initial(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  img: { backgroundColor: color.tile },
  plate: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.tileWarm,
  },
  letter: {
    fontFamily: type.display,
    color: color.copper,
    // The serif sits high in its line box at these sizes; nudge it back.
    marginTop: 1,
  },
});
