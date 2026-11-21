/**
 * Engraved fish, for the field plates.
 *
 * Line drawings in the spirit of the hunting medallions: a single ink stroke
 * on paper, light hatching, no fill beyond the paper itself. They are
 * deliberately simple and deliberately separate from everything else, so a
 * real engraving can replace one without touching a card.
 *
 * Each is drawn in a 100x44 viewBox and scales from there, so the three
 * plates line up whatever width the row gives them.
 *
 * What distinguishes them is what an angler would name: the trout's spots and
 * adipose fin, the striper's lateral stripes, the spotted bass's broken
 * blotch line. Three identical fish with different captions would be worse
 * than no art.
 */
import Svg, { Circle, Ellipse, G, Line, Path } from 'react-native-svg';
import { otwLang } from '@/theme/otwTokens';

export type FishArtKey = 'rainbow-trout' | 'striped-bass' | 'spotted-bass';

const INK = otwLang.color.ink;
const W = 100;
const H = 44;

type Props = { size?: number };

/** The body outline every fish shares, give or take its depth. */
function body(depth: number): string {
  const mid = H / 2;
  return [
    `M 10 ${mid}`,
    `C 22 ${mid - depth} 50 ${mid - depth} 72 ${mid - depth * 0.45}`,
    `C 80 ${mid - depth * 0.3} 84 ${mid - 2} 88 ${mid}`,
    `C 84 ${mid + 2} 80 ${mid + depth * 0.3} 72 ${mid + depth * 0.45}`,
    `C 50 ${mid + depth} 22 ${mid + depth} 10 ${mid}`,
    'Z',
  ].join(' ');
}

/** The forked tail. */
function tail(): string {
  const mid = H / 2;
  return `M 88 ${mid} L 97 ${mid - 8} L 93 ${mid} L 97 ${mid + 8} Z`;
}

function Base({
  size = 100,
  depth,
  children,
}: {
  size?: number;
  depth: number;
  children?: React.ReactNode;
}) {
  const height = (size * H) / W;
  return (
    <Svg width={size} height={height} viewBox={`0 0 ${W} ${H}`}>
      <G stroke={INK} strokeWidth={1.1} fill="none" strokeLinejoin="round">
        <Path d={body(depth)} />
        <Path d={tail()} />
        {/* Gill plate */}
        <Path d={`M 22 ${H / 2 - depth * 0.62} C 27 ${H / 2} 27 ${H / 2} 22 ${H / 2 + depth * 0.62}`} />
        {/* Eye */}
        <Circle cx={16} cy={H / 2 - 1.5} r={1.6} fill={INK} stroke="none" />
        {children}
      </G>
    </Svg>
  );
}

function RainbowTrout({ size }: Props) {
  const mid = H / 2;
  return (
    <Base size={size} depth={11}>
      {/* The adipose fin, which is what tells a trout from everything else. */}
      <Path d={`M 70 ${mid - 7} l 5 -1 l -1 3 z`} />
      {/* Dorsal and anal fins */}
      <Path d={`M 42 ${mid - 10.2} l 7 -5 l 7 4`} />
      <Path d={`M 48 ${mid + 10} l 5 5 l 6 -3`} />
      {/* The rainbow's lateral band -- a soft stripe, not a hard line. */}
      <Path d={`M 24 ${mid + 1} C 44 ${mid - 2} 60 ${mid - 2} 80 ${mid + 0.5}`} strokeOpacity={0.45} />
      {/* Spots, scattered above the band. */}
      {[
        [30, mid - 6], [38, mid - 4], [46, mid - 7], [54, mid - 3],
        [60, mid - 6], [68, mid - 4], [34, mid - 1], [50, mid + 2],
      ].map(([cx, cy], i) => (
        <Circle key={i} cx={cx} cy={cy} r={0.9} fill={INK} stroke="none" opacity={0.75} />
      ))}
    </Base>
  );
}

function StripedBass({ size }: Props) {
  const mid = H / 2;
  return (
    <Base size={size} depth={10}>
      {/* Two dorsals, spiny then soft -- a bass, not a trout. */}
      <Path d={`M 38 ${mid - 9.6} l 4 -6 l 4 6`} />
      <Path d={`M 50 ${mid - 9.8} l 6 -5 l 7 4`} />
      <Path d={`M 50 ${mid + 9.6} l 5 5 l 6 -3`} />
      {/* The stripes. Seven, running the length, which is the whole point. */}
      {[-6, -4, -2, 0, 2, 4, 6].map((off, i) => (
        <Path
          key={i}
          d={`M 26 ${mid + off} C 46 ${mid + off - 1} 62 ${mid + off - 1} 82 ${mid + off * 0.55}`}
          strokeOpacity={0.6}
          strokeWidth={0.8}
        />
      ))}
    </Base>
  );
}

function SpottedBass({ size }: Props) {
  const mid = H / 2;
  return (
    <Base size={size} depth={12}>
      <Path d={`M 38 ${mid - 11.4} l 4 -6 l 4 6`} />
      <Path d={`M 50 ${mid - 11.6} l 6 -5 l 7 4`} />
      <Path d={`M 50 ${mid + 11.4} l 5 5 l 6 -3`} />
      {/* The broken lateral blotch line: a row of dashes, heavier mid-body. */}
      {[28, 36, 44, 52, 60, 68, 76].map((x, i) => (
        <Ellipse
          key={i}
          cx={x}
          cy={mid + 0.5}
          rx={2.6 - Math.abs(i - 3) * 0.3}
          ry={1.5 - Math.abs(i - 3) * 0.15}
          fill={INK}
          stroke="none"
          opacity={0.7}
        />
      ))}
      {/* Hatching below the line, the way an engraver shades a flank. */}
      {[30, 38, 46, 54, 62, 70].map((x, i) => (
        <Line key={i} x1={x} y1={mid + 4} x2={x - 2} y2={mid + 8} strokeOpacity={0.3} strokeWidth={0.7} />
      ))}
    </Base>
  );
}

const ART: Record<FishArtKey, (p: Props) => React.ReactElement> = {
  'rainbow-trout': RainbowTrout,
  'striped-bass': StripedBass,
  'spotted-bass': SpottedBass,
};

export function FishPlate({ artKey, size }: { artKey: FishArtKey; size?: number }) {
  const Art = ART[artKey];
  // An unknown key draws nothing rather than guessing at a fish.
  if (!Art) return null;
  return <Art size={size} />;
}
