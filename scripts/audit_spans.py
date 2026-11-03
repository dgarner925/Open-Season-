"""Span audit: find season rows that report OPEN on days the season is SHUT.

A coverage audit asks whether a pair HAS dates. This asks whether the dates
are honest, which is the failure audit_coverage.py structurally cannot see:
Ohio passed coverage while telling goose hunters the season was open during a
twelve-day closure.

The pattern. An agency that splits a season prints a headline window above the
detail rows -- "Goose (3 splits)", "Dove (three splits)", "Two Segments",
"Split Season" -- and a faithful extraction transcribes both. The headline is
not a season. The only days it adds are the days the season is closed.

The test. Inside one (state, species, season_year, method) group AND the same
zone, a row whose earliest child opens on its open date and whose latest child
closes on its close date, with uncovered days in between, is a summary of those
children. Tiling BOTH ends is what makes it safe to act on:

  - A falconry season that spans the same gun segments but runs on past them
    does not tile, and survives. Virginia publishes it as its own season.
  - A different zone is never compared. Missouri's North Zone really does run
    longer than its Middle Zone.

Without those two rules the sweep flags 150 rows, nearly all of them legitimate.
With them it flagged 13, across five states, on 2026-11-02.

Usage:
    python scripts/audit_spans.py           # full report, live liars first
    python scripts/audit_spans.py --ids     # just the ids, for a migration

Reads EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY from .env (anon key sees published
rows only -- exactly what app users see). Exits 1 if anything is lying today.
"""
import json
import sys
import urllib.request
from datetime import date, timedelta

env = {}
for line in open('.env'):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        env[k] = v
URL = env['EXPO_PUBLIC_SUPABASE_URL']
KEY = env['EXPO_PUBLIC_SUPABASE_ANON_KEY']

SELECT = ('id,state_id,species_id,zone_id,season_year,method,label,open_date,close_date,'
          'state:state_id(code),species:species_id(key),zone:zone_id(name)')


def fetch_seasons():
    out, offset = [], 0
    while True:
        url = f'{URL}/rest/v1/seasons?select={SELECT}&order=id&limit=1000&offset={offset}'
        req = urllib.request.Request(url, headers={'apikey': KEY, 'Authorization': 'Bearer ' + KEY})
        rows = json.load(urllib.request.urlopen(req))
        out.extend(rows)
        if len(rows) < 1000:
            return out
        offset += 1000


def d(value):
    return date.fromisoformat(value) if value else None


def summaries(rows, today):
    """Rows that are a summary of their own splits, worst (lying now) first."""
    groups = {}
    for r in rows:
        o, c = d(r['open_date']), d(r['close_date'])
        if not o or not c or c < o:
            continue
        r['_o'], r['_c'] = o, c
        groups.setdefault((r['state_id'], r['species_id'], r['season_year'], r['method']), []).append(r)

    found = []
    for group in groups.values():
        for c in group:
            kids = [r for r in group
                    if r['id'] != c['id'] and r['zone_id'] == c['zone_id']
                    and r['_o'] >= c['_o'] and r['_c'] <= c['_c']
                    and (r['_c'] - r['_o']) < (c['_c'] - c['_o'])]
            if len(kids) < 2:
                continue
            if min(r['_o'] for r in kids) != c['_o'] or max(r['_c'] for r in kids) != c['_c']:
                continue  # does not tile both ends: a season in its own right
            covered = set()
            for r in kids:
                covered.update(r['_o'] + timedelta(days=i) for i in range((r['_c'] - r['_o']).days + 1))
            shut = [c['_o'] + timedelta(days=i) for i in range((c['_c'] - c['_o']).days + 1)
                    if c['_o'] + timedelta(days=i) not in covered and c['_o'] < c['_o'] + timedelta(days=i) < c['_c']]
            if not shut:
                continue
            runs, start, prev = [], shut[0], shut[0]
            for day in shut[1:]:
                if (day - prev).days > 1:
                    runs.append((start, prev))
                    start = day
                prev = day
            runs.append((start, prev))
            found.append((c, kids, runs, any(a <= today <= b for a, b in runs)))

    found.sort(key=lambda t: (not t[3], t[0]['state']['code'], t[0]['species']['key']))
    return found


def main():
    today = date.today()
    found = summaries(fetch_seasons(), today)
    live = [f for f in found if f[3]]

    if '--ids' in sys.argv:
        print('\n'.join(f"'{c['id']}'," for c, _, _, _ in found))
        return 1 if live else 0

    print(f'summary rows: {len(found)} | LYING RIGHT NOW: {len(live)}\n')
    for c, kids, runs, now in found:
        shut_days = sum((b - a).days + 1 for a, b in runs)
        flag = '>>> SAYS OPEN, IS SHUT  ' if now else '                        '
        zone = (c.get('zone') or {}).get('name')
        print(f"{flag}{c['state']['code']} {c['species']['key']} "
              f"[{c.get('label') or c['method']}] x {zone}")
        print(f"      {c['_o']} -> {c['_c']}, but its {len(kids)} splits leave "
              f"{shut_days} shut days: " + ', '.join(f'{a}..{b}' for a, b in runs))
        print(f"      id {c['id']}")
    return 1 if live else 0


if __name__ == '__main__':
    sys.exit(main())
