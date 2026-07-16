// delete-account — lets a signed-in user permanently delete their own account.
//
// Apple App Store Guideline 5.1.1(v) requires any app with account creation to
// offer in-app account deletion. The caller sends their own access token; we
// verify it, then delete that auth user with the service role. Every user-data
// table (profiles, follows, alert_preferences, device_push_tokens,
// user_applications, sent_notifications) is FK'd to auth.users ON DELETE CASCADE,
// so removing the auth user wipes all of their data in one shot.
//
// Deploy: supabase functions deploy delete-account
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'missing bearer token' }, 401);

    // Validate the caller's token and resolve which user is asking.
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) return json({ error: 'invalid or expired session' }, 401);

    // Delete the auth user — cascades to all of their rows.
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) return json({ error: delErr.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
