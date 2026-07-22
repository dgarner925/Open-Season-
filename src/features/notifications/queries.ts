import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/date';
import { useAuth } from '@/providers/AuthProvider';

export type NotifKind = 'opener' | 'deadline' | 'results';

export type NotifItem = {
  id: string;
  kind: NotifKind;
  subjectType: string;
  subjectId: string;
  sentAt: string;
  title: string;
  subtitle: string;
};

function kindOf(subjectType: string): NotifKind {
  if (subjectType === 'season_opener') return 'opener';
  if (subjectType === 'application_results') return 'results';
  return 'deadline';
}

/**
 * The user's notification history, newest first, reconstructed from the
 * server-side sent_notifications log (RLS: read-own). That log stores the event
 * reference but not the message text, so we re-join seasons / application_windows
 * to build a readable title + subtitle for each row.
 */
export function useNotificationHistory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notifications', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<NotifItem[]> => {
      const { data: rows, error } = await supabase
        .from('sent_notifications')
        .select('id, subject_type, subject_id, sent_at')
        .eq('user_id', user!.id)
        .order('sent_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const list = (rows ?? []) as { id: string; subject_type: string; subject_id: string; sent_at: string }[];
      if (list.length === 0) return [];

      const seasonIds = list.filter((r) => r.subject_type === 'season_opener').map((r) => r.subject_id);
      const windowIds = list.filter((r) => r.subject_type !== 'season_opener').map((r) => r.subject_id);

      const [seasonsRes, windowsRes] = await Promise.all([
        seasonIds.length
          ? supabase.from('seasons').select('id, method, open_date, state:states(code), species:species(name)').in('id', seasonIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        windowIds.length
          ? supabase.from('application_windows').select('id, name, closes_at, results_expected_at, state:states(code), species:species(name)').in('id', windowIds)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      const sMap = new Map((seasonsRes.data ?? []).map((s: any) => [s.id, s]));
      const wMap = new Map((windowsRes.data ?? []).map((w: any) => [w.id, w]));

      return list.map((r): NotifItem => {
        const kind = kindOf(r.subject_type);
        const base = { id: r.id, kind, subjectType: r.subject_type, subjectId: r.subject_id, sentAt: r.sent_at };
        if (kind === 'opener') {
          const s: any = sMap.get(r.subject_id);
          const code = s?.state?.code ?? '';
          const sp = s?.species?.name ?? 'Season';
          return { ...base, title: `${code} ${sp} opener`.trim(), subtitle: s?.open_date ? `Opens ${formatDate(s.open_date)}` : 'Season opener' };
        }
        const w: any = wMap.get(r.subject_id);
        const code = w?.state?.code ?? '';
        const sp = w?.species?.name ?? 'Draw';
        if (kind === 'results') {
          return { ...base, title: `${code} ${sp} results`.trim(), subtitle: w?.results_expected_at ? `Results ${formatDate(w.results_expected_at)}` : 'Draw results expected' };
        }
        return { ...base, title: `${code} ${sp} tag deadline`.trim(), subtitle: w?.closes_at ? `Closes ${formatDate(w.closes_at)}` : 'Application deadline' };
      });
    },
  });
}

/** Short relative time for when a notification was sent, e.g. '3h ago', '2d ago'. */
export function sentAgo(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return 'Just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return formatDate(iso.slice(0, 10));
}
