/**
 * "Fishing license expires in 23 days."
 *
 * Hides itself when there is no date, or when there is more than a couple of
 * months left -- a banner that is always there is wallpaper, and stops being
 * read on the day it matters.
 *
 * The date is real as of Phase 3: useOtwLicence reads `user_licenses` for the
 * signed-in angler in their own state, and `renewUrl` is that state's
 * `license_url` rather than Georgia's for everybody.
 *
 * The `daysLeft === null` branch below is the load-bearing one and always has
 * been. `user_licenses` is empty for every user today, so this component
 * renders nothing for every user today. That is the honest reading of "we
 * have not been told when your licence expires" -- and it is why replacing
 * the placeholder needed no change here: the component was already willing to
 * say nothing, it was the caller that was inventing a number.
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { openExternalUrl } from '@/lib/openUrl';
import { otwLang } from '@/theme/otwTokens';

const { color, radius, space, type } = otwLang;

/** Above this many days, the reminder is noise. */
const SHOW_WITHIN_DAYS = 60;

export function OtwLicenseBanner({
  daysLeft,
  renewUrl,
}: {
  daysLeft: number | null;
  renewUrl: string | null;
}) {
  if (daysLeft === null || !Number.isFinite(daysLeft) || daysLeft > SHOW_WITHIN_DAYS) return null;

  const expired = daysLeft <= 0;

  return (
    <View style={styles.banner}>
      <MaterialCommunityIcons name="card-account-details-outline" size={17} color={color.brassText} />
      {/* The subject and the number are bold; the verb between them is not.
          Both ends of the sentence are what someone scanning the page needs. */}
      <Text style={styles.text}>
        <Text style={styles.strong}>Fishing license</Text>{' '}
        {expired ? (
          <Text style={styles.strong}>has expired</Text>
        ) : daysLeft === 1 ? (
          <>
            expires <Text style={styles.strong}>tomorrow</Text>
          </>
        ) : (
          <>
            expires in <Text style={styles.strong}>{daysLeft} days</Text>
          </>
        )}
      </Text>
      {renewUrl ? (
        <Pressable
          onPress={() => openExternalUrl(renewUrl)}
          accessibilityRole="button"
          accessibilityLabel="Renew your fishing license"
          hitSlop={6}
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.buttonText}>Renew</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Dashed, because it is a note pinned to the page rather than part of it.
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.x8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.brass,
    borderRadius: 12,
    backgroundColor: 'rgba(168,130,63,0.07)',
    paddingVertical: 9,
    paddingHorizontal: space.x12,
    marginTop: space.x16,
  },
  text: { flex: 1, fontFamily: type.ui, fontSize: 13.5, lineHeight: 19, color: color.ink },
  strong: { fontFamily: type.uiSemiBold },
  button: {
    backgroundColor: color.brassDeep,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  buttonText: { fontFamily: type.uiSemiBold, fontSize: 13, color: '#FBF6EA' },
});
