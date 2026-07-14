# Edge Functions

## `send-alerts` — daily push notifications

Calls `notifications_due()`, sends each message to the user's Expo push tokens,
and records the send so nobody is double-notified. `notifications_due()` returns
three kinds of alert, all deduped via `sent_notifications`:

1. **Opener countdown** — a followed season opens in exactly 30/7/1 days (per the
   user's `opener_offsets`).
2. **Deadline countdown** — a followed application window closes in 30/7/1 days
   (per `deadline_offsets`).
3. **New draw posted** — a followed application window has just become
   `published` and is still open (`closes_at >= today`). Fires once per user per
   window, regardless of offset prefs, so hunters hear about a draw the moment
   it's available. Deduped with a sentinel `offset_days = -1`. Because it's gated
   on `closes_at >= today`, publishing already-passed windows sends nothing.

### Deploy

```powershell
npx supabase functions deploy send-alerts
```

### Schedule daily (SQL Editor)

`pg_cron` + `pg_net` are already enabled. Run once, substituting your service-role key:

```sql
select cron.schedule(
  'send-alerts-daily',
  '0 13 * * *',  -- 13:00 UTC ~ early morning US
  $$
  select net.http_post(
    url     := 'https://soxglmgbhmpuxhngcsvx.supabase.co/functions/v1/send-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
-- Unschedule: select cron.unschedule('send-alerts-daily');
```

### Notes

- Requires the `20260713101000_notifications.sql` migration (`notifications_due()`).
- Push only reaches **real devices** — the app registers a token on launch
  (`src/lib/push.ts`); the web preview and simulators don't get one.
- Idempotency is enforced by `sent_notifications`' unique key — re-running the job
  the same day sends nothing new.

---

## `extract-source` — automated refresh (Phase 2 PoC)

Fetches one official source, asks Claude (`claude-opus-4-8`) to extract structured
season data, diffs it against the current `seasons` rows, and enqueues proposed
changes into `review_queue`. **Nothing is published** — you approve each item on
the in-app **Admin** tab, which calls `apply_review_item()` to apply it and stamp
`last_verified_at`.

### 1. Set the Anthropic key as a function secret (PowerShell)

```powershell
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — do not set them.

### 2. Deploy

```powershell
npx supabase functions deploy extract-source
```

### 3. Invoke it manually (proof of concept)

```powershell
# Defaults to a Georgia deer source. Use the service_role key for a one-off test.
curl -X POST "https://soxglmgbhmpuxhngcsvx.supabase.co/functions/v1/extract-source" `
  -H "Authorization: Bearer <YOUR_SERVICE_ROLE_KEY>" `
  -H "content-type: application/json" -d '{}'
```
It returns `{ ok, extracted, created, updated, unchanged }`. Then open the app's
**Admin** tab (as your admin account) to review and approve the proposals.

### 4. Schedule it with pg_cron (optional, Phase 2)

`pg_cron` and `pg_net` are already enabled. Run this once in the SQL Editor,
substituting your service-role key, to fetch the Georgia deer source nightly at
3am UTC:

```sql
select cron.schedule(
  'refresh-ga-deer',
  '0 3 * * *',
  $$
  select net.http_post(
    url     := 'https://soxglmgbhmpuxhngcsvx.supabase.co/functions/v1/extract-source',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
    ),
    body    := jsonb_build_object('sourceId', (select id from public.sources where url like '%Season%Dates%' limit 1))
  );
  $$
);
-- Unschedule: select cron.unschedule('refresh-ga-deer');
```

> The service-role key in a cron job is stored in the `cron.job` table (admin-only).
> For production, store it in Supabase Vault and read it in the job instead.

### Scope of the PoC

- Handles the **seasons** table (create + date-change updates). Application
  windows and regs summaries extend the same pattern.
- Georgia's source is a PDF, sent to Claude as a base64 document; HTML sources are
  fetched and stripped to text. State is resolved from `sources.state_id`.
- The model is instructed never to guess — unconfirmed dates come back `null`.
