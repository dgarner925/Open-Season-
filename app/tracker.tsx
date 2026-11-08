import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Headline, LinkSentence, Pill, Screen, Sentence, Serif, Tile, tileSurface } from '@/components/system';
import { useApplications, type ApplicationWithRefs } from '@/features/applications/queries';
import { useRequirePro } from '@/hooks/useRequirePro';
import { useRequireAccount } from '@/hooks/useRequireAccount';
import { formatDate } from '@/lib/date';
import { openExternalUrl } from '@/lib/openUrl';
import { lang } from '@/theme/tokens';
import type { ApplicationStatus } from '@/lib/database.types';

const { color, space } = lang;

/**
 * What each status is called, in the words a hunter would use. "successful"
 * and "unsuccessful" are the database's words; nobody says them out loud.
 */
const STATUS_LABEL: Record<ApplicationStatus, string> = {
  planned: 'Planned',
  applied: 'Applied',
  successful: 'Drawn',
  unsuccessful: 'Not drawn',
  purchased: 'Bought',
};

/**
 * Copper is scarce — one per region. The only status that earns it is the one
 * you have been waiting all year to read, so Drawn is copper and the other
 * four are grey. The old screen gave every status its own colour chip, which
 * made five equal shouts and told you nothing at a glance.
 */
function statusTone(s: ApplicationStatus): string {
  if (s === 'successful') return color.copper;
  if (s === 'unsuccessful') return color.dim;
  return color.muted;
}

export default function Tracker() {
  const router = useRouter();
  const { data: apps = [], isLoading } = useApplications();
  const requirePro = useRequirePro();
  const requireAccount = useRequireAccount();

  const add = () => requireAccount() && requirePro() && router.push('/application-edit');

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: 'My applications' }} />

      <Headline style={{ marginTop: space.x16 }}>What you've put in for.</Headline>
      <Sentence style={{ marginTop: space.x8 }}>
        Your own record of every draw and tag. Keep your portal password in your phone's password
        manager — it is never stored here.
      </Sentence>

      {isLoading ? (
        <ActivityIndicator color={color.copper} style={{ marginTop: space.section }} />
      ) : apps.length === 0 ? (
        <Tile style={{ marginTop: space.section }}>
          <Sentence tone="bone">Nothing tracked yet.</Sentence>
          <Sentence style={{ marginTop: 2 }}>
            Add one below, or tap "Track this application" on any tag deadline.
          </Sentence>
        </Tile>
      ) : (
        apps.map((a) => (
          <AppCard key={a.id} app={a} onPress={() => router.push(`/application-edit?id=${a.id}`)} />
        ))
      )}

      <Pill
        label="Add an application"
        variant="secondary"
        onPress={add}
        style={{ marginTop: space.section }}
      />
    </Screen>
  );
}

function AppCard({ app, onPress }: { app: ApplicationWithRefs; onPress: () => void }) {
  const where = [app.state?.name, app.species?.name].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [tileSurface, styles.tile, pressed && { opacity: 0.6 }]}
    >
      <View style={styles.head}>
        <Serif size={22} style={{ flex: 1 }}>
          {app.title}
        </Serif>
        <Text style={[styles.status, { color: statusTone(app.status) }]}>
          {STATUS_LABEL[app.status].toUpperCase()}
        </Text>
      </View>

      <Sentence style={{ marginTop: 2 }}>{where || 'No state or species set'}</Sentence>

      {/* The dates read as sentences, not as fields — one line each, in the
          order they happen. */}
      {app.applied_on ? (
        <Sentence tone="dim" style={styles.line}>
          Applied {formatDate(app.applied_on)}.
        </Sentence>
      ) : null}
      {app.results_on ? (
        <Sentence tone="dim" style={styles.line}>
          Results {formatDate(app.results_on)}.
        </Sentence>
      ) : null}
      {app.portal_username ? (
        <Sentence tone="dim" style={styles.line}>
          Signed in as {app.portal_username}.
        </Sentence>
      ) : null}

      {app.application_url ? (
        <LinkSentence onPress={() => openExternalUrl(app.application_url)} style={{ marginTop: space.x12 }}>
          Open the portal
        </LinkSentence>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { marginTop: space.x12 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.x12 },
  // The status sits on the baseline of the title, small and quiet, so the hunt
  // is what you read first and the state is what you read second.
  status: { fontFamily: lang.type.uiSemiBold, fontSize: 10.5, letterSpacing: 1.1, marginTop: 6 },
  line: { marginTop: 2 },
});
