"""Generate SEO state pages for osdatesanddraws.com from the live database.

For every active state, emits docs/site/states/<state-name>.html with its
current + upcoming season dates, draw/application deadlines, verified stamps,
and an app CTA — Ember-styled, self-contained, no external assets (fast +
crawler-friendly). Also emits states/index.html and sitemap.xml.

Run anytime to refresh:  python scripts/gen_state_pages.py
Then upload the states/ folder (and sitemap.xml) to the website repo.
"""
import json
import os
import re
import urllib.request
from datetime import date

BASE = "https://soxglmgbhmpuxhngcsvx.supabase.co/rest/v1"
KEY = "sb_publishable_5rIoEtCHn8PcWgHit5NgzQ_Qjpn2AHc"  # public anon key
SITE = "https://osdatesanddraws.com"

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "..", "docs", "site", "states")
os.makedirs(OUT, exist_ok=True)

TODAY = date.today().isoformat()


def get(path):
    req = urllib.request.Request(f"{BASE}/{path}", headers={"apikey": KEY})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def fmt(d):
    if not d:
        return "TBD"
    y, m, day = d.split("-")
    months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return f"{months[int(m)]} {int(day)}, {y}"


def verified_ago(ts):
    if not ts:
        return "pending verification"
    d = (date.today() - date.fromisoformat(ts[:10])).days
    if d <= 0:
        return "verified today"
    if d == 1:
        return "verified yesterday"
    if d < 30:
        return f"verified {d} days ago"
    return f"verified {d // 30} month{'s' if d >= 60 else ''} ago"


CSS = """
  :root { --bg:#100e0c; --surface:#17130f; --border:rgba(217,158,127,.2);
    --text:#f4f1ea; --soft:rgba(244,241,234,.75); --muted:rgba(244,241,234,.55); --copper:#d99e7f; }
  *{box-sizing:border-box} body{margin:0;padding:0 20px 80px;background:var(--bg);color:var(--text);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
  .wrap{max-width:820px;margin:0 auto}
  header{padding:40px 0 24px;border-bottom:1px solid var(--border);margin-bottom:28px}
  .brand{font-size:12px;letter-spacing:1.6px;font-weight:600;color:var(--copper);text-transform:uppercase;margin:0 0 10px}
  .brand a{color:var(--copper);text-decoration:none}
  h1{font-family:Georgia,"Times New Roman",serif;font-size:34px;line-height:1.15;margin:0 0 10px}
  h2{font-family:Georgia,serif;font-size:23px;margin:36px 0 12px}
  p{color:var(--soft);margin:0 0 14px}
  .meta{color:var(--muted);font-size:14px;margin:0}
  table{width:100%;border-collapse:collapse;font-size:14.5px;margin:8px 0 6px}
  th{color:var(--muted);text-transform:uppercase;font-size:11px;letter-spacing:1px;text-align:left;
     padding:8px 10px;border-bottom:1px solid var(--border)}
  td{padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.06);color:var(--soft)}
  td.sp{color:var(--text);font-weight:600}
  .stamp{color:var(--muted);font-size:12.5px;margin:2px 0 18px}
  .cta{background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--copper);
       border-radius:12px;padding:18px 20px;margin:30px 0}
  .cta a{color:var(--copper)}
  a{color:var(--copper)}
  footer{margin-top:48px;padding-top:20px;border-top:1px solid var(--border);color:var(--muted);font-size:13.5px}
"""


def page(title, desc, canonical, body):
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canonical}">
<style>{CSS}</style>
</head>
<body>
<div class="wrap">
{body}
<footer>
  © 2026 Piece &amp; Quiet, LLC · <a href="{SITE}">Open Season — Dates &amp; Draws</a>.
  Informational only — always confirm dates with the official state wildlife agency before hunting or applying.
</footer>
</div>
</body>
</html>
"""


CTA = f"""
<div class="cta">
  <p><strong>Never miss one of these dates.</strong> Open Season sends a push notification before every
  opener and draw deadline you follow — and if an agency moves a date, you get an alert with the old
  date and the new one. <a href="{SITE}">Get the app →</a></p>
</div>
"""

# ---------------------------------------------------------------------------
states = get("states?is_active=eq.true&select=id,code,name,agency_name,license_url&order=name")
print(f"{len(states)} active states")

seasons = get(
    "seasons?status=eq.published&select=state_id,open_date,close_date,method,label,last_verified_at,"
    "species:species(name),zone:zones(name)&order=open_date.asc.nullslast&limit=10000")
windows = get(
    "application_windows?status=eq.published&select=state_id,name,opens_at,closes_at,results_expected_at,"
    "last_verified_at,species:species(name)&order=closes_at.asc.nullslast&limit=10000")

by_state_seasons = {}
for s in seasons:
    # keep current + upcoming only
    if s["close_date"] and s["close_date"] < TODAY:
        continue
    if not s["open_date"]:
        continue
    by_state_seasons.setdefault(s["state_id"], []).append(s)

by_state_windows = {}
for w in windows:
    if w["closes_at"] and w["closes_at"] < TODAY:
        continue
    by_state_windows.setdefault(w["state_id"], []).append(w)

links = []
for st in states:
    slug = slugify(st["name"])
    ss = by_state_seasons.get(st["id"], [])
    ws = by_state_windows.get(st["id"], [])

    newest = max((x["last_verified_at"] or "" for x in ss + ws), default="")

    rows = ""
    for s in ss:
        zone = s["zone"]["name"] if s.get("zone") else ""
        zone = "" if zone == "Statewide" else zone
        label = s.get("label") or ""
        method = (s.get("method") or "").capitalize()
        detail = " · ".join(x for x in (method, label, zone) if x)
        rows += (f"<tr><td class=sp>{s['species']['name']}</td><td>{detail}</td>"
                 f"<td>{fmt(s['open_date'])} – {fmt(s['close_date'])}</td></tr>\n")

    wrows = ""
    for w in ws:
        res = f" · results {fmt(w['results_expected_at'])}" if w.get("results_expected_at") else ""
        closes = fmt(w["closes_at"]) if w["closes_at"] else "see agency portal"
        wrows += (f"<tr><td class=sp>{w['species']['name']}</td><td>{w.get('name') or 'Draw'}</td>"
                  f"<td>{closes}{res}</td></tr>\n")

    season_block = (
        f"<h2>Season dates</h2>\n<table><tr><th>Species</th><th>Season</th><th>Dates</th></tr>\n{rows}</table>"
        f"<p class=stamp>Data {verified_ago(newest)} against official {st['agency_name'] or 'state agency'} sources.</p>"
        if rows else
        "<h2>Season dates</h2><p>Current-season dates for this state are being verified against official "
        "agency sources — check back soon, or confirm directly with the agency below.</p>")

    window_block = (
        f"<h2>Draw &amp; application deadlines</h2>\n<table><tr><th>Species</th><th>Draw</th><th>Apply by</th></tr>\n{wrows}</table>"
        if wrows else "")

    agency_block = ""
    if st["license_url"]:
        agency_block = (f"<h2>Licenses &amp; official source</h2>"
                        f"<p>Buy licenses and apply for draws through the official portal: "
                        f"<a href=\"{st['license_url']}\" rel=\"nofollow\">{st['agency_name'] or st['name']}</a>.</p>")

    title = f"{st['name']} Hunting Seasons 2026-27 — Dates & Draw Deadlines"
    desc = (f"{st['name']} hunting season dates and draw deadlines for 2026-27, verified against official "
            f"{st['agency_name'] or 'state agency'} sources. Openers, closures, and application dates by species.")
    body = f"""
<header>
  <p class="brand"><a href="{SITE}">OPEN SEASON</a> · <a href="index.html">STATES</a></p>
  <h1>{st['name']} hunting seasons 2026–27</h1>
  <p class="meta">Season dates and draw deadlines, compiled from official {st['agency_name'] or 'state agency'} sources.</p>
</header>
{season_block}
{window_block}
{CTA}
{agency_block}
"""
    with open(os.path.join(OUT, f"{slug}.html"), "w", encoding="utf-8") as f:
        f.write(page(title, desc, f"{SITE}/states/{slug}.html", body))
    links.append((st["name"], slug, len(ss), len(ws)))
    print(f"  {st['code']}: {len(ss)} seasons, {len(ws)} draws -> states/{slug}.html")

# ---------------------------------------------------------------------------
# States index
items = "\n".join(
    f'<tr><td class=sp><a href="{slug}.html">{name}</a></td><td>{ns} season dates</td><td>{nw} draws</td></tr>'
    for name, slug, ns, nw in links)
idx_body = f"""
<header>
  <p class="brand"><a href="{SITE}">OPEN SEASON</a></p>
  <h1>Hunting seasons by state, 2026–27</h1>
  <p class="meta">Current season dates and draw deadlines for all 50 states, verified against official agency sources.</p>
</header>
<table><tr><th>State</th><th>Seasons</th><th>Draws</th></tr>
{items}
</table>
{CTA}
"""
with open(os.path.join(OUT, "index.html"), "w", encoding="utf-8") as f:
    f.write(page("Hunting Seasons by State 2026-27 — Open Season",
                 "Hunting season dates and draw deadlines for all 50 states, verified against official sources.",
                 f"{SITE}/states/", idx_body))

# Sitemap
urls = [f"{SITE}/", f"{SITE}/states/"] + [f"{SITE}/states/{slug}.html" for _, slug, _, _ in links]
sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
sitemap += "\n".join(f"  <url><loc>{u}</loc></url>" for u in urls)
sitemap += "\n</urlset>\n"
with open(os.path.join(OUT, "..", "sitemap.xml"), "w", encoding="utf-8") as f:
    f.write(sitemap)

print(f"done: {len(links)} state pages + states/index.html + sitemap.xml")
