import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Headline, Input, LinkSentence, Micro, Pill, Sentence, Serif } from '@/components/system';
import { useAuth } from '@/providers/AuthProvider';
import { useActiveStates } from '@/features/reference/queries';
import { useBrowseStateCode } from '@/lib/browseState';
import { supabase } from '@/lib/supabase';
import { openExternalUrl } from '@/lib/openUrl';
import { Engraving, engravingFor } from '@/components/Engraving';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

const colophonArt = engravingFor('deer');

const PRIVACY_POLICY_URL = 'https://dgarner925.github.io/OpenSeason-Legal/';
const TERMS_URL = 'https://dgarner925.github.io/OpenSeason-Legal/terms.html';

/** One hairline row: title, optional caption, chevron. */
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !first && styles.rowDivider, pressed && styles.pressed]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {caption ? <Text style={styles.rowSub}>{caption}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={15} color={color.dim} />
    </Pressable>
  );
}

/** A copper rule to the page's edges, then the label for what follows. */
function Section({ label }: { label: string }) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionRule} />
      <Micro>{label}</Micro>
    </View>
  );
}

/** An offer, not a row: a title in the serif and a sentence under it. */
function Offer({ title, line, onPress }: { title: string; line: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.offer, pressed && styles.pressed]}>
      <View style={styles.sectionRule} />
      <Serif size={27}>{title}</Serif>
      <Sentence style={{ marginTop: space.x8 }}>{line}</Sentence>
    </Pressable>
  );
}

function Colophon() {
  return (
    <View style={styles.colophon}>
      {colophonArt ? <Engraving data={colophonArt} size={34} color={color.dim} opacity={0.55} /> : null}
      <Micro>
        {`Open Season · Vol. ${Constants.expoConfig?.version ?? '?'} (${Constants.expoConfig?.ios?.buildNumber ?? '—'})`}
      </Micro>
    </View>
  );
}

export default function Settings() {
  const router = useRouter();
  const { user, profile, isAdmin, isGuest, isOnboarded, signOut, refreshProfile } = useAuth();

  const { data: states = [] } = useActiveStates();
  const residentStateName = states.find((s) => s.id === profile?.resident_state_id)?.name ?? null;
  const { code: browseCode } = useBrowseStateCode();
  const browseName = browseCode ? (states.find((s) => s.code === browseCode)?.name ?? browseCode) : null;

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

  // A guest has no profile to show: no name, no email, no join year, and every
  // row under the pursuit and the watch writes to a user row that doesn't
  // exist. Rather than render a bookplate with a question mark in it and five
  // rows that bounce to sign-in, this is the one thing worth offering plus the
  // fine print, which is the same for everybody.
  if (isGuest) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Headline>Your profile.</Headline>

          <Offer
            title="Sign in"
            line="Reading dates needs no account. One gets you follows, opener reminders, draw deadlines you can't miss, parties and your application history — on every device you carry."
            onPress={() => router.push('/(auth)/sign-in')}
          />

          <Section label="What you're reading" />
          <Row
            first
            title="State"
            caption={browseName ? `Browsing ${browseName}.` : 'Pick a state to browse.'}
            onPress={() => router.push('/pick-state')}
          />

          <Section label="The fine print" />
          <Row first title="How it works" onPress={() => router.push('/how-to')} />
          <Row title="Privacy policy" onPress={() => openExternalUrl(PRIVACY_POLICY_URL)} />
          <Row title="Terms of service" onPress={() => openExternalUrl(TERMS_URL)} />

          <Colophon />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Headline>Your profile.</Headline>

        {/* Identity as a bookplate: a copper ring, the name in the display
            serif, and the member line set like an edition note. The pencil
            toggles the editor. */}
        <View style={styles.identity}>
          <View style={styles.monogramRing}>
            <View style={styles.monogram}>
              <Text style={styles.monogramLetter}>{initial}</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.identityName}>{displayName || 'Add your name'}</Text>
            {residentStateName || isAdmin ? (
              <Text style={styles.rowSub}>{[residentStateName, isAdmin ? 'Admin' : null].filter(Boolean).join(' · ')}</Text>
            ) : null}
            {fieldSince ? <Micro style={{ marginTop: 6 }}>{`In the field since ${fieldSince}`}</Micro> : null}
          </View>
          <Pressable onPress={() => setEditingName((v) => !v)} hitSlop={10} style={({ pressed }) => pressed && styles.pressed}>
            <Ionicons name={editingName ? 'close' : 'pencil'} size={17} color={color.muted} />
          </Pressable>
        </View>

        {editingName ? (
          <View style={styles.editor}>
            <Sentence>
              {`Used to greet you on the home screen.${user?.email ? ` Signed in as ${user.email}.` : ''}`}
            </Sentence>
            <Input value={name} onChangeText={setName} placeholder="First name" autoFocus style={{ marginTop: space.x12 }} />
            <Pill
              label={savingName ? 'Saving…' : 'Save name'}
              onPress={saveName}
              disabled={savingName || trimmed === displayName}
              style={{ marginTop: space.x16 }}
            />
          </View>
        ) : null}

        {isAdmin ? (
          <Offer
            title="Review queue"
            line="Approve or reject extracted seasons, draws, and regs."
            onPress={() => router.push('/(tabs)/admin')}
          />
        ) : null}

        {/* Onboarding is no longer forced on anyone, so it needs a door. This
            is it, and it only appears until it has been walked through. */}
        {!isOnboarded ? (
          <Offer
            title="Set up your hunts"
            line="Pick your states and species once, and the app will track their dates for you."
            onPress={() => router.push('/onboarding')}
          />
        ) : null}

        <Section label="The pursuit" />
        <Row first title="Manage your hunts" caption="Your states and species." onPress={() => router.push('/follows')} />
        <Row
          title="Home state"
          caption={residentStateName ? `Home state: ${residentStateName}.` : 'Set it — it drives resident rules and your legal light.'}
          onPress={() => router.push('/residency')}
        />
        <Row title="Hunting parties" caption="Apply for draws with your buddies." onPress={() => router.push('/parties')} />
        <Row title="My applications" caption="What you've applied for, and results." onPress={() => router.push('/tracker')} />
        <Row title="Preference points" caption="The points you're banking, draw by draw." onPress={() => router.push('/points')} />

        <Section label="The watch" />
        <Row first title="Reminders" caption="How far ahead we give you a heads-up." onPress={() => router.push('/alerts')} />
        <Row title="What arrives" caption="Every notice still to come, in order." onPress={() => router.push('/what-arrives')} />
        <Row title="Notification history" onPress={() => router.push('/notifications')} />

        <Section label="The fine print" />
        <Row first title="How it works" onPress={() => router.push('/how-to')} />
        <Row title="Privacy policy" onPress={() => openExternalUrl(PRIVACY_POLICY_URL)} />
        <Row title="Terms of service" onPress={() => openExternalUrl(TERMS_URL)} />
        <Row title="Update delivery" caption="Diagnostics" onPress={() => router.push('/updates-debug')} />

        <View style={styles.exits}>
          <LinkSentence onPress={signOut}>Sign out</LinkSentence>
          <Pressable
            onPress={confirmDeleteAccount}
            disabled={deleting}
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
          >
            <Text style={styles.deleteLabel}>{deleting ? 'Deleting…' : 'Delete account'}</Text>
          </Pressable>
        </View>

        {/* Colophon: the app's printer's device — a small engraved deer — over
            the edition line. */}
        <Colophon />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: space.gutter, paddingTop: space.section, paddingBottom: 56 },

  identity: { flexDirection: 'row', alignItems: 'center', gap: space.x16, marginTop: space.section },
  monogramRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.copper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogram: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: color.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramLetter: { fontFamily: type.display, fontSize: 24, lineHeight: 29, color: color.copper },
  identityName: { fontFamily: type.display, fontSize: 27, lineHeight: 32, color: color.bone },

  editor: { marginTop: space.section },

  sectionHead: { marginTop: space.section },
  sectionRule: {
    height: 1,
    backgroundColor: color.rule,
    marginHorizontal: -space.gutter,
    marginBottom: space.x12,
  },
  offer: { marginTop: space.section },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.x12, paddingVertical: space.x16 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hair },
  rowTitle: { fontFamily: type.uiMedium, fontSize: 15.5, color: color.bone },
  rowSub: { fontFamily: type.ui, fontSize: 12.5, lineHeight: 18, color: color.muted, marginTop: 2 },

  exits: { marginTop: space.x32, gap: space.x16 },
  deleteBtn: { minHeight: 44, justifyContent: 'center' },
  deleteLabel: { fontFamily: type.uiMedium, fontSize: 14, color: '#c96f5a' },

  colophon: { alignItems: 'center', gap: space.x12, marginTop: space.x32 },

  pressed: { opacity: 0.6 },
});
