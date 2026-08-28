import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Rule, Screen, Sentence, Serif } from '@/components/system';
import { NotificationsOffBanner } from '@/components/NotificationsOffBanner';
import { ProUpsellCard } from '@/components/ProUpsellCard';
import { useAlertPreferences, useToggleOffset, type AlertPref } from '@/features/alerts/queries';
import { useRequirePro } from '@/hooks/useRequirePro';
import { useAuth } from '@/providers/AuthProvider';
import { useFollowedWindows } from '@/features/reference/queries';
import { supabase } from '@/lib/supabase';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

// Cadence ladder from a year out down to the day of. Values must stay within the
// alert_preferences check constraint (1/3/7/14/30/60/90/180/365).
const OFFSETS: { days: number; label: string }[] = [
  { days: 365, label: 'a year' },
  { days: 180, label: '6 months' },
  { days: 90, label: '3 months' },
  { days: 30, label: 'a month' },
  { days: 7, label: 'a week' },
  { days: 1, label: 'a day' },
];

// Draw results land on a known day, so the ladder is short and close in.
// Must stay within the results_offsets check constraint (0/1/3/7).
const RESULTS_OFFSETS: { days: number; label: string }[] = [
  { days: 7, label: 'a week' },
  { days: 3, label: '3 days' },
  { days: 1, label: 'a day' },
  { days: 0, label: 'the day of' },
];

export default function Alerts() {
  const router = useRouter();
  const { species: speciesFilter } = useLocalSearchParams<{ species?: string }>();
  const { data: prefs = [], isLoading } = useAlertPreferences();
  const { data: windows = [] } = useFollowedWindows();
  const toggle = useToggleOffset();
  const requirePro = useRequirePro();

  // Which (state, species) pairs actually have a draw? Only those get a "Draw
  // results" cadence — no point offering it for over-the-counter species.
  const drawPairs = new Set(windows.map((w) => `${w.state_id}:${w.species_id}`));

  // Arriving from a species' "Set reminder" scopes the list to that animal.
  const shown = speciesFilter ? prefs.filter((p) => p.follow?.species?.id === speciesFilter) : prefs;
  const filterName = speciesFilter ? shown[0]?.follow?.species?.name ?? null : null;

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: filterName ? `${filterName} reminders` : 'Reminders' }} />
      <Sentence style={{ marginTop: space.x16 }}>
        {filterName
          ? `How far ahead you hear about ${filterName} — openers, tag deadlines, and draw results, in every state you follow it. Tap a distance to toggle it.`
          : 'How far ahead you hear about openers, tag deadlines, and draw results — from a year out down to the day of. Tap a distance to toggle it.'}
      </Sentence>
      {speciesFilter ? (
        <Pressable onPress={() => router.setParams({ species: undefined })} hitSlop={6} style={{ marginTop: space.x8 }}>
          <Sentence tone="dim" style={{ fontSize: 13 }}>
            Show every reminder instead.
          </Sentence>
        </Pressable>
      ) : null}

      <NotificationsOffBanner />
      <ProUpsellCard context="alerts" />

      {!speciesFilter ? <WeekendBriefToggle requirePro={requirePro} /> : null}

      {Platform.OS === 'web' ? (
        <Sentence tone="dim" style={{ marginTop: space.x16, fontSize: 13 }}>
          Push notifications require a real device.
        </Sentence>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={color.copper} style={{ marginTop: space.x32 }} />
      ) : shown.length === 0 ? (
        <Sentence style={{ marginTop: space.section }}>
          {speciesFilter
            ? "You don't follow this species yet — add it, then set its reminders here."
            : 'Follow a state and species first, then set your reminders here.'}
        </Sentence>
      ) : (
        shown.map((p) => (
          <PrefSection
            key={p.follow_id}
            pref={p}
            hasDraw={drawPairs.has(`${p.state_id}:${p.species_id}`)}
            onToggle={(kind, offset, current) => {
              // Free users can see the ladder; changing it is Pro.
              if (!requirePro()) return;
              toggle.mutate({ followId: p.follow_id, kind, offset, current });
            }}
          />
        ))
      )}
    </Screen>
  );
}

/**
 * The Weekend Brief — one Friday-morning push composed from your follows.
 * On by default for Pro; silent on empty weekends.
 */
function WeekendBriefToggle({ requirePro }: { requirePro: () => boolean }) {
  const { user, profile, refreshProfile } = useAuth();
  const on = profile?.weekend_brief !== false;

  async function setBrief(value: boolean) {
    if (!requirePro() || !user) return;
    await supabase.from('profiles').update({ weekend_brief: value }).eq('id', user.id);
    await refreshProfile();
  }

  return (
    <>
      <Rule />
      <View style={styles.briefRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.briefTitle}>The Weekend Brief</Text>
          <Sentence tone="muted" style={{ fontSize: 13 }}>
            One Friday-morning note: what opens, what closes, and deadlines ahead — only on weekends that matter.
          </Sentence>
        </View>
        <Switch value={on} onValueChange={setBrief} trackColor={{ true: color.copper, false: color.hair }} thumbColor={color.bone} />
      </View>
    </>
  );
}

/**
 * D10, option (b): the cadence ladder as a sentence with tappable distances —
 * active distances in copper. Same information as the old 16-pill grid, no pills.
 */
function PrefSection({
  pref,
  hasDraw,
  onToggle,
}: {
  pref: AlertPref;
  hasDraw: boolean;
  onToggle: (kind: 'opener' | 'deadline' | 'results', offset: number, current: number[]) => void;
}) {
  return (
    <View>
      <Rule />
      <Serif size={22}>
        {pref.follow?.species?.name ?? '—'} in {pref.follow?.state?.name ?? '—'}
      </Serif>
      <LadderLine
        lead="Before openers, remind me"
        ladder={OFFSETS}
        active={pref.opener_offsets}
        onToggle={(o) => onToggle('opener', o, pref.opener_offsets)}
      />
      <LadderLine
        lead="Before tag deadlines, remind me"
        ladder={OFFSETS}
        active={pref.deadline_offsets}
        onToggle={(o) => onToggle('deadline', o, pref.deadline_offsets)}
      />
      {hasDraw ? (
        <LadderLine
          lead="Around draw results, remind me"
          ladder={RESULTS_OFFSETS}
          active={pref.results_offsets}
          onToggle={(o) => onToggle('results', o, pref.results_offsets)}
        />
      ) : null}
    </View>
  );
}

function LadderLine({
  lead,
  ladder,
  active,
  onToggle,
}: {
  lead: string;
  ladder: { days: number; label: string }[];
  active: number[];
  onToggle: (offset: number) => void;
}) {
  return (
    <View style={styles.ladder}>
      <Sentence tone="muted" style={{ fontSize: 13.5 }}>
        {lead}
      </Sentence>
      <View style={styles.words}>
        {ladder.map((o) => {
          const on = active.includes(o.days);
          return (
            <Pressable key={o.days} onPress={() => onToggle(o.days)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${o.label} ahead`}>
              <Text style={[styles.word, on && { color: color.copper }]}>{o.label}</Text>
            </Pressable>
          );
        })}
        <Sentence tone="dim" style={{ fontSize: 14.5 }}>
          ahead.
        </Sentence>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  briefRow: { flexDirection: 'row', alignItems: 'center', gap: space.x16, minHeight: 44 },
  briefTitle: { fontFamily: type.uiSemiBold, fontSize: type.size.body, color: color.bone },
  ladder: { marginTop: space.x16 },
  words: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: space.x16, rowGap: space.x8, marginTop: space.x4 },
  word: { fontFamily: type.uiMedium, fontSize: 14.5, lineHeight: 22, color: color.dim },
});
