"""Capture federal hunting-permit opportunities from Recreation.gov.

Sweeps the public search API for permit entities matching hunting terms,
dedupes by entity_id, and (with --emit-migration) writes an idempotent
SQL migration upserting into federal_permit_hunts. Default run is a
dry-run report: counts by agency and state, plus a sample.

Re-runnable: the migration upserts on entity_id, so refreshes are safe.
"""
import argparse
import datetime
import json
import re
import sys
import time
import urllib.parse
import urllib.request

API = "https://www.recreation.gov/api/search"
UA = "OpenSeasonApp-DataIngest/1.0 (osdatesanddraws.com; contact@osdatesanddraws.com)"
STATE_NAMES = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New%20Hampshire', 'New%20Jersey', 'New%20Mexico', 'New%20York', 'North%20Carolina', 'North%20Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode%20Island', 'South%20Carolina', 'South%20Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West%20Virginia', 'Wisconsin', 'Wyoming']
QUERIES = ["hunting"]
NATIONAL_QUERIES = ["hunting", "hunting permit", "quota hunt", "refuge hunt", "managed hunt", "hunt unit"]
PAGE = 50


def fetch(query: str, start: int, state: str | None = None) -> dict:
    q = {"q": query, "entity_type": "permit", "size": PAGE, "start": start}
    if state:
        q["state"] = state.replace("%20", " ")
    params = urllib.parse.urlencode(q)
    req = urllib.request.Request(f"{API}?{params}", headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))


def looks_like_hunt(name: str, description: str) -> bool:
    # Name says hunt, or the description is explicitly about hunting permits
    # (catches USACE entities named after the lake alone). Description-only
    # passing mentions of hunting (campgrounds, day-use) stay excluded.
    n, d = name.lower(), description.lower()
    # Lodging/facility entities mention hunting in their descriptions but are
    # not managed hunts (Tongass cabins, visitor centers, campgrounds).
    if any(x in n for x in ("cabin", "campground", "visitor center", "lookout", "day use")) and "hunt" not in n:
        return False
    return "hunt" in n or "hunting permit" in d or "hunting pass" in d


def sweep() -> dict:
    seen: dict[str, dict] = {}
    # National passes first (catch blank-state entities), then per-state to get
    # under the relevance-ranking cap in permit-dense states.
    for q in NATIONAL_QUERIES:
      for st in [None]:
        start = 0
        while True:
            data = fetch(q, start, st)
            results = data.get("results") or []
            if not results:
                break
            for r in results:
                eid = str(r.get("entity_id") or "")
                if not eid or eid in seen:
                    continue
                if not looks_like_hunt(r.get("name", ""), r.get("description", "")):
                    continue
                seen[eid] = {
                    "entity_id": eid,
                    "name": (r.get("name") or "").strip(),
                    "agency": (r.get("org_name") or "").strip() or None,
                    "state": (r.get("state_code") or "").strip() or None,
                    "city": (r.get("city") or "").strip() or None,
                    "description": (r.get("description") or "").strip()[:600] or None,
                    "lat": r.get("latitude"),
                    "lng": r.get("longitude"),
                    "reservable": bool(r.get("reservable")),
                    "url": f"https://www.recreation.gov/permits/{eid}",
                    "image_url": r.get("preview_image_url") or None,
                }
            start += PAGE
            total = data.get("total_results") or data.get("total") or 0
            if start >= min(int(total), 1000):
                break
            time.sleep(0.3)
    for q in QUERIES:
      for st in STATE_NAMES:
        start = 0
        while True:
            data = fetch(q, start, st)
            results = data.get("results") or []
            if not results:
                break
            for r in results:
                eid = str(r.get("entity_id") or "")
                if not eid or eid in seen:
                    continue
                if not looks_like_hunt(r.get("name", ""), r.get("description", "")):
                    continue
                seen[eid] = {
                    "entity_id": eid,
                    "name": (r.get("name") or "").strip(),
                    "agency": (r.get("org_name") or "").strip() or None,
                    "state": (r.get("state_code") or "").strip() or None,
                    "city": (r.get("city") or "").strip() or None,
                    "description": (r.get("description") or "").strip()[:600] or None,
                    "lat": r.get("latitude"),
                    "lng": r.get("longitude"),
                    "reservable": bool(r.get("reservable")),
                    "url": f"https://www.recreation.gov/permits/{eid}",
                    "image_url": r.get("preview_image_url") or None,
                }
            start += PAGE
            total = data.get("total_results") or data.get("total") or 0
            if start >= min(int(total), 1000):
                break
            time.sleep(0.3)
    return seen


def sql_quote(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def emit_migration(rows: list[dict], path: str) -> None:
    lines = [
        "-- Federal permit hunts from Recreation.gov (generated by scripts/ingest_recgov_permits.py).",
        "-- Idempotent: upserts on entity_id; re-run the script and regenerate to refresh.",
        "insert into public.federal_permit_hunts",
        "  (entity_id, name, agency, state_code, city, description, lat, lng, reservable, url, image_url, last_seen_at)",
        "values",
    ]
    vals = []
    for r in rows:
        vals.append(
            "  (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())"
            % (
                sql_quote(r["entity_id"]), sql_quote(r["name"]), sql_quote(r["agency"]),
                sql_quote(r["state"]), sql_quote(r["city"]), sql_quote(r["description"]),
                sql_quote(r["lat"]), sql_quote(r["lng"]), sql_quote(r["reservable"]),
                sql_quote(r["url"]), sql_quote(r["image_url"]),
            )
        )
    lines.append(",\n".join(vals))
    lines.append(
        "on conflict (entity_id) do update set\n"
        "  name = excluded.name, agency = excluded.agency, state_code = excluded.state_code,\n"
        "  city = excluded.city, description = excluded.description, lat = excluded.lat,\n"
        "  lng = excluded.lng, reservable = excluded.reservable, url = excluded.url,\n"
        "  image_url = excluded.image_url, last_seen_at = now();"
    )
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


MONTHS = {m.lower(): i + 1 for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June",
     "July", "August", "September", "October", "November", "December"])}
MONTH_RX = r"(January|February|March|April|May|June|July|August|September|October|November|December)"
# Current hunting-season year: seasons open Aug Y .. Jul Y+1.
SEASON_YEAR = datetime.date.today().year if datetime.date.today().month >= 7 else datetime.date.today().year - 1


def fetch_permit_description(entity_id: str) -> str:
    """Full description text from the permitcontent API (search results truncate it)."""
    req = urllib.request.Request(
        f"https://www.recreation.gov/api/permitcontent/{entity_id}", headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                payload = json.load(r).get("payload") or {}
            desc = payload.get("description") or ""
            # description is often itself a JSON blob of sections
            if isinstance(desc, str) and desc.lstrip().startswith("{"):
                try:
                    desc = " ".join(str(v) for v in json.loads(desc).values())
                except Exception:
                    pass
            elif isinstance(desc, dict):
                desc = " ".join(str(v) for v in desc.values())
            return re.sub(r"<[^>]+>", " ", str(desc))
        except Exception:
            if attempt == 3:
                return ""
            time.sleep(2 * (attempt + 1))
    return ""


def parse_hunt_dates(text: str) -> list[dict]:
    """Extract explicit season date ranges with a strict freshness gate.

    Only trusts text that names the CURRENT season year (e.g. "2026 hunt
    dates"); stale pages (Lanier still says 2025) yield nothing rather than a
    wrong reminder. Months Jan-Jun belong to the following calendar year.
    """
    # The season year must come from the DATE CONTEXT, not anywhere on the
    # page — Lanier's page says "The 2025 hunt dates are: November 6-9" while a
    # stray 2026 sits in its policy text. Accept only an explicit
    # "<year> hunt dates"-style marker, or a year within 60 chars of the first
    # parsed date; anything else (or a stale year) yields nothing.
    marker = re.search(r"\b(20\d\d)(?:\s*[–—-]\s*(?:20)?\d\d)?\s+(?:hunt|hunting|season)\s+dates?\b", text, re.I)
    base = None
    if marker:
        base = int(marker.group(1))
    else:
        first = re.search(MONTH_RX + r"\.?\s+\d{1,2}\s*[–—-]", text, re.I)
        if first:
            window = text[max(0, first.start() - 60): first.end() + 60]
            near = re.findall(r"\b(20\d\d)\b", window)
            if near:
                base = int(near[0])
    if base is None or base < SEASON_YEAR:
        return []

    out = []
    # "November 6-9" / "November 6 - December 2" / "Nov. 6 – 9"
    rx = re.compile(MONTH_RX + r"\.?\s+(\d{1,2})\s*[–—-]\s*(?:" + MONTH_RX + r"\.?\s+)?(\d{1,2})", re.I)
    for m in rx.finditer(text):
        om, od, cm, cd = m.group(1), int(m.group(2)), m.group(3), int(m.group(4))
        om_n = MONTHS[om.lower()]
        cm_n = MONTHS[cm.lower()] if cm else om_n
        oy = base if om_n >= 7 else base + 1
        cy = base if cm_n >= 7 else base + 1
        if (cy, cm_n, cd) < (oy, om_n, od):
            continue
        try:
            open_d = datetime.date(oy, om_n, od)
            close_d = datetime.date(cy, cm_n, cd)
        except ValueError:
            continue
        label = f"{om.capitalize()} {od}" + (f" – {cm.capitalize()} {cd}" if cm else f"–{cd}")
        out.append({"label": label, "open": open_d.isoformat(), "close": close_d.isoformat()})
    # de-dupe, keep order, cap at 12 segments per hunt (defensive)
    seen, uniq = set(), []
    for d in out:
        k = (d["open"], d["close"])
        if k not in seen:
            seen.add(k)
            uniq.append(d)
    return uniq[:12]


def emit_dates_migration(entity_ids: list[str], path: str) -> None:
    """Fetch + parse dates for the given entities; write a replace-style migration."""
    found: dict[str, list[dict]] = {}
    for eid in entity_ids:
        text = fetch_permit_description(eid)
        dates = parse_hunt_dates(text) if text else []
        if dates:
            found[eid] = dates
            print(f"  {eid}: {len(dates)} segments ({dates[0]['open']} .. {dates[-1]['close']})")
        time.sleep(0.4)
    print(f"dates parsed for {len(found)}/{len(entity_ids)} entities (freshness gate: {SEASON_YEAR})")
    if not found:
        print("nothing fresh to emit; no migration written")
        return
    lines = [
        "-- Permit hunt dates parsed from Recreation.gov descriptions",
        f"-- (generated by scripts/ingest_recgov_permits.py --emit-dates-migration; season year {SEASON_YEAR}).",
        "-- Replace-style: clears and refills each parsed permit's rows.",
        "delete from public.federal_permit_hunt_dates where permit_id in (",
        "  select id from public.federal_permit_hunts where entity_id in ("
        + ", ".join(sql_quote(e) for e in found) + "));",
        "insert into public.federal_permit_hunt_dates (permit_id, label, open_date, close_date)",
        "select p.id, v.label, v.open_date::date, v.close_date::date",
        "from (values",
    ]
    vals = []
    for eid, dates in found.items():
        for d in dates:
            vals.append("  (%s, %s, %s, %s)" % (
                sql_quote(eid), sql_quote(d["label"]), sql_quote(d["open"]), sql_quote(d["close"])))
    lines.append(",\n".join(vals))
    lines.append(") as v(entity_id, label, open_date, close_date)")
    lines.append("join public.federal_permit_hunts p on p.entity_id = v.entity_id;")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--emit-migration", metavar="PATH", help="write an upsert migration to PATH")
    ap.add_argument("--emit-dates-migration", metavar="PATH",
                    help="fetch descriptions for entities listed in --entity-ids-file (one per line) and write a dates migration")
    ap.add_argument("--entity-ids-file", metavar="PATH", help="entity ids to parse dates for")
    ap.add_argument("--state", help="only report this state in the sample")
    args = ap.parse_args()

    if args.emit_dates_migration:
        if not args.entity_ids_file:
            sys.exit("--emit-dates-migration requires --entity-ids-file")
        ids = [l.strip() for l in open(args.entity_ids_file, encoding="utf-8") if l.strip()]
        emit_dates_migration(ids, args.emit_dates_migration)
        return

    rows = sorted(sweep().values(), key=lambda r: ((r["state"] or "~"), r["name"]))
    by_agency: dict[str, int] = {}
    by_state: dict[str, int] = {}
    for r in rows:
        by_agency[r["agency"] or "?"] = by_agency.get(r["agency"] or "?", 0) + 1
        by_state[r["state"] or "?"] = by_state.get(r["state"] or "?", 0) + 1

    print(f"captured: {len(rows)} distinct hunting permit entities")
    print("\nby agency:")
    for k, v in sorted(by_agency.items(), key=lambda x: -x[1]):
        print(f"  {v:4d}  {k}")
    print("\nby state (top 15):")
    for k, v in sorted(by_state.items(), key=lambda x: -x[1])[:15]:
        print(f"  {v:4d}  {k}")
    sample = [r for r in rows if not args.state or (r["state"] or "") == args.state]
    print(f"\nsample{' for ' + args.state if args.state else ''}:")
    for r in sample[:12]:
        print(f"  - {r['name']}  [{r['agency']}] {r['state'] or '?'}  {r['url']}")

    if args.emit_migration:
        emit_migration(rows, args.emit_migration)
        print(f"\nwrote migration: {args.emit_migration} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
