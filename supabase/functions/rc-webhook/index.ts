// rc-webhook — RevenueCat server notifications keep profiles.is_premium
// current so push alerts (notifications_due) only go to entitled users.
//
// RevenueCat is configured with appUserID = the Supabase auth user id, so
// event.app_user_id maps straight onto profiles.id.
//
// Which events flip the flag:
//   -> TRUE : INITIAL_PURCHASE, RENEWAL, UNCANCELLATION, PRODUCT_CHANGE
//   -> FALSE: EXPIRATION only. (CANCELLATION just means auto-renew was turned
//      off — the subscription stays active until the period ends, and
//      RevenueCat sends EXPIRATION at that point.)
// Anything else (BILLING_ISSUE, TRANSFER, TEST, ...) is acknowledged and
// ignored — never downgrade on ambiguity; grandfathered users must never be
// flipped off by a subscription event that doesn't concern them.
//
// Setup:
//   1. Deploy: supabase functions deploy rc-webhook --no-verify-jwt
//   2. Secret:  supabase secrets set RC_WEBHOOK_SECRET=<random string>
//   3. RevenueCat dashboard -> Integrations -> Webhooks: URL =
//      https://<project>.supabase.co/functions/v1/rc-webhook with
//      Authorization header set to the same secret.
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('RC_WEBHOOK_SECRET') ?? '';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const GRANT = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE']);
const REVOKE = new Set(['EXPIRATION']);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
    if (!WEBHOOK_SECRET || req.headers.get('Authorization') !== WEBHOOK_SECRET) {
      return json({ error: 'unauthorized' }, 401);
    }

    const { event } = await req.json();
    const type: string = event?.type ?? '';
    // RevenueCat anonymous ids ($RCAnonymousID:...) aren't Supabase users.
    const userId: string = event?.app_user_id ?? '';
    if (!UUID_RE.test(userId)) return json({ ok: true, skipped: 'no supabase user id' });

    if (GRANT.has(type)) {
      const { error } = await admin.from('profiles').update({ is_premium: true }).eq('id', userId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, set: true });
    }
    if (REVOKE.has(type)) {
      // Never strip premium from a paid-era (grandfathered) profile.
      const { error } = await admin
        .from('profiles')
        .update({ is_premium: false })
        .eq('id', userId)
        .eq('grandfathered', false);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, set: false });
    }
    return json({ ok: true, skipped: type });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
