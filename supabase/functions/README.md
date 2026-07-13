# Edge Functions

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
