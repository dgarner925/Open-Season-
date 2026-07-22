import * as Calendar from 'expo-calendar';
import { Alert, Platform } from 'react-native';

/**
 * Add a hunting date (opener or deadline) to the user's calendar as an all-day
 * event with a one-day-ahead alarm. Requests permission on first use; surfaces a
 * friendly alert on success or if access is denied. `date` is a YYYY-MM-DD string.
 */
export async function addToCalendar(opts: {
  title: string;
  date: string;
  notes?: string;
  url?: string;
}): Promise<void> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Calendar access needed',
        'Enable calendar access for Open Season in your device Settings to add dates.',
      );
      return;
    }

    // All-day event on the given date, ending the next day (iOS convention).
    const start = new Date(`${opts.date}T00:00:00`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    let calendarId: string;
    if (Platform.OS === 'ios') {
      const def = await Calendar.getDefaultCalendarAsync();
      calendarId = def.id;
    } else {
      const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const writable = cals.find((c) => c.allowsModifications) ?? cals[0];
      if (!writable) {
        Alert.alert('No calendar found', 'Add a calendar in your device Settings first.');
        return;
      }
      calendarId = writable.id;
    }

    await Calendar.createEventAsync(calendarId, {
      title: opts.title,
      startDate: start,
      endDate: end,
      allDay: true,
      notes: opts.notes,
      url: opts.url,
      alarms: [{ relativeOffset: -60 * 24 }], // remind one day before
    });

    Alert.alert('Added to calendar', opts.title);
  } catch (e) {
    console.warn('[calendar] add failed:', e);
    Alert.alert('Could not add to calendar', 'Please try again in a moment.');
  }
}
