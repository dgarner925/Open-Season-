import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { comingSentence, dayLabel, daysBetween } from '@/features/parties/format';
import { useSetPartyDay } from '@/features/parties/queries';
import type { PartyRosterEntry } from '@/lib/database.types';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

/**
 * Who is coming which days.
 *
 * The one thing a group text cannot do. A thread re-asks "who's in Thursday?"
 * every single season and the answer scrolls away; a row holds it.
 *
 * Laid out as a row per day rather than a grid, because a grid of names
 * against dates stops being readable at phone width the moment a party has
 * more than three people in it.
 */
export function PartyDays({
  partyId,
  roster,
  myUserId,
  openDate,
  closeDate,
}: {
  partyId: string;
  roster: PartyRosterEntry[];
  myUserId: string | undefined;
  openDate: string | null;
  closeDate: string | null;
}) {
  const setDay = useSetPartyDay(partyId);
  const days = daysBetween(openDate, closeDate);
  if (days.length === 0) return null;

  const mine = roster.find((m) => m.user_id === myUserId);

  return (
    <View style={{ marginTop: space.section }}>
      <Text style={styles.heading}>WHO&rsquo;S COMING</Text>
      {days.map((day, i) => {
        const going = roster.filter((m) => (m.days ?? []).includes(day));
        const iAmIn = Boolean(mine && (mine.days ?? []).includes(day));
        return (
          <View key={day} style={[styles.row, i === days.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.day}>{dayLabel(day)}</Text>
              <Text style={styles.who}>
                {comingSentence(
                  going.map((m) => m.display_name),
                  roster.length,
                )}
              </Text>
            </View>
            <View style={styles.faces}>
              {going.slice(0, 4).map((m) => (
                <Avatar key={m.user_id} name={m.display_name} url={m.avatar_url} size={24} />
              ))}
            </View>
            <Pressable
              onPress={() => setDay.mutate({ day, going: !iAmIn })}
              accessibilityRole="button"
              accessibilityLabel={
                iAmIn ? `You are coming on ${dayLabel(day)}. Tap to remove.` : `Tap to come on ${dayLabel(day)}.`
              }
              style={[styles.toggle, iAmIn ? styles.toggleOn : styles.toggleOff]}
            >
              <Text style={[styles.toggleLabel, { color: iAmIn ? color.copper : color.bone }]}>
                {iAmIn ? "I'm in ✓" : "I'm in"}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: type.uiMedium,
    fontSize: 11,
    letterSpacing: 1.4,
    color: color.dim,
    marginBottom: space.x8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.x12,
    paddingVertical: space.x12,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hair,
  },
  day: { fontFamily: type.ui, fontSize: type.size.body, color: color.bone },
  who: { fontFamily: type.ui, fontSize: 13, color: color.muted, marginTop: 2 },
  faces: { flexDirection: 'row', gap: -6 },
  toggle: {
    height: 34,
    paddingHorizontal: space.x12,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  toggleOn: { backgroundColor: color.fill, borderColor: color.copper },
  toggleOff: { backgroundColor: 'transparent', borderColor: color.hair },
  toggleLabel: { fontFamily: type.uiSemiBold, fontSize: 12.5 },
});
