"""Capture federal hunting-permit opportunities from Recreation.gov.

Sweeps the public search API for permit entities matching hunting terms,
dedupes by entity_id, and (with --emit-migration) writes an idempotent
SQL migration upserting into federal_permit_hunts. Default run is a
dry-run report: counts by agency and state, plus a sample.

Re-runnable: the migration upserts on entity_id, so refreshes are safe.
"""
import argparse
import json
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--emit-migration", metavar="PATH", help="write an upsert migration to PATH")
    ap.add_argument("--state", help="only report this state in the sample")
    args = ap.parse_args()

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
