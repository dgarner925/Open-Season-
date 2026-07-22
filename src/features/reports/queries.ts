import { useMutation } from '@tanstack/react-query';
import { Alert, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

/**
 * "Report a date that looks wrong." Writes a row to date_reports (RLS-locked to
 * the reporter; admins read all) so user corrections feed the review pipeline.
 */
export function useReportDate() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (args: {
      targetTable: string;
      targetId: string | null;
      label?: string | null;
      detail?: string | null;
    }) => {
      if (!user) throw new Error('not signed in');
      const { error } = await supabase.from('date_reports').insert({
        user_id: user.id,
        target_table: args.targetTable,
        target_id: args.targetId,
        label: args.label ?? null,
        detail: args.detail ?? null,
      });
      if (error) throw error;
    },
  });
}

/**
 * Prompt the user for an optional note, then submit a report. Uses the native
 * iOS prompt where available; falls back to a no-note confirm elsewhere.
 */
export function promptReport(
  submit: (detail: string | null) => void,
  label: string,
) {
  if (Platform.OS === 'ios') {
    Alert.prompt(
      'Report this date',
      `Tell us what looks off with "${label}" (optional). We'll re-check it against the official source.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send report', onPress: (text?: string) => submit(text?.trim() ? text.trim() : null) },
      ],
      'plain-text',
    );
  } else {
    Alert.alert(
      'Report this date?',
      `We'll re-check "${label}" against the official source.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send report', onPress: () => submit(null) },
      ],
    );
  }
}
