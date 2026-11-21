"""Generate SEO state pages for osdatesanddraws.com from the live database.

For every active state, emits docs/site/states/<state-name>.html with its
current + upcoming season dates, draw/application deadlines, verified stamps,
and an app CTA — Ember-styled, self-contained, no external assets (fast +
crawler-friendly). Also emits states/index.html and sitemap.xml.

Run anytime to refresh:  python scripts/gen_state_pages.py
Then upload the states/ folder (and sitemap.xml) to the website repo.
"""
import html
import json
import os
import re
import urllib.request
from datetime import date

BASE = "https://soxglmgbhmpuxhngcsvx.supabase.co/rest/v1"
KEY = "sb_publishable_5rIoEtCHn8PcWgHit5NgzQ_Qjpn2AHc"  # public anon key
SITE = "https://osdatesanddraws.com"
# The state pages are the whole point of the site: someone searching "ohio deer
# season dates" lands here with exactly the intent we want. Until 2026-11-06 the
# CTA on all fifty of them pointed at the marketing homepage, so a reader who
# wanted the app had to go find the store link themselves. Point it at the store.
APPSTORE = "https://apps.apple.com/us/app/id6791993537"

# Neighbouring states, for the "nearby states" block on every page.
#
# On 2026-11-06 Google knew about four URLs on this site and had indexed one,
# with all fifty state pages in the sitemap. A sitemap is an invitation, not a
# path: every state page linked only to the index and the homepage, so the
# crawler met fifty leaves hanging off one twig and stopped bothering. Links
# between the pages give it a reason to walk them.
#
# Adjacency rather than an alphabetical strip or a dump of all fifty, because
# it is the version a reader actually wants: somebody reading Georgia's dates
# is deciding between Georgia, Alabama and Tennessee, not between Georgia and
# Hawaii. Alaska and Hawaii have no neighbours and get the index link alone.
ADJACENT = {
    "AL": ["FL", "GA", "TN", "MS"],
    "AK": [],
    "AZ": ["CA", "NV", "UT", "NM", "CO"],
    "AR": ["MO", "TN", "MS", "LA", "TX", "OK"],
    "CA": ["OR", "NV", "AZ"],
    "CO": ["WY", "NE", "KS", "OK", "NM", "UT", "AZ"],
    "CT": ["NY", "MA", "RI"],
    "DE": ["MD", "PA", "NJ"],
    "FL": ["GA", "AL"],
    "GA": ["FL", "AL", "TN", "NC", "SC"],
    "HI": [],
    "ID": ["WA", "OR", "NV", "UT", "WY", "MT"],
    "IL": ["WI", "IA", "MO", "KY", "IN"],
    "IN": ["IL", "MI", "OH", "KY"],
    "IA": ["MN", "WI", "IL", "MO", "NE", "SD"],
    "KS": ["NE", "MO", "OK", "CO"],
    "KY": ["IL", "IN", "OH", "WV", "VA", "TN", "MO"],
    "LA": ["TX", "AR", "MS"],
    "ME": ["NH"],
    "MD": ["DE", "PA", "WV", "VA"],
    "MA": ["NY", "VT", "NH", "RI", "CT"],
    "MI": ["WI", "IN", "OH"],
    "MN": ["WI", "IA", "SD", "ND"],
    "MS": ["LA", "AR", "TN", "AL"],
    "MO": ["IA", "IL", "KY", "TN", "AR", "OK", "KS", "NE"],
    "MT": ["ID", "WY", "SD", "ND"],
    "NE": ["SD", "IA", "MO", "KS", "CO", "WY"],
    "NV": ["CA", "OR", "ID", "UT", "AZ"],
    "NH": ["ME", "MA", "VT"],
    "NJ": ["NY", "PA", "DE"],
    "NM": ["AZ", "UT", "CO", "OK", "TX"],
    "NY": ["VT", "MA", "CT", "NJ", "PA"],
    "NC": ["VA", "TN", "GA", "SC"],
    "ND": ["MT", "SD", "MN"],
    "OH": ["MI", "IN", "KY", "WV", "PA"],
    "OK": ["KS", "MO", "AR", "TX", "NM", "CO"],
    "OR": ["WA", "ID", "NV", "CA"],
    "PA": ["NY", "NJ", "DE", "MD", "WV", "OH"],
    "RI": ["CT", "MA"],
    "SC": ["NC", "GA"],
    "SD": ["ND", "MN", "IA", "NE", "WY", "MT"],
    "TN": ["KY", "VA", "NC", "GA", "AL", "MS", "AR", "MO"],
    "TX": ["NM", "OK", "AR", "LA"],
    "UT": ["ID", "WY", "CO", "NM", "AZ", "NV"],
    "VT": ["NY", "NH", "MA"],
    "VA": ["MD", "WV", "KY", "TN", "NC"],
    "WA": ["ID", "OR"],
    "WV": ["PA", "MD", "VA", "KY", "OH"],
    "WI": ["MN", "IA", "IL", "MI"],
    "WY": ["MT", "SD", "NE", "CO", "UT", "ID"],
}

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "..", "docs", "site", "states")
os.makedirs(OUT, exist_ok=True)

TODAY = date.today().isoformat()

# Typography used by the pages built below. Spelled as code points rather than
# as literal characters so this file stays ASCII-safe through any tool that
# re-encodes it on the way to disk.
EN = chr(0x2013)   # en dash: date ranges
EM = chr(0x2014)   # em dash: titles, and "no value here"
NL = chr(10)


def get(path):
    req = urllib.request.Request(f"{BASE}/{path}", headers={"apikey": KEY})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def get_all(path):
    """Page past PostgREST's row cap.

    A bare limit=10000 does not raise it: the server caps a response at 1000
    rows and says nothing. With seasons ordered by open_date that silently cut
    the site off at 2026-09-15 for months - every autumn and winter opener,
    on all fifty pages, missing with no error. Found 2026-11-05 when Florida's
    December bear season would not appear.

    Callers must order by something unique (id, as a tiebreaker is fine), or
    paging by offset can repeat or skip rows across page boundaries.
    """
    out, offset, page = [], 0, 1000
    while True:
        sep = "&" if "?" in path else "?"
        rows = get(f"{path}{sep}limit={page}&offset={offset}")
        out.extend(rows)
        if len(rows) < page:
            return out
        offset += page


def detail(method, label, zone):
    """Join method / label / zone, dropping the parts that only repeat another.

    The three fields overlap constantly in the data, because each was written
    to stand alone: Arkansas reads "Archery - Archery - Zone 2", Florida's bear
    season "General - East Panhandle Zone - East Panhandle Bear Zone". Nothing
    is wrong with the rows; the page is just saying the same thing twice.

    So compare them as word sets and keep only the most specific: a part whose
    words are all contained in another part is redundant and goes. That turns
    "General - Antlerless - General Gun - Zone C" into "Antlerless - General
    Gun - Zone C" and leaves genuinely different parts, like "Archery" and
    "Zone 2", both standing.
    """
    parts = [x for x in (method, label, zone) if x]
    words = [set(re.findall(r"[a-z0-9]+", x.lower())) for x in parts]
    keep = []
    for i, w in enumerate(words):
        # Redundant if some other kept-eligible part says everything this one
        # says. On a tie (identical word sets) the earlier part wins, so the
        # method column keeps its position.
        if any(w <= words[j] and (w != words[j] or j < i) for j in range(len(words)) if j != i):
            continue
        keep.append(parts[i])
    return " · ".join(keep)


def esc(s):
    """HTML-escape for an attribute or text node, quotes included."""
    return html.escape(str(s), quote=True)


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def fmt(d):
    if not d:
        return "TBD"
    y, m, day = d.split("-")
    months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return f"{months[int(m)]} {int(day)}, {y}"


def verified_on(ts):
    """An absolute verification date, in a machine-readable <time> element.

    This replaces a relative phrase ("verified 4 days ago") baked into a static
    page that is regenerated weekly: the phrase was printed once and then
    served unchanged for seven more days, so by Sunday it was off by a week.
    How recently the dates were checked is the one thing a reader is trusting
    on this page, and it was the one thing drifting.

    An absolute date cannot drift, and `datetime` gives Google the freshness
    signal the phrase never could.

    Returns (iso_date, phrase) so the caller can also use the date as the
    page's sitemap lastmod and schema dateModified -- one source of truth for
    "when was this true", rather than three that can disagree.
    """
    if not ts:
        return "", "pending verification"
    iso = ts[:10]
    return iso, f'verified <time datetime="{iso}">{fmt(iso)}</time>'


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
  .nearby{margin:30px 0 0}
  .nearby ul{list-style:none;padding:0;margin:8px 0 0;display:flex;flex-wrap:wrap;gap:8px 10px}
  .nearby li{margin:0}
  .nearby a{display:inline-block;padding:5px 11px;border:1px solid var(--border);border-radius:999px;
    font-size:14px;text-decoration:none;background:var(--surface)}
  footer{margin-top:48px;padding-top:20px;border-top:1px solid var(--border);color:var(--muted);font-size:13.5px}
"""


def jsonld_page(title, desc, canonical, modified, crumbs):
    """Structured data: what this page is, when it was last true, where it sits.

    Deliberately `WebPage` and `BreadcrumbList` and nothing more. `Event` would
    win richer search results for an opening date, but a hunting season is not
    an event anyone attends at a location, and `Dataset` invites Google to ask
    for a download that does not exist. Markup that overclaims gets the whole
    page's structured data distrusted, and the one thing this site sells is
    being right.

    `BreadcrumbList` is the part that earns its place: it tells Google these
    fifty pages are one collection under /states/ rather than fifty unrelated
    leaves, which is the same thing the nearby-states links say to the crawler.
    """
    items = "".join(
        '{"@type":"ListItem","position":%d,"name":%s,"item":%s}%s'
        % (i + 1, json.dumps(name), json.dumps(url), "," if i < len(crumbs) - 1 else "")
        for i, (name, url) in enumerate(crumbs))
    mod = f',"dateModified":{json.dumps(modified)}' if modified else ""
    return (
        '<script type="application/ld+json">'
        '{"@context":"https://schema.org","@graph":['
        '{"@type":"WebPage","name":%s,"description":%s,"url":%s%s,'
        '"isPartOf":{"@type":"WebSite","name":"Open Season — Dates & Draws","url":%s},'
        '"publisher":{"@type":"Organization","name":"Piece & Quiet, LLC"}},'
        '{"@type":"BreadcrumbList","itemListElement":[%s]}]}'
        '</script>'
        % (json.dumps(title), json.dumps(desc), json.dumps(canonical), mod,
           json.dumps(SITE), items))


def page(title, desc, canonical, body, modified="", crumbs=()):
    # Titles carry "Dates & Draw Deadlines" and agency names carry ampersands
    # ("Colorado Parks & Wildlife"), which were going into <title> and into
    # content="..." attributes raw. Browsers forgive a bare & ; validators and
    # some crawlers do not, and one agency name with an apostrophe or a quote
    # in it would have broken the attribute outright. The JSON-LD below is
    # escaped by json.dumps, not by this.
    t, d = esc(title), esc(desc)
    social = f"""<meta property="og:type" content="website">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{SITE}/og-card.png">
<meta name="twitter:card" content="summary_large_image">"""
    schema = jsonld_page(title, desc, canonical, modified, crumbs) if crumbs else ""
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" type="image/png" href="/icon.png">
<link rel="apple-touch-icon" href="/icon.png">
<title>{t}</title>
<meta name="description" content="{d}">
<link rel="canonical" href="{canonical}">
{social}
{schema}
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
  date and the new one. <a href="{APPSTORE}">Get Open Season →</a></p>
</div>
"""

# ---------------------------------------------------------------------------
states = get("states?is_active=eq.true&select=id,code,name,agency_name,license_url&order=name")
print(f"{len(states)} active states")

# Publish gate, graded.
#
# This used to abort the entire publish on any license URL that did not answer
# 200. Four of the last eleven weekly refreshes died that way, always on a
# transient or bot-protected agency page -- Texas's storefront answers 503 to
# this checker every single time. The cost of that rule was the whole site
# going stale for a week because one of fifty links was grumpy, which is a
# worse outcome than any bad link it prevented.
#
# So: a DEAD link (404/410/unresolvable) drops that one state's license block
# and nothing else. A DEGRADED link (403/429/5xx) is kept, because those pages
# work in a browser. Only a pile of dead links aborts, because that means the
# data or this machine's network is broken rather than one agency's page.
from check_links import check_license_urls  # noqa: E402

SYSTEMIC_DEAD = 5

print("link-health check on license URLs...")
_problems = check_license_urls(states)
dead_links = {c for c, _u, _s, k in _problems if k == "dead"}
_degraded = [(c, u, s) for c, u, s, k in _problems if k == "degraded"]
for _c, _u, _s in _degraded:
    print(f"  note: {_c} answered {_s} but is kept -- reachable in a browser")
for _c in sorted(dead_links):
    print(f"  note: {_c} license link is dead; its license block is omitted")
if len(dead_links) > SYSTEMIC_DEAD:
    print(f"ABORTING PUBLISH -- {len(dead_links)} dead license URLs is not one "
          f"agency moving a page, it is something broken here:")
    for _c, _u, _s, _k in _problems:
        if _k == "dead":
            print(f"  {_c}  {_u}  -> {_s}")
    raise SystemExit(1)

seasons = get_all(
    "seasons?status=eq.published&select=id,state_id,open_date,close_date,method,label,last_verified_at,"
    "species:species(name),zone:zones(name)&order=open_date.asc.nullslast,id.asc")
windows = get_all(
    "application_windows?status=eq.published&select=id,state_id,name,opens_at,closes_at,"
    "results_expected_at,last_verified_at,species:species(name)&order=closes_at.asc.nullslast,id.asc")
print(f"{len(seasons)} published seasons, {len(windows)} published draw windows")

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

name_by_code = {st["code"]: st["name"] for st in states}
state_by_id = {st["id"]: st for st in states}

# ---------------------------------------------------------------------------
# Which state x species pages the data has actually earned.
#
# There are 1,036 state x species pairs with at least one published season, and
# the tempting move is to publish all 1,036. Do not: 699 of them hold exactly
# one row. A page whose whole body is one line of table is a doorway page, and
# mass-producing 699 of them is the pattern Google demotes sitewide -- it would
# put the fifty state pages that currently work at risk to chase pairs nobody
# searches for ("Vermont crow season" is not a query).
#
# So the data decides the page count: a pair earns a page when it has either
# several seasons (which means genuine zone/method detail worth a page of its
# own) or an application deadline (which is the highest-intent thing this site
# knows). Everything else stays a row on its state page, where it reads fine.
#
# Grouped over the WHOLE published cycle rather than only what is still open,
# unlike the state pages above. A species page built from upcoming seasons only
# would quietly empty itself out as the winter closes each one, and a page that
# goes blank in February is worse than no page -- it was indexed in October.
# Closed seasons stay, marked closed, which is also what a reader wants to know.
MIN_SEASONS_FOR_PAGE = 2

pair_seasons, pair_windows = {}, {}
for _s in seasons:
    pair_seasons.setdefault((_s["state_id"], _s["species"]["name"]), []).append(_s)
for _w in windows:
    _nm = (_w.get("species") or {}).get("name")
    if _nm:
        pair_windows.setdefault((_w["state_id"], _nm), []).append(_w)

published_pairs = sorted(
    k for k in set(pair_seasons) | set(pair_windows)
    if len(pair_seasons.get(k, [])) >= MIN_SEASONS_FOR_PAGE or pair_windows.get(k))

pairs_by_state, pairs_by_species = {}, {}
for _sid, _sp in published_pairs:
    pairs_by_state.setdefault(_sid, []).append(_sp)
    pairs_by_species.setdefault(_sp, []).append(_sid)

def pair_url(state_id, species):
    """Where a reader goes for this species in this state.

    Falls back to the state page when the pair did not earn its own, so no
    link on this site can ever point at a page that was not written.
    """
    st_ = state_by_id[state_id]
    if (state_id, species) in set(published_pairs):
        return f"/states/{slugify(st_['name'])}/{slugify(species)}.html"
    return f"/states/{slugify(st_['name'])}.html"

print(f"{len(published_pairs)} state x species pairs earned a page "
      f"(of {len(set(pair_seasons) | set(pair_windows))} with any data)")

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
        rows += (f"<tr><td class=sp>{s['species']['name']}</td>"
                 f"<td>{detail((s.get('method') or '').capitalize(), s.get('label') or '', zone)}</td>"
                 f"<td>{fmt(s['open_date'])} – {fmt(s['close_date'])}</td></tr>\n")

    wrows = ""
    # Michigan carries "Pure Michigan Hunt Drawing", "... (2027 licenses)" and
    # "... (2027 season licenses)" as three rows closing the same day. They are
    # one deadline written down three times, and printed in a row they read as
    # three things to apply for. Key on what a reader is being told to do:
    # this species, this closing date.
    seen_windows = set()
    for w in ws:
        key = ((w.get("species") or {}).get("name"), w.get("closes_at"))
        if key in seen_windows:
            continue
        seen_windows.add(key)
        res = f" · results {fmt(w['results_expected_at'])}" if w.get("results_expected_at") else ""
        closes = fmt(w["closes_at"]) if w["closes_at"] else "see agency portal"
        wrows += (f"<tr><td class=sp>{w['species']['name']}</td><td>{w.get('name') or 'Draw'}</td>"
                  f"<td>{closes}{res}</td></tr>\n")

    modified, verified_phrase = verified_on(newest)

    season_block = (
        f"<h2>Season dates</h2>\n<table><tr><th>Species</th><th>Season</th><th>Dates</th></tr>\n{rows}</table>"
        f"<p class=stamp>Data {verified_phrase} against official {st['agency_name'] or 'state agency'} sources.</p>"
        if rows else
        "<h2>Season dates</h2><p>Current-season dates for this state are being verified against official "
        "agency sources — check back soon, or confirm directly with the agency below.</p>")

    window_block = (
        f"<h2>Draw &amp; application deadlines</h2>\n<table><tr><th>Species</th><th>Draw</th><th>Apply by</th></tr>\n{wrows}</table>"
        if wrows else "")

    agency_block = ""
    if st["license_url"] and st["code"] not in dead_links:
        agency_block = (f"<h2>Licenses &amp; official source</h2>"
                        f"<p>Buy licenses and apply for draws through the official portal: "
                        f"<a href=\"{st['license_url']}\" rel=\"nofollow\">{st['agency_name'] or st['name']}</a>.</p>")

    # Nearby states, by land border. Built from the state list actually being
    # published, so a state going inactive cannot leave a link to a page that
    # was never written.
    neighbours = [n for n in (ADJACENT.get(st["code"]) or []) if n in name_by_code]
    nearby_block = ""
    if neighbours:
        items_near = "".join(
            f'<li><a href="{slugify(name_by_code[n])}.html">{name_by_code[n]}</a></li>'
            for n in neighbours)
        nearby_block = (
            f'<div class="nearby"><h2>Nearby states</h2>'
            f'<p class="meta">Season dates for states bordering {st["name"]}.</p>'
            f'<ul>{items_near}</ul></div>')

    # Links down to this state's own species pages. Without these the species
    # pages are orphans: in the sitemap, reachable by nobody, which is the exact
    # mistake that left fifty state pages with one of them indexed.
    species_block = ""
    _mine = sorted(pairs_by_state.get(st["id"], []))
    if _mine:
        _items = "".join(
            f'<li><a href="{slugify(st["name"])}/{slugify(sp)}.html">{esc(sp)}</a></li>'
            for sp in _mine)
        species_block = (
            f'<div class="nearby"><h2>Dates by species</h2>'
            f'<p class="meta">Every season, zone and method for the species '
            f'{st["name"]} publishes in detail'
            + (", with their application deadlines." if any(
                pair_windows.get((st["id"], sp)) for sp in _mine) else ".")
            + f'</p><ul>{_items}</ul></div>')

    # Say "draw deadlines" only on the pages that have them.
    #
    # All fifty titles promised "Dates & Draw Deadlines" while only eight
    # states had a single upcoming application window between them -- the rest
    # of the data has not been published by the agencies yet. A title that
    # promises what the page does not contain is the specific thing Google
    # treats as a mismatch, and a reader who came for Colorado's elk deadline
    # and found a season table learns not to come back.
    has_draws = bool(wrows)
    title = (f"{st['name']} Hunting Seasons 2026-27 — Dates & Draw Deadlines" if has_draws
             else f"{st['name']} Hunting Season Dates 2026-27")
    desc = (f"{st['name']} hunting season dates and draw deadlines for 2026-27, verified against official "
            f"{st['agency_name'] or 'state agency'} sources. Openers, closures, and application dates by species."
            if has_draws else
            f"{st['name']} hunting season dates for 2026-27, verified against official "
            f"{st['agency_name'] or 'state agency'} sources. Opening and closing dates by species and zone.")
    subtitle = ("Season dates and draw deadlines, compiled from official "
                f"{st['agency_name'] or 'state agency'} sources." if has_draws else
                f"Season dates by species and zone, compiled from official "
                f"{st['agency_name'] or 'state agency'} sources.")
    body = f"""
<header>
  <p class="brand"><a href="{SITE}">OPEN SEASON</a> · <a href="index.html">STATES</a></p>
  <h1>{st['name']} hunting seasons 2026–27</h1>
  <p class="meta">{subtitle}</p>
</header>
{season_block}
{window_block}
{species_block}
{CTA}
{agency_block}
{nearby_block}
"""
    crumbs = [("Open Season", f"{SITE}/"),
              ("Hunting seasons by state", f"{SITE}/states/"),
              (f"{st['name']}", f"{SITE}/states/{slug}.html")]
    with open(os.path.join(OUT, f"{slug}.html"), "w", encoding="utf-8", newline="\n") as f:
        f.write(page(title, desc, f"{SITE}/states/{slug}.html", body,
                     modified=modified, crumbs=crumbs))
    links.append((st["name"], slug, len(ss), len(ws), modified))
    print(f"  {st['code']}: {len(ss)} seasons, {len(ws)} draws -> states/{slug}.html")

# ---------------------------------------------------------------------------
# States index
items = "\n".join(
    f'<tr><td class=sp><a href="{slug}.html">{name}</a></td><td>{ns} season dates</td><td>{nw} draws</td></tr>'
    for name, slug, ns, nw, _mod in links)
idx_body = f"""
<header>
  <p class="brand"><a href="{SITE}">OPEN SEASON</a>
  &middot; <a href="/species/">BY SPECIES</a>
  &middot; <a href="/draw-deadlines.html">DRAW DEADLINES</a></p>
  <h1>Hunting seasons by state, 2026–27</h1>
  <p class="meta">Current season dates and draw deadlines for all 50 states, verified against official agency sources.</p>
</header>
<table><tr><th>State</th><th>Seasons</th><th>Draws</th></tr>
{items}
</table>
{CTA}
"""
newest_overall = max((m for _, _, _, _, m in links if m), default="")
with open(os.path.join(OUT, "index.html"), "w", encoding="utf-8", newline="\n") as f:
    f.write(page("Hunting Seasons by State 2026-27 — Open Season",
                 "Hunting season dates and draw deadlines for all 50 states, verified against official sources.",
                 f"{SITE}/states/", idx_body,
                 modified=newest_overall,
                 crumbs=[("Open Season", f"{SITE}/"),
                         ("Hunting seasons by state", f"{SITE}/states/")]))

# ---------------------------------------------------------------------------
# State x species pages: "colorado elk season dates", one page at a time.
#
# This is the volume tier, and the reason to have a website at all. Nobody
# searches "Colorado hunting seasons"; they search for one animal in one state,
# and until now the answer to that query was a single row buried in a fifty-row
# table. These pages answer the question that was actually asked.
SPECIES_OUT = os.path.join(HERE, "..", "docs", "site", "species")
os.makedirs(SPECIES_OUT, exist_ok=True)

code_to_state = {s["code"]: s for s in states}


def sp_title(name):
    """Title-case a stored species name for use in a page title.

    "Wild turkey" -> "Wild Turkey", "Ring-necked pheasant" -> "Ring-Necked
    Pheasant". Uppercases a letter only where one belongs -- at the start, after
    a space, after a hyphen -- so an apostrophe inside a name survives, which
    str.title() does not manage ("Cooper's" becomes "Cooper'S").
    """
    return re.sub(r"(^|[\s-])([a-z])",
                  lambda m: m.group(1) + m.group(2).upper(), name)


def window_status(w):
    """Closed / Not yet open / Open now, for an application window.

    Same reason the seasons table has one: these pages carry the whole cycle, so
    a deadline that has already passed is on the page, and a date printed under
    "Apply by" with nothing marking it closed reads as something a hunter can
    still do.
    """
    if w.get("closes_at") and w["closes_at"] < TODAY:
        return "Closed"
    if w.get("opens_at") and w["opens_at"] > TODAY:
        return "Not yet open"
    return "Open now"


def season_status(s):
    """Open now / Upcoming / Closed.

    The status column is what lets these pages carry a whole cycle instead of
    only the part still ahead of today. "Closed" is information: somebody
    searching in January for a season that shut in December needs to be told
    so, not shown a blank page where the answer used to be.
    """
    if s["close_date"] and s["close_date"] < TODAY:
        return "Closed"
    if s["open_date"] and s["open_date"] > TODAY:
        return "Upcoming"
    return "Open now"


# A species hub is worth writing when the animal spans enough states that the
# cross-state table IS the content. Note this bar is about breadth, not depth:
# coyote is one row in each of 49 states, which makes a poor per-state page and
# an excellent "coyote season dates by state" table. The two tiers fail in
# opposite directions, so they get opposite tests.
MIN_STATES_FOR_HUB = 5
species_states = {}
for (_sid, _sp) in set(pair_seasons) | set(pair_windows):
    species_states.setdefault(_sp, set()).add(_sid)
hub_species = sorted(sp for sp, sids in species_states.items()
                     if len(sids) >= MIN_STATES_FOR_HUB)
hub_set = set(hub_species)

pair_urls = []
for (sid, sp) in published_pairs:
    st = state_by_id[sid]
    st_slug, sp_slug = slugify(st["name"]), slugify(sp)
    os.makedirs(os.path.join(OUT, st_slug), exist_ok=True)

    ss = sorted(pair_seasons.get((sid, sp), []),
                key=lambda r: (r["open_date"] or "9999", r["id"]))
    ws = sorted(pair_windows.get((sid, sp), []),
                key=lambda r: (r["closes_at"] or "9999", r["id"]))
    newest = max((x["last_verified_at"] or "" for x in ss + ws), default="")
    modified, verified_phrase = verified_on(newest)

    rows = ""
    for s in ss:
        zone = s["zone"]["name"] if s.get("zone") else ""
        zone = "" if zone == "Statewide" else zone
        what = detail((s.get("method") or "").capitalize(),
                      s.get("label") or "", zone) or "General season"
        rows += ("<tr><td class=sp>" + esc(what) + "</td><td>"
                 + fmt(s["open_date"]) + " " + EN + " " + fmt(s["close_date"])
                 + "</td><td>" + season_status(s) + "</td></tr>" + NL)
    season_block = ""
    if rows:
        season_block = (
            "<h2>" + esc(sp) + " season dates</h2>"
            "<table><tr><th>Season</th><th>Dates</th><th>Status</th></tr>" + NL
            + rows + "</table><p class=stamp>Data " + verified_phrase
            + " against official "
            + esc(st["agency_name"] or "state agency") + " sources.</p>")

    wrows, seen = "", set()
    for w in ws:
        key = (w.get("name"), w.get("closes_at"))
        if key in seen:
            continue
        seen.add(key)
        res = fmt(w["results_expected_at"]) if w.get("results_expected_at") else "not published"
        opens = fmt(w["opens_at"]) if w.get("opens_at") else "see agency portal"
        closes = fmt(w["closes_at"]) if w.get("closes_at") else "see agency portal"
        wrows += ("<tr><td class=sp>" + esc(w.get("name") or "Draw") + "</td><td>"
                  + opens + "</td><td>" + closes + "</td><td>" + res
                  + "</td><td>" + window_status(w) + "</td></tr>" + NL)
    window_block = ""
    if wrows:
        window_block = (
            "<h2>Draw &amp; application deadlines</h2>"
            "<table><tr><th>Draw</th><th>Opens</th><th>Apply by</th>"
            "<th>Results</th><th>Status</th></tr>" + NL + wrows + "</table>")

    # Same animal, next state over. This is the link a hunter who did not draw
    # actually wants, and it is also what ties these pages into one crawlable
    # web instead of several hundred leaves hanging off fifty twigs.
    near = [n for n in (ADJACENT.get(st["code"]) or [])
            if n in code_to_state
            and code_to_state[n]["id"] in species_states.get(sp, set())]
    near_block = ""
    if near:
        items_n = "".join(
            '<li><a href="' + pair_url(code_to_state[n]["id"], sp) + '">'
            + esc(name_by_code[n]) + "</a></li>" for n in near)
        near_block = ('<div class="nearby"><h2>' + esc(sp)
                      + " in nearby states</h2><p class=\"meta\">Season dates for "
                      + esc(sp.lower()) + " in states bordering "
                      + esc(st["name"]) + ".</p><ul>" + items_n + "</ul></div>")

    others = [o for o in sorted(pairs_by_state.get(sid, [])) if o != sp]
    other_block = ""
    if others:
        items_o = "".join('<li><a href="' + slugify(o) + '.html">' + esc(o)
                          + "</a></li>" for o in others)
        other_block = ('<div class="nearby"><h2>Other species in '
                       + esc(st["name"]) + "</h2><ul>" + items_o + "</ul></div>")

    hub_link = ""
    if sp in hub_set:
        hub_link = (' &middot; <a href="/species/' + sp_slug + '.html">'
                    + esc(sp.upper()) + "</a>")

    agency_block = ""
    if st["license_url"] and st["code"] not in dead_links:
        agency_block = (
            "<h2>Licenses &amp; official source</h2><p>Buy licenses and apply "
            'for draws through the official portal: <a href="'
            + st["license_url"] + '" rel="nofollow">'
            + esc(st["agency_name"] or st["name"]) + "</a>.</p>")

    # Promise exactly what is on the page. A pair can earn a page on its draw
    # window alone (that is the whole point of the content bar), and when it
    # does there are no season dates here to promise.
    has_draws = bool(wrows)
    has_seasons = bool(rows)
    sp_t = sp_title(sp)
    agency = st["agency_name"] or "state agency"
    if has_seasons and has_draws:
        title = st["name"] + " " + sp_t + " Season Dates & Draw Deadlines 2026-27"
        desc = (sp_t + " season dates and draw application deadlines in "
                + st["name"] + " for 2026-27, by zone and method, verified "
                "against official " + agency + " sources.")
    elif has_seasons:
        title = st["name"] + " " + sp_t + " Season Dates 2026-27"
        desc = (sp_t + " season dates in " + st["name"] + " for 2026-27, by zone "
                "and method, verified against official " + agency + " sources.")
    else:
        title = st["name"] + " " + sp_t + " Draw Application Deadlines 2026-27"
        desc = (sp_t + " draw and limited-entry application deadlines in "
                + st["name"] + " for 2026-27, verified against official "
                + agency + " sources.")

    body = (NL
            + '<header>' + NL
            + '  <p class="brand"><a href="' + SITE + '">OPEN SEASON</a>'
            + ' &middot; <a href="/states/">STATES</a>'
            + ' &middot; <a href="/states/' + st_slug + '.html">'
            + esc(st["name"].upper()) + "</a>" + hub_link + "</p>" + NL
            + "  <h1>" + esc(st["name"]) + " " + esc(sp.lower())
            + " seasons 2026" + EN + "27</h1>" + NL
            + '  <p class="meta">' + ("Every published " + esc(sp.lower())
               + " season in " + esc(st["name"]) + " " + EN
               + " dates, zones and methods" if has_seasons else
               esc(sp_title(sp)) + " draw and limited-entry application "
               + "deadlines in " + esc(st["name"]))
            + " " + EN + " compiled from official "
            + esc(agency) + " sources.</p>" + NL
            + "</header>" + NL
            + season_block + NL + window_block + NL + CTA + NL
            + agency_block + NL + near_block + NL + other_block + NL)

    url = SITE + "/states/" + st_slug + "/" + sp_slug + ".html"
    crumbs = [("Open Season", SITE + "/"),
              ("Hunting seasons by state", SITE + "/states/"),
              (st["name"], SITE + "/states/" + st_slug + ".html"),
              (sp, url)]
    with open(os.path.join(OUT, st_slug, sp_slug + ".html"), "w",
              encoding="utf-8", newline=NL) as f:
        f.write(page(title, desc, url, body, modified=modified, crumbs=crumbs))
    pair_urls.append((url, modified))

print(f"  {len(pair_urls)} state x species pages")

# ---------------------------------------------------------------------------
# Species hubs: "deer season dates by state".
#
# The query nobody can currently answer in one place. Fifty agencies publish
# fifty PDFs; this is the table. It is also the spine of the internal link
# graph -- every hub links every state that has the animal, so a crawler
# arriving anywhere can reach everything.
hub_urls = []
for sp in hub_species:
    sp_slug = slugify(sp)
    sids = species_states[sp]
    rows, newest = "", ""
    for st in states:
        if st["id"] not in sids:
            continue
        ss = pair_seasons.get((st["id"], sp), [])
        ws = pair_windows.get((st["id"], sp), [])
        newest = max([newest] + [x["last_verified_at"] or "" for x in ss + ws])
        opens = [s["open_date"] for s in ss if s["open_date"]]
        closes = [s["close_date"] for s in ss if s["close_date"]]
        span = (fmt(min(opens)) + " " + EN + " " + fmt(max(closes))
                if opens and closes else "see page")
        # The earliest deadline still OPEN. Taking the minimum over the whole
        # cycle put a date from last spring in a column headed "Apply by".
        dls = [w["closes_at"] for w in ws
               if w.get("closes_at") and w["closes_at"] >= TODAY]
        rows += ('<tr><td class=sp><a href="' + pair_url(st["id"], sp) + '">'
                 + esc(st["name"]) + "</a></td><td>" + str(len(ss)) + "</td><td>"
                 + span + "</td><td>" + (fmt(min(dls)) if dls else EM)
                 + "</td></tr>" + NL)

    modified, verified_phrase = verified_on(newest)
    sp_t = sp[:1].upper() + sp[1:]
    n_states = len(sids)
    body = (NL
            + '<header>' + NL
            + '  <p class="brand"><a href="' + SITE + '">OPEN SEASON</a>'
            + ' &middot; <a href="/species/">SPECIES</a>'
            + ' &middot; <a href="/draw-deadlines.html">DRAW DEADLINES</a></p>' + NL
            + "  <h1>" + esc(sp_t) + " season dates by state, 2026" + EN + "27</h1>" + NL
            + '  <p class="meta">' + esc(sp_t) + " seasons in " + str(n_states)
            + " states " + EN + " opening and closing dates, and application "
            "deadlines where the state runs a draw.</p>" + NL
            + "</header>" + NL
            + "<table><tr><th>State</th><th>Seasons</th><th>Season span</th>"
            + "<th>Apply by</th></tr>" + NL + rows + "</table>"
            + "<p class=stamp>Data " + verified_phrase
            + " against official state agency sources. "
            "Season span is the earliest opener to the latest close across all "
            "zones and methods; open the state for the full breakdown.</p>"
            + CTA)
    url = SITE + "/species/" + sp_slug + ".html"
    with open(os.path.join(SPECIES_OUT, sp_slug + ".html"), "w",
              encoding="utf-8", newline=NL) as f:
        f.write(page(
            sp_t + " Season Dates by State 2026-27",
            sp_t + " hunting season dates for " + str(n_states) + " states, "
            "2026-27, with draw application deadlines, verified against "
            "official state agency sources.",
            url, body, modified=modified,
            crumbs=[("Open Season", SITE + "/"),
                    ("Species", SITE + "/species/"),
                    (sp_t, url)]))
    hub_urls.append((url, modified))

newest_hub = max((m for _u, m in hub_urls if m), default="")
items = "".join(
    '<tr><td class=sp><a href="' + slugify(sp) + '.html">' + esc(sp)
    + "</a></td><td>" + str(len(species_states[sp])) + " states</td></tr>"
    for sp in hub_species)
with open(os.path.join(SPECIES_OUT, "index.html"), "w",
          encoding="utf-8", newline=NL) as f:
    f.write(page(
        "Hunting Season Dates by Species 2026-27",
        "Hunting season dates by species across all 50 states for 2026-27, "
        "with draw deadlines, verified against official agency sources.",
        SITE + "/species/",
        NL + '<header><p class="brand"><a href="' + SITE + '">OPEN SEASON</a>'
        + ' &middot; <a href="/states/">BY STATE</a>'
        + ' &middot; <a href="/draw-deadlines.html">DRAW DEADLINES</a></p>'
        + "<h1>Season dates by species, 2026" + EN + "27</h1>"
        + '<p class="meta">Every species we track, with the states that publish '
        "a season for it.</p></header>"
        + "<table><tr><th>Species</th><th>Coverage</th></tr>" + NL + items
        + "</table>" + CTA,
        modified=newest_hub,
        crumbs=[("Open Season", SITE + "/"), ("Species", SITE + "/species/")]))
print(f"  {len(hub_urls)} species hubs + species/index.html")

# ---------------------------------------------------------------------------
# One draw-deadline page, sorted by what closes soonest.
#
# Fifty thin per-state draw pages would be doorway pages; this is the opposite
# bet, and it is the page this whole site is for. January to April is when
# hunters decide where to apply, and the question is never "what are Colorado's
# deadlines" -- it is "what closes next, anywhere". Nobody publishes that.
upcoming, seen = [], set()
for w in sorted(windows, key=lambda r: (r["closes_at"] or "9999", r["id"])):
    if w.get("closes_at") and w["closes_at"] < TODAY:
        continue
    sp_nm = (w.get("species") or {}).get("name") or ""
    key = (w["state_id"], sp_nm, w.get("closes_at"))
    if key in seen:
        continue
    seen.add(key)
    upcoming.append(w)

drows, newest = "", ""
for w in upcoming:
    st = state_by_id.get(w["state_id"])
    if not st:
        continue
    sp_nm = (w.get("species") or {}).get("name") or ""
    newest = max(newest, w["last_verified_at"] or "")
    res = fmt(w["results_expected_at"]) if w.get("results_expected_at") else EM
    link = pair_url(st["id"], sp_nm) if sp_nm else ("/states/" + slugify(st["name"]) + ".html")
    drows += ("<tr><td class=sp>"
              + (fmt(w["closes_at"]) if w.get("closes_at") else "see portal")
              + '</td><td><a href="' + link + '">' + esc(st["name"]) + "</a></td><td>"
              + esc(sp_nm or EM) + "</td><td>" + esc(w.get("name") or "Draw")
              + "</td><td>" + res + "</td></tr>" + NL)

modified, verified_phrase = verified_on(newest)
if drows:
    intro = ("Every hunting draw and limited-entry application deadline still "
             "open, across all 50 states, soonest first.")
    table = ("<table><tr><th>Apply by</th><th>State</th><th>Species</th>"
             "<th>Draw</th><th>Results</th></tr>" + NL + drows + "</table>"
             + "<p class=stamp>Data " + verified_phrase
             + " against official state agency sources.</p>")
else:
    intro = ("No application windows are currently open. Most states publish "
             "the next cycle's deadlines between December and February.")
    table = ""
with open(os.path.join(HERE, "..", "docs", "site", "draw-deadlines.html"), "w",
          encoding="utf-8", newline=NL) as f:
    f.write(page(
        "Hunting Draw Deadlines 2027 " + EM + " Every State, Soonest First",
        "Every open hunting draw and limited-entry application deadline in the "
        "United States, sorted by closing date and verified against official "
        "state agency sources.",
        SITE + "/draw-deadlines.html",
        NL + '<header><p class="brand"><a href="' + SITE + '">OPEN SEASON</a>'
        + ' &middot; <a href="/states/">BY STATE</a>'
        + ' &middot; <a href="/species/">BY SPECIES</a></p>'
        + "<h1>Hunting draw deadlines, every state</h1>"
        + '<p class="meta">' + intro + "</p></header>" + table + CTA,
        modified=modified,
        crumbs=[("Open Season", SITE + "/"),
                ("Draw deadlines", SITE + "/draw-deadlines.html")]))
print(f"  draw-deadlines.html ({len(upcoming)} open windows)")

# ---------------------------------------------------------------------------
# Sitemap
#
# Every URL carries <lastmod>, taken from the newest last_verified_at on the
# page itself. Fifty-two URLs went up with no freshness signal at all, and a
# crawler with no reason to think a page changed has no reason to come back.
#
# lastmod is the date the DATA was last verified, not the date this script ran.
# Stamping today on every page every Monday would claim changes that did not
# happen, and a lastmod that always lies gets ignored.
entries = [(SITE + "/", newest_overall), (SITE + "/states/", newest_overall)]
entries += [(SITE + "/states/" + slug + ".html", mod)
            for _n, slug, _ns, _nw, mod in links]
entries += [(SITE + "/species/", newest_hub)]
entries += hub_urls
entries += pair_urls
entries += [(SITE + "/draw-deadlines.html", modified)]

sitemap = ('<?xml version="1.0" encoding="UTF-8"?>' + NL
           + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + NL)
sitemap += NL.join(
    "  <url><loc>" + u + "</loc>"
    + ("<lastmod>" + m + "</lastmod>" if m else "") + "</url>"
    for u, m in entries)
sitemap += NL + "</urlset>" + NL
with open(os.path.join(OUT, "..", "sitemap.xml"), "w",
          encoding="utf-8", newline=NL) as f:
    f.write(sitemap)

print(f"done: {len(links)} state pages, {len(pair_urls)} species pages, "
      f"{len(hub_urls)} hubs, 1 draw page {EM} {len(entries)} URLs in sitemap")
