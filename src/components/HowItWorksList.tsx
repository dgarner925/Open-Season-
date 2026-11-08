/**
 * The beats, numbered, each one a line of a sequence rather than an entry in
 * a list. Shared by setup's second step and Profile → How it works, so the
 * two can never drift.
 */
import { View } from 'react-native';
import { Sentence, Serif } from '@/components/system';
import { HOW_IT_WORKS, type HowItWorksStep } from '@/content/howItWorks';
import { lang } from '@/theme/tokens';

const { color, space } = lang;

export function HowItWorksList({
  steps = HOW_IT_WORKS,
  startAt = 1,
}: {
  steps?: HowItWorksStep[];
  startAt?: number;
}) {
  return (
    <>
      {steps.map((s, i) => (
        <View key={s.title} style={{ flexDirection: 'row', gap: space.x16, marginTop: space.section }}>
          {/* The numeral is the only copper on the step, and it is what makes
              this read as one, two, three rather than as three paragraphs. */}
          <Serif size={28} copper style={{ width: 22, textAlign: 'center' }}>
            {startAt + i}
          </Serif>
          <View style={{ flex: 1, gap: space.x4 }}>
            <Sentence tone="bone" style={{ fontSize: 17 }}>
              {s.title}
            </Sentence>
            <Sentence>{s.body}</Sentence>
          </View>
        </View>
      ))}
      {/* A thread down the left would be the obvious flourish here; it is
          left out because the numerals already carry the order and copper is
          scarce (one accent per region). */}
      <View style={{ height: 0, backgroundColor: color.hair }} />
    </>
  );
}
