import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pill, Row, Rule, Screen, Sentence, Serif } from '@/components/system';
import { useAuth } from '@/providers/AuthProvider';
import { useActiveStates } from '@/features/reference/queries';
import { supabase } from '@/lib/supabase';
import { openExternalUrl } from '@/lib/openUrl';
import { Engraving, engravingFor } from '@/components/Engraving';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;
const colophonArt = engravingFor('deer');

const PRIVACY_POLICY_URL = 'https://dgarner925.github.io/OpenSeason-Legal/';
const TERMS_URL = 'https://dgarner925.github.io/OpenSeason-Legal/terms.html';

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
    <Screen scroll>
      {/* Identity as a bookplate: monogram ring, name in the display serif, and
          the member line set like an edition note. Pencil toggles the editor. */}
      <View style={styles.identity}>
        <View style={styles.monogramRing}>
          <View style={styles.monogram}>
            <Text style={styles.monogramLetter}>{initial}</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Serif size={26}>{displayName || 'Add your name'}</Serif>
          {residentStateName || isAdmin ? (
            <Sentence tone="dim" style={{ fontSize: 13, marginTop: 2 }}>
              {[residentStateName, isAdmin ? 'Admin' : null].filter(Boolean).join(' · ')}
            </Sentence>
          ) : null}
          {fieldSince ? <Text style={styles.fieldSince}>IN THE FIELD SINCE {fieldSince}</Text> : null}
        </View>
        <Pressable
          onPress={() => setEditingName((v) => !v)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={editingName ? 'Close name editor' : 'Edit name'}
          style={({ pressed }) => pressed && { opacity: 0.6 }}
        >
          <Ionicons name={editingName ? 'close' : 'pencil'} size={17} color={color.muted} />
        </Pressable>
      </View>

      {editingName ? (
        <View style={{ marginTop: space.x16 }}>
          <Sentence tone="dim" style={{ fontSize: 13 }}>
            Used to greet you on the home screen.
            {user?.email ? ` Signed in as ${user.email}.` : ''}
          </Sentence>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="First name"
            placeholderTextColor={color.dim}
            style={styles.input}
            autoFocus
          />
          <Pill
            label={savingName ? 'Saving…' : 'Save name'}
            onPress={saveName}
            disabled={savingName || trimmed === displayName}
            style={{ marginTop: space.x16 }}
          />
        </View>
      ) : null}

      {isAdmin && (
        <>
          <Rule />
          <Row
            title="Review queue"
            subtitle="Approve or reject extracted seasons, draws, and regs."
            onPress={() => router.push('/(tabs)/admin')}
            last
          />
        </>
      )}

      <Rule />
      <Serif size={22} style={{ marginBottom: space.x4 }}>
        The pursuit
      </Serif>
      <Row title="What you follow" subtitle="Your states and species." onPress={() => router.push('/follows')} />
      <Row
        title="Residency"
        subtitle={residentStateName ? `Home state: ${residentStateName}.` : 'Set your home state for resident pricing.'}
        onPress={() => router.push('/residency')}
      />
      <Row title="Hunting parties" subtitle="Apply for draws with your buddies." onPress={() => router.push('/parties')} />
      <Row title="My applications" subtitle="What you've applied for, and results." onPress={() => router.push('/tracker')} />
      <Row title="Preference points" subtitle="The points you're banking, draw by draw." onPress={() => router.push('/points')} last />

      <Rule />
      <Serif size={22} style={{ marginBottom: space.x4 }}>
        The watch
      </Serif>
      <Row title="Reminders" subtitle="How far ahead we give you a heads-up." onPress={() => router.push('/alerts')} />
      <Row title="Notification history" onPress={() => router.push('/notifications')} last />

      <Rule />
      <Serif size={22} style={{ marginBottom: space.x4 }}>
        The fine print
      </Serif>
      <Row title="How it works" onPress={() => router.push('/how-to')} />
      <Row title="Privacy policy" onPress={() => openExternalUrl(PRIVACY_POLICY_URL)} />
      <Row title="Terms of service" onPress={() => openExternalUrl(TERMS_URL)} />
      <Row title="Update delivery" subtitle="Diagnostics" onPress={() => router.push('/updates-debug')} last />

      <Rule />
      <Pill label="Sign out" variant="secondary" onPress={signOut} />

      {/* The consequence sits directly above the destructive action. */}
      <Sentence tone="dim" style={{ marginTop: space.section, fontSize: 13 }}>
        Deleting your account removes everything — follows, reminders, applications — for good.
      </Sentence>
      <Pressable
        onPress={confirmDeleteAccount}
        disabled={deleting}
        accessibilityRole="button"
        style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.deleteLabel}>{deleting ? 'Deleting…' : 'Delete account'}</Text>
      </Pressable>

      {/* Colophon: the app's printer's device — a small engraved deer — over the edition line. */}
      <View style={styles.colophon}>
        {colophonArt ? <Engraving data={colophonArt} size={34} color={color.muted} opacity={0.55} /> : null}
        <Text style={styles.edition}>
          OPEN SEASON · VOL. {Constants.expoConfig?.version ?? '?'} ({Constants.expoConfig?.ios?.buildNumber ?? '—'})
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.x16, marginTop: space.section },
  monogramRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.copper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogram: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: color.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramLetter: { fontFamily: type.display, fontSize: 24, color: color.copper },
  fieldSince: {
    fontFamily: type.uiSemiBold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: color.copperDim,
    marginTop: 6,
  },

  input: {
    fontFamily: type.ui,
    fontSize: 16,
    color: color.bone,
    paddingVertical: space.x12,
    marginTop: space.x8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hair,
  },

  deleteBtn: { minHeight: 44, justifyContent: 'center' },
  deleteLabel: { fontFamily: type.uiSemiBold, fontSize: type.size.body, color: '#c96f5a' },

  colophon: { alignItems: 'center', gap: space.x8, marginTop: space.x32 },
  edition: { fontFamily: type.uiSemiBold, fontSize: 10.5, letterSpacing: 1.5, color: color.dim },
});
