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

## `extract-source` — automated refresh

Fetches an official source, asks Claude (`claude-opus-4-8`) to extract structured
**seasons, application windows (draw deadlines), and regulation summaries**, diffs
each against the current rows, and enqueues proposed changes into `review_queue`.
**Nothing is published** — you approve each item on the in-app **Admin** tab,
which calls `apply_review_item()` (handles all three tables) to apply it and stamp
`last_verified_at`. Re-runs are idempotent: a logical row that already has a
pending proposal is skipped, so the queue never fills with duplicates.

### 1. Set the Anthropic key as a function secret (PowerShell)

```powershell
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — do not set them.

### 2. Deploy

```powershell
npx supabase functions deploy extract-source
```

### 3. Invoke it

```powershell
# Process the single stalest source (what the cron does each tick).
curl -X POST "https://soxglmgbhmpuxhngcsvx.supabase.co/functions/v1/extract-source" `
  -H "Authorization: Bearer <YOUR_SERVICE_ROLE_KEY>" `
  -H "content-type: application/json" -d '{}'

# Kick off a bulk backfill: process the 25 stalest sources this run.
#   -d '{ "max": 25 }'
# Or target one exactly:
#   -d '{ "sourceId": "<uuid>" }'
```
Returns `{ ok, run_id, sources, results:[{ source, extracted, created, updated,
unchanged, skipped }] }`. Then open the app's **Admin** tab (as your admin
account) to review and approve the proposals.

### 4. Schedule the round-robin refresh with pg_cron

`pg_cron` and `pg_net` are already enabled. Each empty-body run processes the
**stalest source** (ordered by `sources.last_extracted_at`), so an hourly job
cycles through every source and keeps the whole catalog fresh. Run once in the
SQL Editor, substituting your service-role key:

```sql
select cron.schedule(
  'refresh-sources-hourly',
  '17 * * * *',  -- every hour at :17
  $$
  select net.http_post(
    url     := 'https://soxglmgbhmpuxhngcsvx.supabase.co/functions/v1/extract-source',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
-- Unschedule: select cron.unschedule('refresh-sources-hourly');
```

> The service-role key in a cron job is stored in the `cron.job` table (admin-only).
> For production, store it in Supabase Vault and read it in the job instead.

### How it works

- Extracts **seasons, application windows, and regulation summaries** from each
  source; a source that only lists one kind returns empty arrays for the rest.
- PDF sources are sent to Claude as a base64 document; HTML sources are fetched
  and stripped to text. State is resolved from `sources.state_id` (a source must
  have one, or it's skipped).
- The model is instructed **never to guess** — unconfirmed dates come back `null`.
- Every proposal lands in `review_queue` as `draft`/pending; you approve in-app.
  Approving is what publishes it and makes it eligible for countdowns and alerts.
