/**
 * The five beats, numbered. Rendered the same in onboarding's first step and
 * on Profile → How it works, so the two can never drift apart.
 */
import { View } from 'react-native';
import { Rule, Sentence, Serif } from '@/components/system';
import { HOW_IT_WORKS } from '@/content/howItWorks';
import { lang } from '@/theme/tokens';

const { space } = lang;

export function HowItWorksList() {
  return (
    <>
      {HOW_IT_WORKS.map((s, i) => (
        <View key={s.title}>
          <Rule />
          <View style={{ flexDirection: 'row', gap: space.x16 }}>
            <Serif size={26} style={{ width: 24, textAlign: 'center' }}>
              {i + 1}
            </Serif>
            <View style={{ flex: 1, gap: space.x4 }}>
              <Sentence tone="bone">{s.title}</Sentence>
              <Sentence>{s.body}</Sentence>
            </View>
          </View>
        </View>
      ))}
    </>
  );
}
