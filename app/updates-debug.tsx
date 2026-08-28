import { Stack } from 'expo-router';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { fontFamily, spacing, theme } from '@/theme';

/**
 * OTA delivery diagnostics. The updates module is otherwise config-driven and
 * silent — this screen runs the same check/fetch sequence in the foreground and
 * prints every result and error verbatim, so a failing step is finally visible.
 */
export default function UpdatesDebug() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const add = (line: string) => setLog((l) => [...l, line]);

  async function runCheck() {
    setBusy(true);
    setLog([]);
    try {
      add(`enabled: ${String(Updates.isEnabled)}`);
      add(`embedded launch: ${String(Updates.isEmbeddedLaunch)}`);
      add(`runtime: ${Updates.runtimeVersion ?? '—'}`);
      add(`channel: ${Updates.channel ?? '—'}`);
      add(`current update: ${Updates.updateId ?? 'embedded bundle'}`);
      if (Updates.createdAt) add(`update created: ${Updates.createdAt.toISOString()}`);
      add('— checking server…');
      const check = await Updates.checkForUpdateAsync();
      add(`isAvailable: ${String(check.isAvailable)}`);
      add(`isRollBackToEmbedded: ${String(check.isRollBackToEmbedded)}`);
      if (check.reason) add(`reason: ${check.reason}`);
      if (!check.isAvailable) {
        add('— server says nothing newer for this runtime/channel.');
        return;
      }
      add('— downloading…');
      const fetched = await Updates.fetchUpdateAsync();
      add(`isNew: ${String(fetched.isNew)}`);
      if (fetched.manifest && 'id' in fetched.manifest) add(`downloaded: ${(fetched.manifest as { id: string }).id}`);
      if (fetched.isNew) {
        setDownloaded(true);
        add('— downloaded. Tap "Apply & restart" to launch it.');
      } else {
        add('— nothing new after download (already have it).');
      }
    } catch (e) {
      const err = e as Error & { code?: string };
      add(`ERROR${err.code ? ` [${err.code}]` : ''}: ${err.message}`);
      if (err.stack) add(err.stack.split('\n').slice(0, 3).join('\n'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: 'Update delivery' }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <AppText variant="body" color={theme.color.textSecondary} style={{ marginTop: spacing.sm }}>
          Checks for an over-the-air update and reports each step, including errors the app normally swallows.
        </AppText>

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <Button title={busy ? 'Checking…' : 'Check for updates'} onPress={runCheck} disabled={busy} />
          {downloaded ? (
            <Button variant="secondary" title="Apply & restart" onPress={() => Updates.reloadAsync()} />
          ) : null}
        </View>

        {log.length > 0 ? (
          <Card style={styles.logCard}>
            {log.map((line, i) => (
              <Text key={i} style={[styles.logLine, line.startsWith('ERROR') && { color: theme.color.danger }]}>
                {line}
              </Text>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logCard: { marginTop: spacing.xl, padding: spacing.lg, gap: 6 },
  logLine: { fontFamily: fontFamily.sansMedium, fontSize: 12.5, lineHeight: 18, color: theme.color.textSecondary },
});
