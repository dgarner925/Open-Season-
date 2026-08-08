import * as Calendar from 'expo-calendar';
import { Alert, Linking } from 'react-native';

/**
 * Add a hunting date (opener or deadline) to the user's calendar via the
 * system "New Event" sheet (createEventInCalendarAsync) — the user confirms,
 * so we never guess at a writable calendar.
 *
 * NOTE: despite presenting a system dialog, expo-calendar's iOS implementation
 * still requires calendar permission before it will open the sheet (it throws
 * otherwise). Request it first, and offer the Settings deep link if the user
 * previously denied. `date` is a YYYY-MM-DD string.
 */
export async function addToCalendar(opts: {
  title: string;
  date: string;
  notes?: string;
  url?: string;
}): Promise<void> {
  try {
    let { status, canAskAgain } = await Calendar.getCalendarPermissionsAsync();
    if (status !== 'granted' && canAskAgain) {
      ({ status } = await Calendar.requestCalendarPermissionsAsync());
    }
    if (status !== 'granted') {
      Alert.alert(
        'Calendar access needed',
        'Allow calendar access for Open Season in Settings to add hunt dates to your calendar.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }

    const start = new Date(`${opts.date}T00:00:00`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    await Calendar.createEventInCalendarAsync({
      title: opts.title,
      startDate: start,
      endDate: end,
      allDay: true,
      notes: opts.notes,
      url: opts.url,
      alarms: [{ relativeOffset: -60 * 24 }], // remind one day before
    });
  } catch (e) {
    console.warn('[calendar] add failed:', e);
    Alert.alert('Could not open calendar', e instanceof Error ? e.message : 'Please try again in a moment.');
  }
}
