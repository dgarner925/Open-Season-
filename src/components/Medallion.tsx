/**
 * Species medallions — engraved copper plates on a knocked-out background, so
 * each one composites on any surface in the Ember palette instead of showing
 * as a dark square.
 *
 * These are the big-game plates only: seven species carry most of the follows,
 * and a watermark is an accent, not a requirement. Anything without a plate
 * simply doesn't get one — the page reads the same, just quieter, and the SVG
 * engravings in Engraving.tsx cover everything else.
 *
 * Two cuts of the same art: the full ringed plate for watermarks, and a
 * badge cut (scripts/make_badges.py) with the ring thrown away and the animal
 * filling the frame, because a ring turns to mush at 34pt.
 */
import { Image, type ImageStyle, type StyleProp } from 'react-native';

const plates = {
  bear: require('../assets/medallions/bear.png'),
  bobwhite: require('../assets/medallions/bobwhite.png'),
  deer: require('../assets/medallions/deer.png'),
  duck: require('../assets/medallions/duck.png'),
  elk: require('../assets/medallions/elk.png'),
  turkey: require('../assets/medallions/turkey.png'),
  'wild-hog': require('../assets/medallions/wild-hog.png'),
} as const;

/**
 * The badge cut. These are white-on-transparent MASKS, not finished art — the
 * caller tints them, so a badge stays copper when it's followed and goes grey
 * when it isn't, exactly as the SVG engravings did.
 */
const badges = {
  bear: require('../assets/badges/bear.png'),
  bobwhite: require('../assets/badges/bobwhite.png'),
  deer: require('../assets/badges/deer.png'),
  duck: require('../assets/badges/duck.png'),
  elk: require('../assets/badges/elk.png'),
  turkey: require('../assets/badges/turkey.png'),
  'wild-hog': require('../assets/badges/wild-hog.png'),
} as const;

export type MedallionKey = keyof typeof plates;

/**
 * Species name (as the database spells it) -> plate. Ordered: the first match
 * wins, so "Brown/grizzly bear" is caught by 'bear' and "Bobwhite quail" by
 * 'quail'. A few species borrow a neighbour's plate where the silhouette is
 * honest at watermark scale — a western quail is a quail. Nothing borrows
 * across that line: a javelina is not a hog here.
 */
const matchers: [RegExp, MedallionKey][] = [
  [/\bdeer\b/i, 'deer'],
  [/\belk\b/i, 'elk'],
  [/\bbear\b/i, 'bear'],
  [/\bturkey\b/i, 'turkey'],
  [/\bquail\b/i, 'bobwhite'],
  [/\bhog\b|\bboar\b|\bpig\b/i, 'wild-hog'],
  [/\bduck|\bmallard\b|\bteal\b/i, 'duck'],
];

export function medallionFor(name: string | null | undefined): MedallionKey | null {
  if (!name) return null;
  for (const [re, key] of matchers) {
    if (re.test(name)) return key;
  }
  return null;
}

/**
 * The badge-sized cut, tinted. Renders nothing when the species has no plate,
 * so the caller can fall straight through to the SVG engraving.
 */
export function MedallionBadge({
  species,
  size,
  color,
}: {
  species: string | null | undefined;
  size: number;
  color: string;
}) {
  const key = medallionFor(species);
  if (!key) return null;
  return (
    <Image
      source={badges[key]}
      style={{ width: size, height: size, tintColor: color }}
      resizeMode="contain"
      // Decorative: every badge sits beside the species name already.
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

export function Medallion({
  species,
  size,
  opacity = 1,
  style,
}: {
  /** The species display name; resolved to a plate, or nothing renders. */
  species: string | null | undefined;
  size: number;
  opacity?: number;
  style?: StyleProp<ImageStyle>;
}) {
  const key = medallionFor(species);
  if (!key) return null;
  return (
    <Image
      source={plates[key]}
      style={[{ width: size, height: size, opacity }, style]}
      resizeMode="contain"
      // Decorative: the species name is already the page title.
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
