/**
 * The divider On the Water uses instead of a straight line.
 *
 * In the woods, groups of lines sit on a translucent tile and rules are rare.
 * On paper that trick does not work -- a near-white lift on cream is
 * invisible -- so OTW separates its sections with a drawn wave, which is also
 * the one piece of ornament an angler's notebook is entitled to.
 *
 * The path is built from the measured width rather than stretched to fit: a
 * fixed path scaled with preserveAspectRatio="none" would squash the wave to
 * a different shape on every screen size, and the shape is the point.
 */
import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { otwLang } from '@/theme/otwTokens';

const PERIOD = 24;
const AMPLITUDE = 5;
const STROKE = 1.3;

/** One full wave: up over the first half, down over the second. */
function wavePath(width: number, height: number): string {
  const mid = height / 2;
  const half = PERIOD / 2;
  const quarter = half / 2;
  let d = `M 0 ${mid}`;
  // One extra period so the wave runs off the right edge rather than stopping
  // short of it with a flat gap.
  for (let x = 0; x < width + PERIOD; x += PERIOD) {
    d += ` q ${quarter} ${-AMPLITUDE} ${half} 0`;
    d += ` q ${quarter} ${AMPLITUDE} ${half} 0`;
  }
  return d;
}

export function WavyRule({
  tone = 'brass',
  style,
}: {
  /** Brass between major sections; the fainter river variant within one. */
  tone?: 'brass' | 'river';
  style?: StyleProp<ViewStyle>;
}) {
  const [width, setWidth] = useState(0);
  const height = AMPLITUDE * 2 + STROKE * 2;

  const stroke = tone === 'brass' ? otwLang.color.brass : otwLang.color.river;
  const opacity = tone === 'brass' ? 1 : 0.35;

  return (
    <View
      style={[{ height }, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      // Decorative. A screen reader announcing "image" between every section
      // is noise, and the wave carries no information the headings do not.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Path
            d={wavePath(width, height)}
            stroke={stroke}
            strokeOpacity={opacity}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
      ) : null}
    </View>
  );
}
