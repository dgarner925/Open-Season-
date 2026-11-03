"""Coverage audit, both directions.

1. Every followable (state, species) pair should have at least one
   current-or-upcoming season row — otherwise a follower sees "No dates yet".
   This is the check that would have caught the FL/AL alligator hole: the state
   row-counts looked healthy while individual species sat empty.

2. Every season row and draw window should belong to a followable pair. A pair
   missing from state_species hides every row behind it, and check 1 cannot see
   that because it only walks pairs that already exist. Nine published Kentucky
   bear seasons sat unreachable this way.

Usage:
    python scripts/audit_coverage.py            # full report
    python scripts/audit_coverage.py --summary  # per-species totals only

Reads EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY from .env (anon key sees published
rows only, which is exactly what app users see). Exits 1 if any gaps found, so
it can gate publishes like check_links.py does.
"""
import json
import sys
import urllib.request
from datetime import date

env = {}
for line in open('.env'):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        env[k] = v
URL = env['EXPO_PUBLIC_SUPABASE_URL']
KEY = env['EXPO_PUBLIC_SUPABASE_ANON_KEY']


def get(path):
    req = urllib.request.Request(URL + path, headers={'apikey': KEY, 'Authorization': 'Bearer ' + KEY})
    return json.load(urllib.request.urlopen(req))


def get_all(path_base):
    """Paginate past PostgREST's row cap."""
    out, offset, page = [], 0, 1000
    while True:
        sep = '&' if '?' in path_base else '?'
        rows = get(f'{path_base}{sep}limit={page}&offset={offset}')
        out.extend(rows)
        if len(rows) < page:
            return out
        offset += page


def main():
    summary_only = '--summary' in sys.argv
    today = date.today().isoformat()

    states = {s['id']: s['code'] for s in get_all('/rest/v1/states?select=id,code')}
    species = {s['id']: s['key'] for s in get_all('/rest/v1/species?select=id,key')}
    pairs = get_all('/rest/v1/state_species?select=state_id,species_id')

    # A pair is COVERED if any published season is current or upcoming
    # (close_date in the future, or open-ended with a future open_date).
    seasons = get_all(
        f'/rest/v1/seasons?select=state_id,species_id&or=(close_date.gte.{today},open_date.gte.{today})'
    )
    covered = {(r['state_id'], r['species_id']) for r in seasons}
    # Draw windows also count as "has dates" for a followable pair.
    windows = get_all(
        f'/rest/v1/application_windows?select=state_id,species_id&closes_at=gte.{today}'
    )
    covered |= {(r['state_id'], r['species_id']) for r in windows}

    gaps = []
    for p in pairs:
        key = (p['state_id'], p['species_id'])
        if key not in covered:
            gaps.append((states.get(p['state_id'], '??'), species.get(p['species_id'], '??')))

    # The inverse question, which the gap count structurally cannot ask: dates
    # we HOLD for a pair that is not followable. state_species decides whether a
    # species appears for a state at all, so a missing pair hides every row
    # behind it — and because this loop only walks pairs that already exist, a
    # state that gains a species is invisible to the audit forever.
    #
    # Found 2026-11-02: Kentucky had nine published bear seasons, one of them
    # opening Dec 12, that no user could reach. Florida had gained a bear hunt
    # in Dec 2025 that the July matrix predated. Fifteen of the 26 orphaned
    # rows were bear alone.
    # Unfiltered on purpose: a hidden pair is hidden whether or not its dates
    # have run out. SC's bear seasons closed on Oct 30 and still need the
    # mapping, so next year's dates land somewhere a user can see them.
    pair_set = {(p['state_id'], p['species_id']) for p in pairs}
    all_rows = [(r, 'season') for r in get_all('/rest/v1/seasons?select=state_id,species_id')]
    all_rows += [(r, 'window') for r in get_all('/rest/v1/application_windows?select=state_id,species_id')]
    orphans = {}
    for row, kind in all_rows:
        key = (row['state_id'], row['species_id'])
        if key not in pair_set:
            label = (states.get(key[0], '??'), species.get(key[1], '??'))
            orphans.setdefault(label, []).append(kind)

    total_pairs = len(pairs)
    print(f'followable pairs: {total_pairs} | covered: {total_pairs - len(gaps)} | GAPS: {len(gaps)}')
    print(f'orphaned rows (dates we hold but hide): {sum(len(v) for v in orphans.values())} '
          f'in {len(orphans)} pairs')

    if orphans:
        print('\nOrphaned - the pair is missing from state_species:')
        for (st, sp), kinds in sorted(orphans.items()):
            counts = f'{kinds.count("season")} seasons, {kinds.count("window")} windows'
            print(f'  {st} {sp:20} {counts}')

    if gaps:
        by_species = {}
        for st, sp in gaps:
            by_species.setdefault(sp, []).append(st)
        print('\nGaps by species (worst first):')
        for sp, sts in sorted(by_species.items(), key=lambda kv: -len(kv[1])):
            if summary_only:
                print(f'  {sp:20} {len(sts):3} states')
            else:
                print(f'  {sp:20} {len(sts):3} states: {" ".join(sorted(sts))}')

    if gaps or orphans:
        sys.exit(1)
    print('all followable pairs have current or upcoming dates, and nothing is hidden')


if __name__ == '__main__':
    main()
