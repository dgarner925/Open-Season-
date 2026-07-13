import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { AppText, Card, Screen } from '@/components/ui';
import { MiniMarkdown } from '@/components/MiniMarkdown';
import { ProvenanceBlock } from '@/components/Provenance';
import { useRegById } from '@/features/reference/queries';
import { spacing, theme } from '@/theme';

export default function RegsDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: reg, isLoading } = useRegById(id);

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={theme.color.accent} style={{ marginTop: spacing.xxl }} />
      </Screen>
    );
  }
  if (!reg) {
    return (
      <Screen>
        <AppText variant="h3">Summary not found</AppText>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: `${reg.state?.code ?? ''} ${reg.species?.name ?? ''} Regs` }} />
      <AppText variant="h1">
        {reg.state?.name} · {reg.species?.name}
      </AppText>
      <Card>
        <MiniMarkdown body={reg.body} />
      </Card>
      <ProvenanceBlock
        verifiedAt={reg.last_verified_at}
        agencyName={reg.source?.agency_name ?? reg.state?.name ?? null}
        url={reg.source?.url ?? null}
      />
    </Screen>
  );
}
