/**
 * A field plate: the fishing mode's answer to the hunting medallions.
 *
 * A double border with a 3pt gap between the rules, which is how a plate in a
 * Victorian catalogue is mounted, then the engraving, the common name, and
 * the Latin name in italic underneath.
 *
 * "PLATE I" is the one place IM Fell English Small Caps earns its package.
 */
import { StyleSheet, Text, View } from 'react-native';
import { FishPlate, type FishArtKey } from './fish';
import { otwLang } from '@/theme/otwTokens';

const { color, space, type } = otwLang;

export function FlyPlateCard({
  artKey,
  plate,
  commonName,
  latinName,
}: {
  artKey: FishArtKey;
  plate: string;
  commonName: string;
  latinName: string;
}) {
  return (
    <View style={styles.outer}>
      <View style={styles.inner}>
        <Text style={styles.plate} numberOfLines={1}>
          {plate}
        </Text>
        <View style={styles.art}>
          <FishPlate artKey={artKey} size={88} />
        </View>
        <Text style={styles.common} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {commonName}
        </Text>
        <Text style={styles.latin} numberOfLines={1}>
          {latinName}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.plateBorder,
    borderRadius: 3,
    padding: 3,
  },
  inner: {
    borderWidth: 1,
    borderColor: color.plateBorderInner,
    borderRadius: 1,
    alignItems: 'center',
    paddingVertical: space.x8,
    paddingHorizontal: 4,
  },
  plate: {
    fontFamily: type.otwSmallCaps,
    fontSize: 10,
    letterSpacing: 0.8,
    color: color.brassText,
  },
  art: { marginVertical: 2 },
  common: { fontFamily: type.otwDisplay, fontSize: 14, color: color.ink, textAlign: 'center' },
  latin: {
    fontFamily: type.otwDisplayItalic,
    fontSize: 10.5,
    color: color.dim,
    textAlign: 'center',
    marginTop: -1,
  },
});
