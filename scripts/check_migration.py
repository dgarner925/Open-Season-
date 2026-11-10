#!/usr/bin/env python
"""Parse-check a migration before it is pasted into the Supabase SQL editor.

Why this exists
---------------
Every migration in this project is applied by hand: the service role cannot
run DDL from here, so the file is pasted into the dashboard's SQL editor. A
syntax error therefore costs a round trip through a human, and on 2026-11-08 it
cost two. Nothing else in the toolchain catches one:

  * `supabase db query --remote --read-only` refuses anything that is not a
    SELECT *client-side*, so DDL never reaches Postgres to be parsed.
  * `supabase db lint` and `supabase start` both want Docker, which is not
    installed on this machine.

So this uses libpg_query (via pglast) -- the same C parser Postgres itself
uses -- in two passes, because they catch different mistakes:

  1. parse_sql over the whole file: statement syntax, which is blind to the
     insides of a function because to the SQL grammar a function body is just
     a string literal.
  2. parse_plpgsql over every CREATE FUNCTION and DO block: the procedural
     body, where the interesting errors actually live.

What it does NOT check
----------------------
Nothing semantic. A column that does not exist, a cast that cannot work, a
policy referring to a missing function -- all parse perfectly and all fail on
paste. This moves the error class from "typo" to "wrong", which is progress,
not safety.

Usage
-----
    python scripts/check_migration.py supabase/migrations/<file>.sql
    python scripts/check_migration.py supabase/migrations/*.sql

Install once:  python -m pip install pglast
"""

import glob
import re
import sys

try:
    from pglast import parse_plpgsql, parse_sql
    from pglast.parser import ParseError
except ImportError:  # pragma: no cover
    sys.exit("pglast is not installed:  python -m pip install pglast")


# A CREATE FUNCTION or DO block, dollar-quoted body intact. (?P=t) rather than
# \k<t>: Python's re spells backreferences to named groups differently from
# every other flavour, and \k<t> raises "bad escape" instead of not matching.
PLPGSQL = re.compile(
    r"(create\s+or\s+replace\s+function\b.*?\$(?P<t1>[A-Za-z_]*)\$.*?\$(?P=t1)\$"
    r"|do\s*\$(?P<t2>[A-Za-z_]*)\$.*?\$(?P=t2)\$)",
    re.IGNORECASE | re.DOTALL,
)


def line_of(src: str, offset: int) -> int:
    return src[:offset].count("\n") + 1


def check(path: str) -> bool:
    src = open(path, encoding="utf-8").read()
    name = path.replace("\\", "/").split("/")[-1]

    try:
        statements = parse_sql(src)
    except ParseError as e:
        where = f"line {line_of(src, e.location)}" if e.location else "unknown line"
        print(f"  FAIL  {name}\n        SQL parse error, {where}: {e}")
        if e.location:
            lo = max(0, e.location - 200)
            snippet = " ".join(src[lo : e.location + 120].split())
            print(f"        ...{snippet}")
        return False

    blocks = [m.group(0) for m in PLPGSQL.finditer(src)]
    for b in blocks:
        is_do = b.lstrip().lower().startswith("do")
        # The plpgsql parser only takes a function, so a DO body is wrapped in
        # one. The wrapper is never executed and its name never reaches the DB.
        probe = (
            b
            if not is_do
            else "create or replace function __probe() returns void language plpgsql as "
            + b[b.index("$") :]
        )
        try:
            parse_plpgsql(probe)
        except ParseError as e:
            head = " ".join(b.split())[:70]
            kind = "DO block" if is_do else "function"
            print(f"  FAIL  {name}\n        plpgsql error in {kind}: {head}\n        -> {e}")
            return False

    print(f"  ok    {name}  ({len(statements)} statements, {len(blocks)} plpgsql blocks)")
    return True


def main() -> int:
    args = sys.argv[1:]
    if not args:
        args = sorted(glob.glob("supabase/migrations/*.sql"))
    paths = []
    for a in args:
        paths.extend(sorted(glob.glob(a)) if any(c in a for c in "*?[") else [a])
    if not paths:
        return print("nothing to check") or 2

    print(f"Parse-checking {len(paths)} file(s) with libpg_query\n")
    failed = [p for p in paths if not check(p)]
    print(f"\n{len(paths) - len(failed)} clean, {len(failed)} with errors")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
