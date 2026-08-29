import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { Rule, Screen, Sentence, Serif } from '@/components/system';
import { MiniMarkdown } from '@/components/MiniMarkdown';
import { ProvenanceBlock } from '@/components/Provenance';
import { LicenseRow } from '@/components/LicenseRow';
import { useRegById } from '@/features/reference/queries';
import { openExternalUrl } from '@/lib/openUrl';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

export default function RegsDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: reg, isLoading } = useRegById(id);

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={color.copper} style={{ marginTop: space.x38 }} />
      </Screen>
    );
  }
  if (!reg) {
    return (
      <Screen>
        <Sentence tone="bone" style={{ marginTop: space.section }}>
          Summary not found.
        </Sentence>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: 'Regulations' }} />
      <Serif size={type.size.hero - 8} style={{ marginTop: space.x16, lineHeight: type.size.hero - 2 }}>
        {reg.species?.name}
      </Serif>
      <Sentence style={{ marginTop: space.x8 }}>{reg.state?.name} regulations, in plain English.</Sentence>

      <Rule />
      <MiniMarkdown body={reg.body} />

      <LicenseRow stateName={reg.state?.name} url={reg.state?.license_url} />

      <ProvenanceBlock
        verifiedAt={reg.last_verified_at}
        agencyName={reg.source?.agency_name ?? reg.state?.name ?? null}
        url={reg.source?.url ?? null}
      />
    </Screen>
  );
}
