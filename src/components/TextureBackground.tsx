import { memo, type ReactNode } from 'react';
import { StyleSheet, View, useColorScheme, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { theme } from '@/theme';

/**
 * Ambient field-map texture — topographic contour lines, like elevation rings
 * on a USGS quad sheet. Chrome surfaces only (sign-in, onboarding, settings,
 * empty states, headers); never behind season tables or other dense data rows.
 *
 * The pattern is generated, not drawn: 2–3 "basins", each a family of nested
 * closed curves sharing one harmonic noise profile (same profile = rings never
 * cross, just like real contours). Everything derives from a fixed seed, so
 * the pattern is identical on every render and every device.
 */

// Deterministic PRNG (mulberry32) — same seed, same mountains, forever.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Design canvas — sliced to fill whatever box the component gets, so the
// curves stay large-scale on every screen size.
const VB_W = 390;
const VB_H = 844;

type Pt = readonly [number, number];

/** Closed Catmull-Rom spline through pts, emitted as cubic beziers. */
function closedPath(pts: Pt[]): string {
  const n = pts.length;
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + ' Z';
}

function generateContours(seed: number, scale: number): string[] {
  const rnd = mulberry32(seed);
  const paths: string[] = [];
  const basins = 2 + Math.floor(rnd() * 2); // 2–3 peaks per screen — a few curves, never busy
  for (let b = 0; b < basins; b++) {
    const cx = VB_W * (0.1 + 0.8 * rnd());
    const cy = VB_H * (0.08 + 0.84 * rnd());
    // One noise profile per basin: low-order harmonics keep the shapes
    // irregular but calm. Shared across rings so they nest without crossing.
    const harmonics = [2, 3, 5].map((k) => ({
      k,
      amp: 0.04 + 0.08 * rnd(),
      ph: rnd() * Math.PI * 2,
    }));
    const rings = 4 + Math.floor(rnd() * 3); // 4–6 contour lines
    const r0 = (70 + 60 * rnd()) * scale;
    const step = (36 + 20 * rnd()) * scale;
    for (let i = 0; i < rings; i++) {
      const base = r0 + i * step;
      const pts: Pt[] = [];
      const N = 56;
      for (let j = 0; j < N; j++) {
        const t = (j / N) * Math.PI * 2;
        let f = 1;
        for (const h of harmonics) f += h.amp * Math.sin(h.k * t + h.ph);
        const r = base * f;
        pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
      }
      paths.push(closedPath(pts));
    }
  }
  return paths;
}

// Deterministic → compute once per (seed, scale) for the app's lifetime.
const cache = new Map<string, string[]>();
function contours(seed: number, scale: number): string[] {
  const key = `${seed}:${scale}`;
  let p = cache.get(key);
  if (!p) {
    p = generateContours(seed, scale);
    cache.set(key, p);
  }
  return p;
}

export const TextureBackground = memo(function TextureBackground({
  intensity = 1,
  seed = 11,
  children,
  style,
}: {
  /** Opacity multiplier on theme.texture.opacity. Result is clamped to 6%. */
  intensity?: number;
  /** Vary per screen for a different (but stable) landform. */
  seed?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const scheme = useColorScheme();
  const tokens = scheme === 'light' ? theme.textureLight : theme.texture;
  const opacity = Math.min(tokens.opacity * intensity, 0.06);
  return (
    <View style={[styles.wrap, style]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice">
          {contours(seed, tokens.scale).map((d, i) => (
            <Path key={i} d={d} stroke={tokens.color} strokeOpacity={opacity} strokeWidth={1.25} fill="none" />
          ))}
        </Svg>
      </View>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
});
