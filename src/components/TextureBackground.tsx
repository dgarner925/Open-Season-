import { memo, type ReactNode } from 'react';
import { StyleSheet, View, useColorScheme, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { theme } from '@/theme';

/**
 * Ambient field-map texture — topographic contour lines, like elevation rings
 * on a USGS quad sheet. Chrome surfaces only (sign-in, onboarding, settings,
 * empty states, headers); never behind season tables or other dense data rows.
 *
 * Done the way real topography works: a single height field (a few smooth
 * hills on one surface) sampled on a grid, then its level lines traced with
 * marching squares. Because every line is a slice of the same landscape,
 * contours from neighboring hills MERGE into shared outer loops — they can
 * never cross. Every 3rd level renders heavier, like USGS index contours.
 * Everything derives from a fixed seed: identical on every render and device.
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
const CELL = 8; // sampling resolution in viewbox units
const LEVELS = 9;

type Pt = readonly [number, number];
type Contour = { d: string; index: boolean };

/** Trace all iso-lines of `grid` at `level` (marching squares + chaining). */
function traceLevel(grid: Float64Array, nx: number, ny: number, level: number): string[] {
  const segs: [Pt, Pt][] = [];
  const v = (i: number, j: number) => grid[j * nx + i];
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const tl = v(i, j);
      const tr = v(i + 1, j);
      const br = v(i + 1, j + 1);
      const bl = v(i, j + 1);
      const idx = (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const x = i * CELL;
      const y = j * CELL;
      const top = (): Pt => [x + (CELL * (level - tl)) / (tr - tl), y];
      const bot = (): Pt => [x + (CELL * (level - bl)) / (br - bl), y + CELL];
      const lef = (): Pt => [x, y + (CELL * (level - tl)) / (bl - tl)];
      const rig = (): Pt => [x + CELL, y + (CELL * (level - tr)) / (br - tr)];
      switch (idx) {
        case 1: case 14: segs.push([lef(), bot()]); break;
        case 2: case 13: segs.push([bot(), rig()]); break;
        case 3: case 12: segs.push([lef(), rig()]); break;
        case 4: case 11: segs.push([top(), rig()]); break;
        case 6: case 9: segs.push([top(), bot()]); break;
        case 7: case 8: segs.push([lef(), top()]); break;
        case 5: segs.push([lef(), top()], [bot(), rig()]); break;
        case 10: segs.push([top(), rig()], [lef(), bot()]); break;
      }
    }
  }

  // Chain segments into polylines by matching endpoints.
  const key = (p: Pt) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const at = new Map<string, number[]>();
  segs.forEach((s, i) => {
    for (const p of s) {
      const k = key(p);
      const arr = at.get(k);
      if (arr) arr.push(i);
      else at.set(k, [i]);
    }
  });
  const used = new Array(segs.length).fill(false);
  const paths: string[] = [];
  for (let s = 0; s < segs.length; s++) {
    if (used[s]) continue;
    used[s] = true;
    const line: Pt[] = [segs[s][0], segs[s][1]];
    // Extend forward then backward until no unused neighbor continues the chain.
    for (const dir of [1, 0] as const) {
      for (;;) {
        const end = dir === 1 ? line[line.length - 1] : line[0];
        const next = (at.get(key(end)) ?? []).find((i) => !used[i]);
        if (next === undefined) break;
        used[next] = true;
        const [a, b] = segs[next];
        const p = key(a) === key(end) ? b : a;
        if (dir === 1) line.push(p);
        else line.unshift(p);
      }
    }
    const closed = key(line[0]) === key(line[line.length - 1]);
    let d = `M ${line[0][0].toFixed(1)} ${line[0][1].toFixed(1)}`;
    for (let i = 1; i < line.length; i++) d += ` L ${line[i][0].toFixed(1)} ${line[i][1].toFixed(1)}`;
    paths.push(closed ? d + ' Z' : d);
  }
  return paths;
}

function generateContours(seed: number, scale: number): Contour[] {
  const rnd = mulberry32(seed);
  // A few broad elliptical hills on one shared surface.
  const peaks = Array.from({ length: 3 + Math.floor(rnd() * 2) }, () => ({
    x: VB_W * (0.05 + 0.9 * rnd()),
    y: VB_H * (0.05 + 0.9 * rnd()),
    amp: 0.6 + 0.5 * rnd(),
    sx: (90 + 110 * rnd()) * scale,
    sy: (90 + 110 * rnd()) * scale,
    rot: rnd() * Math.PI,
  }));
  const nx = Math.ceil(VB_W / CELL) + 1;
  const ny = Math.ceil(VB_H / CELL) + 1;
  const grid = new Float64Array(nx * ny);
  let max = 0;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = i * CELL;
      const y = j * CELL;
      let h = 0;
      for (const p of peaks) {
        const dx = x - p.x;
        const dy = y - p.y;
        const c = Math.cos(p.rot);
        const s = Math.sin(p.rot);
        const u = (dx * c + dy * s) / p.sx;
        const w = (-dx * s + dy * c) / p.sy;
        h += p.amp * Math.exp(-(u * u + w * w));
      }
      grid[j * nx + i] = h;
      if (h > max) max = h;
    }
  }
  const out: Contour[] = [];
  for (let l = 1; l <= LEVELS; l++) {
    const level = max * (0.12 + (0.8 * l) / LEVELS);
    const index = l % 3 === 0; // heavier "index contour", like a USGS quad
    for (const d of traceLevel(grid, nx, ny, level)) out.push({ d, index });
  }
  return out;
}

type Blob = { d: string; tone: number };

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

/**
 * Camo variant — original pattern, generated here (no commercial camo is
 * referenced): large organic blobs, single hue, tonal variation only.
 * Overlapping same-hue fills deepen naturally, which is what gives the
 * layered camo read at these opacities.
 */
function generateCamo(seed: number, scale: number): Blob[] {
  const rnd = mulberry32(seed);
  const blobs: Blob[] = [];
  const count = 9 + Math.floor(rnd() * 4);
  for (let b = 0; b < count; b++) {
    const cx = VB_W * (-0.05 + 1.1 * rnd());
    const cy = VB_H * (-0.05 + 1.1 * rnd());
    const r0 = (70 + 90 * rnd()) * scale;
    const harmonics = [2, 3, 5].map((k) => ({
      k,
      amp: 0.1 + 0.12 * rnd(),
      ph: rnd() * Math.PI * 2,
    }));
    const pts: Pt[] = [];
    const N = 40;
    for (let j = 0; j < N; j++) {
      const t = (j / N) * Math.PI * 2;
      let f = 1;
      for (const h of harmonics) f += h.amp * Math.sin(h.k * t + h.ph);
      pts.push([cx + r0 * f * Math.cos(t), cy + r0 * f * Math.sin(t)]);
    }
    blobs.push({ d: closedPath(pts), tone: [0.45, 0.7, 1][Math.floor(rnd() * 3)] });
  }
  return blobs;
}

// Deterministic → compute once per (seed, scale) for the app's lifetime.
const cache = new Map<string, Contour[]>();
function contours(seed: number, scale: number): Contour[] {
  const k = `${seed}:${scale}`;
  let p = cache.get(k);
  if (!p) {
    p = generateContours(seed, scale);
    cache.set(k, p);
  }
  return p;
}
const camoCache = new Map<string, Blob[]>();
function camoBlobs(seed: number, scale: number): Blob[] {
  const k = `${seed}:${scale}`;
  let p = camoCache.get(k);
  if (!p) {
    p = generateCamo(seed, scale);
    camoCache.set(k, p);
  }
  return p;
}

export const TextureBackground = memo(function TextureBackground({
  intensity = 1,
  seed = 11,
  variant,
  children,
  style,
}: {
  /** Opacity multiplier on theme.texture.opacity. Result is clamped to 6%. */
  intensity?: number;
  /** Vary per screen for a different (but stable) landform. */
  seed?: number;
  /** Defaults to theme.texture.variant — override per surface if ever needed. */
  variant?: 'topo' | 'camo';
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const scheme = useColorScheme();
  const tokens = scheme === 'light' ? theme.textureLight : theme.texture;
  const kind = variant ?? tokens.variant;
  const opacity = Math.min(tokens.opacity * intensity, 0.06);
  return (
    <View style={[styles.wrap, style]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice">
          {kind === 'camo'
            ? camoBlobs(seed, tokens.scale).map((b, i) => (
                <Path key={i} d={b.d} fill={tokens.color} fillOpacity={opacity * b.tone} />
              ))
            : contours(seed, tokens.scale).map((c, i) => (
                <Path
                  key={i}
                  d={c.d}
                  stroke={tokens.color}
                  strokeOpacity={opacity}
                  strokeWidth={c.index ? 2.2 : 1.3}
                  fill="none"
                />
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
