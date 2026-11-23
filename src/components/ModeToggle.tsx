/**
 * Woods / Water — the one control that switches the whole app.
 *
 * It lives in the Home header of both modes, and inserting it is the ONLY
 * change On the Water makes to the hunting Home.
 *
 * ---------------------------------------------------------------------------
 * HOW SWITCHING ACTUALLY HAPPENS
 *
 * This calls setMode and nothing else. It does not navigate.
 *
 * Both tab layouts already redirect on the mode -- that is how a cold start
 * lands you where you left off -- and they re-render when the mode changes
 * because they consume it. So the redirect that handles launch handles the
 * toggle too. Calling router.replace here as well would be a second mechanism
 * racing the first, and the bug it produces (a double navigation, sometimes)
 * is the kind that only shows up on a slow phone.
 *
 * ---------------------------------------------------------------------------
 * ACCESSIBILITY, AND ONE DEVIATION FROM THE BRIEF
 *
 * The brief asks for accessibilityRole="switch". This uses two buttons with
 * `selected` state instead, because a switch is one control that flips: a
 * screen reader user activating it while already in the woods would be sent
 * to the water, and the visible control does not behave that way -- tapping
 * the segment you are already on does nothing. Two buttons also let someone
 * jump straight to the mode they want rather than toggling and checking.
 * That is the standard segmented-control pattern.
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MODE_LABEL } from '@/content/brand';
import { useMode, type Mode } from '@/providers/ModeProvider';
import { useEffectiveMode } from '@/hooks/useEffectiveMode';
import { lang } from '@/theme/tokens';
import { otwLang } from '@/theme/otwTokens';

/**
 * The toggle is the one component that must look right in both modes, so it
 * carries both palettes rather than reading useLang(). Two of these four
 * values -- the track, and the text that sits ON the active fill -- are not
 * roles either token file has, because nothing else in the app needs them.
 */
const PALETTE = {
  hunt: {
    track: 'rgba(255,255,255,0.07)',
    activeBg: lang.color.copper,
    activeText: lang.color.bg,
    inactiveText: lang.color.muted,
  },
  otw: {
    track: otwLang.color.toggleTrack,
    activeBg: otwLang.color.river,
    activeText: otwLang.color.riverText,
    inactiveText: otwLang.color.muted,
  },
} as const;

const ICON: Record<Mode, keyof typeof MaterialCommunityIcons.glyphMap> = {
  hunt: 'pine-tree',
  otw: 'waves',
};

/**
 * Below this, the labels go and the segments are icons alone.
 *
 * Measured against the header it has to share: monogram, the state chip, this,
 * and the search icon come to about 284pt of content on a 320pt-wide iPhone
 * SE. Dropping the two labels buys back roughly 60pt, which is the difference
 * between the state name truncating and not.
 */
const LABELS_FIT_ABOVE = 360;

function Segment({
  mode,
  active,
  showLabel,
  palette,
  onPress,
}: {
  mode: Mode;
  active: boolean;
  showLabel: boolean;
  palette: (typeof PALETTE)[keyof typeof PALETTE];
  onPress: () => void;
}) {
  const label = MODE_LABEL[mode];
  const tint = active ? palette.activeText : palette.inactiveText;
  return (
    <Pressable
      onPress={active ? undefined : onPress}
      disabled={active}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label.long}
      hitSlop={6}
      style={({ pressed }) => [
        styles.segment,
        showLabel ? styles.segmentWithLabel : styles.segmentIconOnly,
        active && { backgroundColor: palette.activeBg },
        pressed && !active && { opacity: 0.65 },
      ]}
    >
      <MaterialCommunityIcons name={ICON[mode]} size={13} color={tint} />
      {showLabel ? <Text style={[styles.label, { color: tint }]}>{label.short}</Text> : null}
    </Pressable>
  );
}

export function ModeToggle() {
  const { setMode } = useMode();
  // The EFFECTIVE mode, so the control shows the segment the app is actually
  // rendering. Reading the stored mode here would light "Water" for someone
  // the layout has already sent to the woods because their state has no
  // fishing launched.
  const { mode, otwAvailable, ready } = useEffectiveMode();
  const { width } = useWindowDimensions();
  const palette = PALETTE[mode];
  const showLabel = width >= LABELS_FIT_ABOVE;

  /*
   * NO TOGGLE WHERE THERE IS NOTHING TO TOGGLE TO.
   *
   * On the Water has launched in six states. Offering the control in the
   * other forty-four invites a reader into a section with no rules for their
   * state -- and a control that leads somewhere empty is worse than an
   * absent feature, because it reads as the app being broken rather than the
   * feature not being there yet.
   *
   * Hidden until `ready` rather than shown and then withdrawn. A toggle that
   * appears and vanishes can be tapped in between, and the states query is
   * cached after the first load, so this costs one frame on a cold start and
   * nothing after.
   *
   * Returning null is safe in both call sites: this is the only child of its
   * header row in the woods, and on the water a reader who got there has a
   * launched state by construction.
   */
  if (!ready || !otwAvailable) return null;

  return (
    <View style={[styles.track, { backgroundColor: palette.track }]}>
      <Segment
        mode="hunt"
        active={mode === 'hunt'}
        showLabel={showLabel}
        palette={palette}
        onPress={() => setMode('hunt')}
      />
      <Segment
        mode="otw"
        active={mode === 'otw'}
        showLabel={showLabel}
        palette={palette}
        onPress={() => setMode('otw')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: lang.radius.pill,
    padding: 3,
    gap: 2,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: lang.radius.pill,
    paddingVertical: 6,
  },
  segmentWithLabel: { paddingHorizontal: 11 },
  segmentIconOnly: { paddingHorizontal: 10 },
  label: {
    fontFamily: lang.type.uiSemiBold,
    fontSize: 12,
    letterSpacing: 0.2,
  },
});
