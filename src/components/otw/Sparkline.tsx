/**
 * The last 24 hours of discharge, and the release that has not happened yet.
 *
 * Solid line for what the gauge recorded, a dot for now, and a dashed tail
 * for a scheduled release. The dash is doing real work: it is the difference
 * between "the river did this" and "the river is expected to do this", and
 * drawing them the same way would be a quiet lie about which is which.
 *
 * Scaled to its own min and max rather than to zero, because the shape of the
 * change is the information; a 400-to-1500 swing flattens to nothing on an
 * axis that starts at zero.
 */
import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

const HEIGHT = 24;
const PAD = 3;

function pointsToPath(values: number[], toX: (i: number) => number, toY: (v: number) => number): string {
  return values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(2)} ${toY(v).toFixed(2)}`).join(' ');
}

export function Sparkline({
  history,
  projection = [],
  lineColor,
  nowColor,
  projectionColor,
  style,
}: {
  history: number[];
  projection?: number[];
  lineColor: string;
  nowColor: string;
  projectionColor: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [width, setWidth] = useState(0);

  // Two points are the minimum that make a line. One reading is a dot, and a
  // dot drawn as a trend would overstate what is known.
  const drawable = history.length >= 2 && width > 0;

  let body: React.ReactNode = null;
  if (drawable) {
    // The projection shares the vertical scale, or the release would appear
    // to land at the same height as the current flow.
    const all = [...history, ...projection];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const span = max - min || 1;

    // The whole series, history then projection, laid across the full width.
    const total = history.length + Math.max(projection.length - 1, 0);
    const step = total > 1 ? width / (total - 1) : 0;

    const toX = (i: number) => i * step;
    const toY = (v: number) => PAD + (1 - (v - min) / span) * (HEIGHT - PAD * 2);

    const nowIndex = history.length - 1;

    body = (
      <>
        <Path
          d={pointsToPath(history, toX, toY)}
          stroke={lineColor}
          strokeWidth={1.4}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {projection.length >= 2 ? (
          <Path
            // Starts at "now" so the dashed run continues the solid one
            // instead of floating free of it.
            d={pointsToPath(projection, (i) => toX(nowIndex + i), toY)}
            stroke={projectionColor}
            strokeWidth={1.2}
            strokeDasharray="3 3"
            fill="none"
            strokeLinecap="round"
          />
        ) : null}
        <Circle cx={toX(nowIndex)} cy={toY(history[nowIndex])} r={2.6} fill={nowColor} />
      </>
    );
  }

  return (
    <View
      style={[{ height: HEIGHT }, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {drawable ? (
        <Svg width={width} height={HEIGHT}>
          {body}
        </Svg>
      ) : null}
    </View>
  );
}
