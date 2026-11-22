"""Water audit: find one regulated stretch entered under two names.

The failure this catches. Georgia was transcribed by more than one pass, with
different conventions, and ten stretches were caught by two of them. The screen
then showed one river twice -- "Chattooga River" and "Chattooga River (delayed
harvest)", same reach, same species, same restrictions -- and the second card
omitted "May not be taken" because that pass wrote daily_limit_kind='unknown'
on catch-and-release water. Merged in migration 20261210000000; three more
(Ocmulgee, Oconee, Savannah) in 20261211000000.

WHY FOUR DETECTORS WERE NEEDED, which is the part worth keeping:

  base name       Flags "Flint River" against "Flint River downstream of
                  Warwick Dam" -- a river and a genuine sub-reach of it. This
                  is the method that produced my first, wrong, report of
                  "8 duplicate pairs". A shared name is not evidence; two
                  rows are the same water when they describe the same STRETCH.

  exact extent    Misses "...GA Hwy 53." against "...GA Hwy 53": normalising
                  punctuation to spaces leaves a trailing space on the copy
                  that ended in a period. btrim() recovers those, and the
                  group count goes 3 -> 9. Still blind to a pair differing by
                  one word.

  substring       Misses the Ocmulgee: "downstream of THE GA Hwy 96 bridge
                  between Houston and Twiggs counties" against "Ocmulgee River
                  downstream of GA Hwy 96 bridge between Houston and Twiggs
                  counties". Neither string contains the other.

  token overlap   What this script uses. Two descriptions of one stretch share
                  almost every meaningful word, whatever the order, case,
                  or articles. Stop words are dropped so "the" cannot decide
                  anything.

AND WHY TOKEN OVERLAP ALONE IS STILL NOT ENOUGH. Containment is scored apart
from Jaccard, because the commonest shape here is a child extent that is the
parent's extent plus the river's name, and plain Jaccard penalises it for
those extra tokens. But containment on its own has a false positive that
would have destroyed a regulation:

    Smith Creek (downstream of Unicoi dam)   "downstream of Unicoi dam"
    Smith Creek (Unicoi State Park)          "from Unicoi Dam downstream to
                                              the Unicoi State Park property
                                              boundary"

  Containment is 1.00 -- every word of the first is in the second -- but the
  first extent is UNBOUNDED and the second stops at the park boundary, and
  their rules differ (daylight-only versus catch-and-release). Jaccard is
  0.43, which is what saves it. A short vague extent sits inside a long
  specific one without being the same water.

So a pair is reported as SAME-STRETCH only on high Jaccard, or on high
containment *backed by* identical species and limits. Everything else is
printed as REVIEW and left to a person.

Usage:
    python scripts/audit_duplicate_waters.py          # report
    python scripts/audit_duplicate_waters.py --slugs  # just the slugs

Reads EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY from .env, so it sees published
rows only -- exactly what app users see. Exits 1 if any SAME-STRETCH pair
survives, so it can gate a deploy.
"""
import json
import re
import sys
import urllib.parse
import urllib.request

env = {}
for line in open('.env'):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        env[k] = v
URL = env['EXPO_PUBLIC_SUPABASE_URL']
KEY = env['EXPO_PUBLIC_SUPABASE_ANON_KEY']

# Articles and prepositions carry no information about WHICH stretch is meant,
# and they are exactly what the two passes disagreed about.
STOP = {'the', 'a', 'an', 'and', 'of', 'to', 'from', 'at', 'on', 'in', 'its',
        'all', 'is', 'are', 'between', 'this', 'these', 'other'}

JACCARD_SURE = 0.70
CONTAIN_SURE = 0.90


def get(path):
    url = f'{URL}/rest/v1/{path}'
    req = urllib.request.Request(url, headers={'apikey': KEY,
                                               'Authorization': 'Bearer ' + KEY})
    return json.load(urllib.request.urlopen(req))


def fetch(table, select, extra=''):
    out, offset = [], 0
    while True:
        rows = get(f'{table}?select={urllib.parse.quote(select, safe=",:()*")}'
                   f'&order=id&limit=1000&offset={offset}{extra}')
        out.extend(rows)
        if len(rows) < 1000:
            return out
        offset += 1000


def tokens(text):
    words = re.sub(r'[^a-z0-9]+', ' ', (text or '').lower()).split()
    return {w for w in words if w not in STOP}


def base(name):
    return name.split('(')[0].strip().lower()


def related(a, b):
    """Only compare rows that plausibly name the same body of water.

    Without this every pair of trout streams carrying "and its tributaries on
    the Warwoman WMA" is a candidate, and those are two different creeks.
    """
    if b['parent_water_id'] == a['id'] or a['parent_water_id'] == b['id']:
        return True
    if base(a['name']) == base(b['name']):
        return True
    return (b['name'].lower().startswith(base(a['name']))
            or a['name'].lower().startswith(base(b['name'])))


def main():
    slugs_only = '--slugs' in sys.argv

    waters = fetch('waters', 'id,name,slug,state_id,extent_note,parent_water_id,status',
                   '&status=eq.published')
    rules = fetch('fishing_rules',
                  'id,water_id,daily_limit_kind,daily_limit,limit_basis,restrictions,status',
                  '&status=eq.published')
    links = get('fishing_rule_species?select=rule_id,species_id&limit=10000')
    species = {s['id']: s['name'] for s in get('species?select=id,name&limit=2000')}
    states = {s['id']: s['code'] for s in get('states?select=id,code&limit=200')}

    names_by_rule = {}
    for ln in links:
        names_by_rule.setdefault(ln['rule_id'], set()).add(
            species.get(ln['species_id'], '?'))

    # One signature per water: what it actually says, species and limits
    # together. Two rows that say the same thing about the same stretch are
    # the same water.
    sig = {}
    for r in rules:
        s = sig.setdefault(r['water_id'], set())
        s.add((
            ','.join(sorted(names_by_rule.get(r['id'], ()))),
            r['daily_limit_kind'], str(r['daily_limit']), r['limit_basis'],
            ','.join(sorted(r.get('restrictions') or [])),
        ))

    rule_count = {}
    for r in rules:
        rule_count[r['water_id']] = rule_count.get(r['water_id'], 0) + 1

    by_state = {}
    for w in waters:
        by_state.setdefault(w['state_id'], []).append(w)

    sure, review = [], []
    for state_id, ws in by_state.items():
        for i in range(len(ws)):
            for j in range(i + 1, len(ws)):
                a, b = ws[i], ws[j]
                ta, tb = tokens(a['extent_note']), tokens(b['extent_note'])
                if not ta or not tb or not related(a, b):
                    continue

                inter = len(ta & tb)
                jaccard = inter / len(ta | tb)
                contain = inter / min(len(ta), len(tb))
                if jaccard < 0.5 and contain < CONTAIN_SURE:
                    continue

                same_rules = (sig.get(a['id']) == sig.get(b['id'])
                              and sig.get(a['id']) is not None)
                verdict = (jaccard >= JACCARD_SURE
                           or (contain >= CONTAIN_SURE and same_rules))

                entry = (states.get(state_id, '??'), jaccard, contain,
                         same_rules, a, b)
                (sure if verdict else review).append(entry)

    if slugs_only:
        for _, _, _, _, a, b in sure:
            print('%s\t%s' % (a['slug'], b['slug']))
        return 1 if sure else 0

    def show(entries, heading):
        if not entries:
            return
        print('\n%s\n%s' % (heading, '-' * len(heading)))
        for st, jac, con, same, a, b in sorted(entries, key=lambda e: (e[0], -e[1])):
            print('[%s] jaccard=%.2f containment=%.2f identical_rules=%s'
                  % (st, jac, con, same))
            for w in (a, b):
                print('   rules=%-2d %s' % (rule_count.get(w['id'], 0), w['name']))
                print('            {%s}' % w['slug'])
                print('            %s' % (w['extent_note'] or '(no extent)'))
            print()

    print('published waters audited: %d across %d states'
          % (len(waters), len(by_state)))
    show(sure, 'SAME STRETCH, ENTERED TWICE -- merge these')
    show(review, 'REVIEW BY HAND -- overlapping but not provably the same')

    if not sure and not review:
        print('\nNo duplicate stretches found.')
    print('\nsame-stretch pairs: %d   needs-review pairs: %d'
          % (len(sure), len(review)))
    print('\nA pair here is NOT merged by deleting whichever row you like.')
    print('Keep the row whose rule is more specific -- prohibited/0 beats')
    print('unknown on catch-and-release water -- and scope every statement by')
    print('state_id: waters.slug is not unique across states (chattooga-river')
    print('exists in GA and SC).')
    return 1 if sure else 0


if __name__ == '__main__':
    sys.exit(main())
