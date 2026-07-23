import * as Calendar from 'expo-calendar';
import { Alert } from 'react-native';

/**
 * Add a hunting date (opener or deadline) to the user's calendar.
 *
 * Uses the system-provided "New Event" sheet (createEventInCalendarAsync) rather
 * than writing an event directly: the OS presents a pre-filled editor the user
 * confirms, so we don't need calendar permission, a default-calendar lookup, or
 * to guess a writable calendar — the brittle parts that made the direct-write
 * approach fail. Works on both iOS and Android. `date` is a YYYY-MM-DD string.
 */
export async function addToCalendar(opts: {
  title: string;
  date: string;
  notes?: string;
  url?: string;
}): Promise<void> {
  try {
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
    Alert.alert('Could not open calendar', 'Please try again in a moment.');
  }
}
