/**
 * Engraved species art — public-domain line illustrations (Pearson Scott
 * Foresman archive, Wikimedia Commons) traced to single-color SVG paths.
 * At badge sizes the hatching reads as a silhouette; at hero sizes the
 * engraved line work shows through.
 */
import Svg, { Path } from 'react-native-svg';
import engravings from '@/assets/engravings.json';

type EngravingData = { viewBox: string; d: string };
const art = engravings as Record<string, EngravingData>;

/** Resolve a species display name (e.g. "Deer", "White-tailed deer") to art. */
export function engravingFor(name: string | null | undefined): EngravingData | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  if (art[n]) return art[n];
  for (const key of Object.keys(art)) {
    if (n.includes(key)) return art[key];
  }
  return null;
}

export function Engraving({
  data,
  size,
  color,
  opacity = 1,
}: {
  data: EngravingData;
  size: number;
  color: string;
  opacity?: number;
}) {
  return (
    <Svg viewBox={data.viewBox} width={size} height={size} opacity={opacity}>
      <Path d={data.d} fill={color} />
    </Svg>
  );
}
