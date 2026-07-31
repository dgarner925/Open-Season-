// send-alerts — daily push-notification job.
//
// Calls notifications_due() (which already excludes anything in sent_notifications),
// sends each message to the user's Expo push tokens, and records a sent_notifications
// row per (user, event, offset) so nobody is ever double-notified.
//
// Deploy:  supabase functions deploy send-alerts
// Schedule via pg_cron (see supabase/functions/README.md).
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// Supabase's gateway only checks that the caller presents *some* valid key, and
// the app's anon/publishable key is public (it ships inside every build).
// Restrict this to privileged callers (our pg_cron job) so nobody can spam users'
// notifications.
//
// This project is on Supabase's NEW API key system: legacy JWT keys are disabled
// (the gateway rejects them with UNAUTHORIZED_LEGACY_JWT), so the cron uses an
// `sb_secret_...` key. We accept, in order:
//   1. an exact match on the injected SUPABASE_SERVICE_ROLE_KEY,
//   2. an `sb_secret_...` key that appears in the injected SUPABASE_SECRET_KEYS
//      (substring match keeps this agnostic to that var's encoding), or
//   3. a legacy JWT whose role claim is service_role (for projects still on it).
const SECRET_KEYS_RAW = Deno.env.get('SUPABASE_SECRET_KEYS') ?? '';

function isServiceRole(token: string): boolean {
  if (!token) return false;
  if (SERVICE_ROLE && token === SERVICE_ROLE) return true;
  if (token.startsWith('sb_secret_') && SECRET_KEYS_RAW.includes(token)) return true;
  try {
    const part = token.split('.')[1];
    if (!part) return false;
    const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

type Due = {
  user_id: string;
  subject_type: string;
  subject_id: string;
  offset_days: number;
  scheduled_for: string;
  title: string;
  body: string;
  tokens: string[];
  // Where a tap should land in the app. For date_change alerts the dedup
  // identity (subject_*) is the change-log row, while the route points at the
  // underlying season/window so existing tap-routing keeps working.
  route_type: string | null;
  route_id: string | null;
};

async function sendExpoBatch(messages: any[]): Promise<void> {
  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(`expo push ${res.status}: ${await res.text()}`);
  }
}

Deno.serve(async (req) => {
  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!isServiceRole(token)) {
      return json({ error: 'forbidden: service role required' }, 403);
    }

    const { data: due, error } = await admin.rpc('notifications_due');
    if (error) throw error;
    const rows = (due ?? []) as Due[];

    if (rows.length === 0) {
      return json({ ok: true, due: 0, sent: 0 });
    }

    const messages = rows.flatMap((r) =>
      r.tokens.map((token) => ({
        to: token,
        title: r.title,
        body: r.body,
        sound: 'default',
        data: { subjectType: r.route_type ?? r.subject_type, subjectId: r.route_id ?? r.subject_id },
      })),
    );

    await sendExpoBatch(messages);

    // Record one sent_notifications row per (user, event, offset). The UNIQUE
    // constraint makes a re-run a no-op even if this job runs twice.
    const log = rows.map((r) => ({
      user_id: r.user_id,
      subject_type: r.subject_type,
      subject_id: r.subject_id,
      offset_days: r.offset_days,
      scheduled_for: r.scheduled_for,
      status: 'sent',
    }));
    const { error: logErr } = await admin
      .from('sent_notifications')
      .upsert(log, { onConflict: 'user_id,subject_type,subject_id,offset_days', ignoreDuplicates: true });
    if (logErr) throw logErr;

    return json({ ok: true, due: rows.length, sent: messages.length });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
