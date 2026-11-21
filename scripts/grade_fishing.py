#!/usr/bin/env python3
"""Grade the fishing extractor against the hand-checked Georgia rules.

There is no way to measure an extractor except against data a person checked.
Georgia was transcribed by hand from the agency pages before this extractor
existed, precisely so it could serve as that reference -- see the migration
20261122030000_georgia_freshwater.sql.

What this measures, and what it deliberately does not:

  RECALL      of the gold rules, how many did the extractor also find?
  PRECISION   of the rules it proposed, how many match a gold rule?
  CALIBRATION does its confidence actually predict correctness? A grader that
              scores wrong rows highly is worse than no grader, because the
              wrong rows are the ones that auto-approve.

A match is on the FACTS, not on wording: the species set, the water, and the
numbers. Two rules that say "10 black bass, aggregate, statewide" match even
if their notes differ, because the notes are prose and the numbers are the
rule. Comparing notes would measure the model's writing, not its reading.

Usage:
    python scripts/grade_fishing.py            # grade pending proposals
    python scripts/grade_fishing.py --state GA
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys

PROJECT = "soxglmgbhmpuxhngcsvx"


def query(sql: str) -> list[dict]:
    """Run a read-only query through the Supabase CLI."""
    out = subprocess.run(
        ["npx", "supabase", "db", "query", "--remote", "--read-only", sql],
        capture_output=True, text=True, shell=True,
    )
    blob = out.stdout + out.stderr
    m = re.search(r"\[.*\]", blob, re.S)
    if not m:
        sys.exit(f"could not read a result set from:\n{blob[:1500]}")
    return json.loads(m.group(0))


def num(v):
    """Compare numbers as numbers. '22.00' and 22 are the same size limit."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return str(v)
    return int(f) if f == int(f) else round(f, 2)


def key_of(row: dict) -> tuple:
    """The identity of a rule: what it is about and what it says.

    Water is compared by slug, so "Waters Creek" and "waters-creek" agree.
    Species is a frozenset, because a set of species has no order and an
    extractor that lists them differently has not made a mistake.
    """
    return (
        row.get("water_slug") or "",
        frozenset(row.get("species") or []),
        row.get("size_rule") or "none",
        num(row.get("min_length_inches")),
        num(row.get("max_length_inches")),
        row.get("daily_limit_kind") or "unknown",
        num(row.get("daily_limit")),
        num(row.get("trophy_allowance")),
        row.get("limit_basis") or "aggregate",
        frozenset(row.get("restrictions") or []),
        row.get("effective_from") or "",
        row.get("effective_to") or "",
    )


def describe(k: tuple) -> str:
    water, species, size_rule, mn, mx, dk, dl, tr, basis, restr, ef, et = k
    bits = []
    bits.append(water or "statewide")
    sp = sorted(species)
    bits.append(f"{len(sp)} species" if len(sp) > 3 else ", ".join(sp) or "no species")
    if dk == "count":
        bits.append(f"daily {dl}")
    elif dk != "unknown":
        bits.append(dk)
    if size_rule != "none":
        bits.append(f"{size_rule} {mn or ''}{'-' + str(mx) if mx else ''}".strip())
    if tr:
        bits.append(f"{tr} trophy")
    if restr:
        bits.append("+".join(sorted(restr)))
    if ef:
        bits.append(f"{ef}..{et}")
    return " | ".join(bits)


GOLD_SQL = """
select coalesce(w.slug, '') water_slug,
       coalesce(
         (select array_agg(sp.key order by sp.key)
            from fishing_rule_species rs join species sp on sp.id = rs.species_id
           where rs.rule_id = r.id),
         case when r.species_id is null then array[]::text[]
              else array[(select key from species where id = r.species_id)] end
       ) species,
       r.size_rule, r.min_length_inches, r.max_length_inches,
       r.daily_limit_kind, r.daily_limit, r.trophy_allowance,
       r.limit_basis, r.restrictions, r.effective_from, r.effective_to
  from fishing_rules r
  join states st on st.id = r.state_id
  left join waters w on w.id = r.water_id
 where st.code = '{state}' and r.status = 'published'
"""

# A proposal stores the water by NAME and the species by KEY, because neither
# has an id until it is approved. Slugify in SQL so the comparison is on the
# same footing as the gold set.
PROPOSED_SQL = """
select coalesce(
         regexp_replace(
           regexp_replace(lower(coalesce(r.proposed_payload->>'water_name','')),
                          '[^a-z0-9]+', '-', 'g'),
           '^-+|-+$', '', 'g'), '') water_slug,
       coalesce((select array_agg(x order by x)
                   from jsonb_array_elements_text(r.proposed_payload->'species_keys') t(x)),
                array[]::text[]) species,
       r.proposed_payload->>'size_rule' size_rule,
       r.proposed_payload->>'min_length_inches' min_length_inches,
       r.proposed_payload->>'max_length_inches' max_length_inches,
       r.proposed_payload->>'daily_limit_kind' daily_limit_kind,
       r.proposed_payload->>'daily_limit' daily_limit,
       r.proposed_payload->>'trophy_allowance' trophy_allowance,
       r.proposed_payload->>'limit_basis' limit_basis,
       coalesce((select array_agg(x order by x)
                   from jsonb_array_elements_text(r.proposed_payload->'restrictions') t(x)),
                array[]::text[]) restrictions,
       r.proposed_payload->>'effective_from' effective_from,
       r.proposed_payload->>'effective_to' effective_to,
       r.confidence, r.validation_errors, r.status
  from review_queue r
  join states st on st.id = (r.proposed_payload->>'state_id')::uuid
 where r.target_table = 'fishing_rules' and st.code = '{state}'
   and r.status = 'pending'
"""

GATE = 0.85


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", default="GA")
    args = ap.parse_args()

    gold_rows = query(GOLD_SQL.format(state=args.state))
    prop_rows = query(PROPOSED_SQL.format(state=args.state))

    gold = {key_of(r): r for r in gold_rows}
    proposed: dict[tuple, dict] = {}
    for r in prop_rows:
        proposed.setdefault(key_of(r), r)

    hit = sorted(set(gold) & set(proposed), key=describe)
    missed = sorted(set(gold) - set(proposed), key=describe)
    extra = sorted(set(proposed) - set(gold), key=describe)

    print(f"Georgia fishing extractor, graded against {len(gold)} hand-checked rules")
    print(f"  proposed            {len(proposed)}")
    print(f"  matched a gold rule {len(hit)}")
    print(f"  gold rules missed   {len(missed)}")
    print(f"  proposed, no match  {len(extra)}")
    if gold:
        print(f"  RECALL              {100 * len(hit) / len(gold):.0f}%")
    if proposed:
        print(f"  PRECISION           {100 * len(hit) / len(proposed):.0f}%")

    # Calibration is the number that decides whether this can run unattended.
    auto_right = sum(1 for k in hit if (proposed[k].get("confidence") or 0) and
                     float(proposed[k]["confidence"]) >= GATE)
    auto_wrong = sum(1 for k in extra if (proposed[k].get("confidence") or 0) and
                     float(proposed[k]["confidence"]) >= GATE)
    held_right = len(hit) - auto_right
    print()
    print(f"  at the {GATE} auto-approve gate:")
    print(f"    would publish, correct   {auto_right}")
    print(f"    would publish, NO MATCH  {auto_wrong}   <- the number that matters")
    print(f"    correct but held back    {held_right}")

    if missed:
        print(f"\nGOLD RULES THE EXTRACTOR DID NOT FIND ({len(missed)}):")
        for k in missed:
            print(f"   - {describe(k)}")
    if extra:
        print(f"\nPROPOSED WITH NO GOLD MATCH ({len(extra)}):")
        for k in extra:
            r = proposed[k]
            c = r.get("confidence")
            errs = r.get("validation_errors") or []
            flag = "AUTO" if c and float(c) >= GATE else "held"
            print(f"   [{flag} {c}] {describe(k)}")
            if errs:
                print(f"            {'; '.join(errs)[:150]}")

    # Non-zero exit when a wrong rule would publish itself.
    return 1 if auto_wrong else 0


if __name__ == "__main__":
    sys.exit(main())
