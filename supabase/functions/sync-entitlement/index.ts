// sync-entitlement — verify Pro with RevenueCat and set profiles.is_premium server-side.
//
// The client used to write is_premium itself, which meant any signed-in user
// could grant themselves Pro with the public key. The column is now locked by
// a trigger (20261031120000_lock_profile_entitlements.sql); this function is
// the legitimate path back in. The user id comes from the verified JWT only —
// never from the request body — so a caller can only ever sync themselves.
//
// Response shape confirmed against RevenueCat's Customer Info Model docs:
// { subscriber: { entitlements: { <id>: { expires_date } }, original_application_version } }
//
// Secrets: RC_SECRET_API_KEY (RevenueCat SECRET key, starts with sk_)
//          SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected.
// Deploy:  supabase functions deploy sync-entitlement        (JWT verification ON)
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RC_KEY = Deno.env.get('RC_SECRET_API_KEY') ?? '';

const ENTITLEMENT_ID = Deno.env.get('RC_ENTITLEMENT_ID') ?? 'pro';
// Keep in sync with PremiumProvider.tsx — the last build sold at $4.99.
const LAST_PAID_BUILD = Number(Deno.env.get('LAST_PAID_BUILD') ?? 22);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
    // Not configured yet: say so plainly rather than silently denying Pro.
    if (!RC_KEY) return json({ error: 'server not configured', pro: null }, 503);

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'not signed in' }, 401);
    const { data: userRes } = await admin.auth.getUser(token);
    const user = userRes?.user;
    if (!user) return json({ error: 'not signed in' }, 401);

    // The app configures RevenueCat with appUserID = the Supabase user id.
    const res = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`,
      { headers: { Authorization: `Bearer ${RC_KEY}`, 'Content-Type': 'application/json' } },
    );
    if (!res.ok) return json({ error: `revenuecat ${res.status}` }, 502);
    const sub = (await res.json())?.subscriber ?? {};

    // The entitlements dictionary includes EXPIRED entitlements, so presence
    // alone proves nothing — expires_date null means lifetime/non-expiring.
    const ent = sub.entitlements?.[ENTITLEMENT_ID];
    const entActive = Boolean(ent) && (ent.expires_date === null || new Date(ent.expires_date) > new Date());

    // Paid-era buyer: the original download build is a plain integer <= 22.
    // Sandbox, TestFlight and App Review all report "1.0", which is not a plain
    // integer, so a reviewer can never be mistaken for a grandfathered buyer —
    // the same reasoning the client's receiptTrustworthy() check uses.
    const orig = String(sub.original_application_version ?? '');
    const paidEra = /^\d+$/.test(orig) && Number(orig) <= LAST_PAID_BUILD;

    const pro = entActive || paidEra;
    if (pro) {
      const { error } = await admin.from('profiles').update({ is_premium: true }).eq('id', user.id);
      if (error) return json({ error: error.message }, 500);
    }
    // Never downgrade here — expiry is the rc-webhook's job, and a transient
    // RevenueCat hiccup must not strip a paying hunter of their alerts.
    return json({ ok: true, pro });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
