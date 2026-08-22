import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { PageTitle } from '@/components/midnight';
import { useAuth } from '@/providers/AuthProvider';
import { useActiveStates } from '@/features/reference/queries';
import { supabase } from '@/lib/supabase';
import { openExternalUrl } from '@/lib/openUrl';
import { Engraving, engravingFor } from '@/components/Engraving';
import { fontFamily, radius, spacing, theme } from '@/theme';

const colophonArt = engravingFor('deer');

const PRIVACY_POLICY_URL = 'https://dgarner925.github.io/OpenSeason-Legal/';
const TERMS_URL = 'https://dgarner925.github.io/OpenSeason-Legal/terms.html';

/** Section header set like a rule in a field ledger: hairline — label — hairline. */
function SectionRule({ label }: { label: string }) {
  return (
    <View style={styles.sectionRule}>
      <View style={styles.ruleLine} />
      <AppText variant="overline" color={theme.color.textMuted}>
        {label}
      </AppText>
      <View style={styles.ruleLine} />
    </View>
  );
}

/** One row inside a grouped section card: title, optional caption, chevron. */
function Row({
  title,
  caption,
  onPress,
  first = false,
}: {
  title: string;
  caption?: string;
  onPress: () => void;
  first?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !first && styles.rowDivider, pressed && { opacity: 0.65 }]}>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong">{title}</AppText>
        {caption ? (
          <AppText variant="caption" color={theme.color.textMuted} style={{ marginTop: 2 }}>
            {caption}
          </AppText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.color.textMuted} />
    </Pressable>
  );
}

export default function Settings() {
  const router = useRouter();
  const { user, profile, isAdmin, signOut, refreshProfile } = useAuth();

  const { data: states = [] } = useActiveStates();
  const residentStateName = states.find((s) => s.id === profile?.resident_state_id)?.name ?? null;

  const [name, setName] = useState(profile?.display_name ?? '');
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => setName(profile?.display_name ?? ''), [profile?.display_name]);

  const trimmed = name.trim();
  const displayName = (profile?.display_name ?? '').trim();
  const initial = (displayName || user?.email || '?').trim().charAt(0).toUpperCase();
  const fieldSince = user?.created_at ? new Date(user.created_at).getFullYear() : null;

  async function saveName() {
    if (!user) return;
    setSavingName(true);
    await supabase.from('profiles').update({ display_name: trimmed || null }).eq('id', user.id);
    await refreshProfile();
    setSavingName(false);
    setEditingName(false);
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and all your data — your follows, alert settings, and tracked applications. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: deleteAccount },
      ],
    );
  }

  async function deleteAccount() {
    setDeleting(true);
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) {
      setDeleting(false);
      Alert.alert('Could not delete account', 'Please try again in a moment.');
      return;
    }
    // Account is gone; clear the local session (redirects to sign-in).
    await signOut();
  }

  return (
    <Screen scroll contentStyle={{ paddingBottom: spacing.xxl }}>
      <PageTitle lead="Your " accent="profile." />

      {/* Identity as a bookplate: double-ring monogram, name in the display serif,
          and the member line set like an edition note. Pencil toggles the editor. */}
      <View style={styles.identity}>
        <View style={styles.monogramRing}>
          <View style={styles.monogram}>
            <Text style={styles.monogramLetter}>{initial}</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.identityName}>{displayName || 'Add your name'}</Text>
          <AppText variant="caption" color={theme.color.textMuted} style={{ marginTop: 2 }}>
            {user?.email ?? 'Signed in'}
            {residentStateName ? ` · ${residentStateName}` : ''}
            {isAdmin ? ' · Admin' : ''}
          </AppText>
          {fieldSince ? <Text style={styles.fieldSince}>IN THE FIELD SINCE {fieldSince}</Text> : null}
        </View>
        <Pressable onPress={() => setEditingName((v) => !v)} hitSlop={10} style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Ionicons name={editingName ? 'close' : 'pencil'} size={17} color={theme.color.textSecondary} />
        </Pressable>
      </View>

      {editingName ? (
        <Card>
          <AppText variant="caption" color={theme.color.textMuted}>
            Used to greet you on the home screen.
          </AppText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="First name"
            placeholderTextColor={theme.color.textMuted}
            style={styles.input}
            autoFocus
          />
          <Button
            title={savingName ? 'Saving…' : 'Save name'}
            onPress={saveName}
            loading={savingName}
            disabled={trimmed === displayName}
          />
        </Card>
      ) : null}

      {isAdmin && (
        <Card onPress={() => router.push('/(tabs)/admin')}>
          <AppText variant="h3">Review queue</AppText>
          <AppText variant="body" color={theme.color.textSecondary}>
            Approve or reject extracted seasons, draws, and regs.
          </AppText>
        </Card>
      )}

      <SectionRule label="THE PURSUIT" />
      <Card style={styles.group}>
        <Row first title="What you follow" caption="Your states and species." onPress={() => router.push('/follows')} />
        <Row
          title="Residency"
          caption={residentStateName ? `Home state: ${residentStateName}.` : 'Set your home state for resident pricing.'}
          onPress={() => router.push('/residency')}
        />
        <Row title="Hunting parties" caption="Apply for draws with your buddies." onPress={() => router.push('/parties')} />
        <Row title="My applications" caption="What you've applied for, and results." onPress={() => router.push('/tracker')} />
        <Row title="Preference points" caption="The points you're banking, draw by draw." onPress={() => router.push('/points')} />
      </Card>

      <SectionRule label="THE WATCH" />
      <Card style={styles.group}>
        <Row first title="Reminders" caption="How far ahead we give you a heads-up." onPress={() => router.push('/alerts')} />
        <Row title="Notification history" onPress={() => router.push('/notifications')} />
      </Card>

      <SectionRule label="THE FINE PRINT" />
      <Card style={styles.group}>
        <Row first title="How it works" onPress={() => router.push('/how-to')} />
        <Row title="Privacy policy" onPress={() => openExternalUrl(PRIVACY_POLICY_URL)} />
        <Row title="Terms of service" onPress={() => openExternalUrl(TERMS_URL)} />
      </Card>

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Button variant="ghost" title="Sign out" onPress={signOut} />
        <Pressable
          onPress={confirmDeleteAccount}
          disabled={deleting}
          style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}
        >
          <AppText variant="bodyStrong" color={theme.color.danger}>
            {deleting ? 'Deleting…' : 'Delete account'}
          </AppText>
        </Pressable>
        {/* Colophon: the app's printer's device — a small engraved deer — over the edition line. */}
        <View style={styles.colophon}>
          {colophonArt ? <Engraving data={colophonArt} size={34} color={theme.color.textMuted} opacity={0.55} /> : null}
          <AppText variant="caption" color={theme.color.textMuted} style={{ letterSpacing: 1.2 }}>
            OPEN SEASON · VOL. {Constants.expoConfig?.version ?? '?'} ({Constants.expoConfig?.ios?.buildNumber ?? '—'})
          </AppText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.xl },
  monogramRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogram: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.color.accentFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramLetter: { fontFamily: fontFamily.serif, fontSize: 24, color: theme.color.accent },
  identityName: { fontFamily: fontFamily.serif, fontSize: 26, color: theme.color.textPrimary },
  fieldSince: {
    fontFamily: fontFamily.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: '#a68a6d',
    marginTop: 6,
  },

  sectionRule: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  ruleLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border },
  colophon: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  group: { paddingVertical: 0, paddingHorizontal: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.border },

  input: {
    backgroundColor: theme.color.surfaceElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: theme.color.textPrimary,
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.border,
  },
  deleteBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
