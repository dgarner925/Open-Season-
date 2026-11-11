# `ingest-leftover-tags` — leftover and OTC tag sales

Reads the agency pages in [`registry.ts`](./registry.ts), proposes what it finds
into `review_queue`, and logs every fetch to `source_fetch_log`. It publishes
nothing: `apply_review_item` does that, once a human has looked.

```bash
npx supabase functions deploy ingest-leftover-tags
```

| Body | What it does |
|---|---|
| `{}` | Every verified entry. This is what the cron sends. |
| `{"state":"CO"}` | One state. |
| `{"dry":true}` | Fetches and extracts, writes nothing but the fetch log. |
| `{"force":true}` | Ignores the content hash and re-extracts. |

Needs `ANTHROPIC_API_KEY` as a function secret; `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are injected. The guard refuses anything but a
service-role token — this spends money, and the app's publishable key ships in
every build.

---

## Adding a state

Most of the work is reading, not typing. The code is twenty lines; knowing
whether a page can be trusted is the job.

### 1. Find the page that holds the date

You are looking for **a stable URL that states when the sale opens**. Not a
page that links to it, not a news feed that mentioned it once.

Of the first eleven states researched, roughly half do not have one:

| State | Where the date actually lives |
|---|---|
| WY | Press releases, worded differently every year |
| NM | Press releases, and residents get the first 24 hours |
| ND | Behind a signed-in My Account page |
| SD | An annual PDF, replaced (not versioned) each year |
| AZ | 403 Forbidden to any automated fetch |

**A state like that does not get an adapter.** Pointing a scraper at a press
release is not automation, it is a confident guess about the one field — the
date — that this whole feature exists to get right. Those states are entered by
hand with [`scripts/leftover_sale.js`](../../../scripts/leftover_sale.js), once
a year, when the agency announces them. Add them to `REGISTRY` with
`verified: null` so the roster knows they exist and `pendingStates()` can
report them.

### 2. Check the state is in the registry as a lead

```ts
{
  state_code: 'NV',
  sources: [{ url: 'https://...', role: 'list' }],
  shape: 'first_come',
  verified: null,          // <- a lead, not a source
  note: 'Dates announced in a June press release; no stable page found.',
}
```

`liveEntries()` only returns entries with a `verified` date, so a lead is never
fetched. The registry tests enforce two things worth keeping: every URL is
`https`, and no URL is a blog or an aggregator (`gohunt`, `huntinfool`, `onx`,
Reddit, Facebook). Those sites are often more readable than the agency's. They
are also often wrong, and being wrong with a citation is worse than being
silent.

### 3. Promote it to verified

Open the page yourself. Confirm:

- the sale date is **on this page**, in text, not in a linked PDF;
- the page is the same URL year to year (search the agency's site for last
  year's announcement and see where it lives now);
- `robots.txt` allows it — the function checks, but check before you write the
  entry, or you will wonder why the state never runs.

Then set `verified: '2026-11-10'` (the day *you* read it) and `shape`.

### 4. If the date comes from a rule, say so instead

Oregon publishes no annual page. It publishes a regulation: leftover tags go on
sale at **10 a.m. Pacific on 1 July**, every year, and bear tags on 15 March.

```ts
fixed: [
  { month: 7, day: 1, time: '10:00:00', zone: 'America/Los_Angeles' },
  { month: 3, day: 15, time: '10:00:00', zone: 'America/Los_Angeles',
    species: ['bear'] },
],
```

This is **strictly better than scraping**. It keeps working when the agency's
site is down, redesigned, or blocking us, and it is what the agency itself
considers authoritative. A fixed schedule still produces proposals through
`review_queue`, so if the regulation changes a human sees it.

Prefer a rule over a page wherever a state has one.

### 5. Run it dry

```bash
curl -X POST "$SUPABASE_URL/functions/v1/ingest-leftover-tags" \
  -H "Authorization: Bearer $SERVICE_ROLE" \
  -H 'content-type: application/json' \
  -d '{"state":"NV","dry":true}'
```

A dry run writes nothing. Read `proposals` and, more importantly, `discarded` —
that array tells you *why* something did not survive, and the usual answers are
real problems:

- `quote not found on the page` — the model invented it. The extractor checks
  every proposal's supporting quote against the fetched text, which is what
  catches a confident invention.
- `unknown species "..."` — the page uses a name the database does not. Fix the
  species keys you pass, not the database.
- `no quote or no date` — the page probably does not state a date after all.
  Go back to step 1.

### 6. Watch the confidence

`confidenceFor` is deliberately pessimistic about the two things that bite:

| Condition | Penalty |
|---|---|
| no published hour | −0.10 |
| named a unit we cannot match | −0.25 |
| no purchase URL | −0.05 |
| no end date | −0.02 |
| a reissue (rarest, least consistently worded) | −0.05 |

`approve_clean_reviews` sweeps at **0.85**, so a sale with no hour or an
unmatched unit always reaches a human. A page that contradicts itself is capped
at 0.50 outright — and agency pages contradict themselves on exactly these
fields. CPW has given one reissue start as both "March 11th" and "Tuesday,
March 3"; Wyoming's table closed a Super Tag on "Feb 2" above a footnote saying
February 1.

---

## What the function will not do

1. **Fetch a page nobody has verified.** `verified: null` is a lead, not a
   source.
2. **Fetch a page `robots.txt` forbids.** Where the file is ambiguous the answer
   is no. A 5xx on `robots.txt` reads as a disallow: a server having a bad day
   is not consent.
3. **Re-extract a page that has not changed.** The content hash is the whole
   economy of this function, and it is keyed by URL rather than by state —
   Wyoming has two pages, and keyed by state they would overwrite each other's
   hash and look changed every night.

It also sleeps 1.5 s between requests and identifies itself:

```
OpenSeasonBot/1.0 (+https://osdatesanddraws.com/bot; hunting season dates for hunters)
```

We are a guest on these servers.

---

## Scheduling

Nightly is plenty — a leftover sale date is announced weeks ahead, and the hash
means an unchanged page costs one request.

```sql
select cron.schedule(
  'ingest-leftover-tags-nightly',
  '0 5 * * *',
  $$
  select net.http_post(
    url     := 'https://<ref>.supabase.co/functions/v1/ingest-leftover-tags',
    headers := jsonb_build_object('Authorization', 'Bearer <service-role>', 'Content-Type', 'application/json'),
    body    := '{}'::jsonb
  );
  $$
);
```

> A cron job that reports `succeeded` only means the SQL ran. Check
> `net._http_response` for what the request actually returned.
