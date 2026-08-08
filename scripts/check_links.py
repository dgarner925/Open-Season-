"""Link-health check for license/tag purchase URLs.

Validates every active state's license_url against the live web:
  - HEAD request first (falls back to GET on 405/403, since some agency
    sites reject HEAD or bare HEAD probes)
  - Redirects followed; the FINAL status decides
  - Final status >= 400 (or SSL/connection failure) = failure
  - 15s timeout per URL so one slow agency site can't hang a publish
  - Runs URLs concurrently (10 workers)

Exit code 0 = all healthy. Exit code 1 = failures, listed as CODE URL STATUS.

Run manually:
    python scripts/check_links.py            # all active states
    python scripts/check_links.py CO GA MT   # just these state codes

Also imported by gen_state_pages.py, which refuses to publish pages when any
license link is dead.
"""
import json
import ssl
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = "https://soxglmgbhmpuxhngcsvx.supabase.co/rest/v1"
KEY = "sb_publishable_5rIoEtCHn8PcWgHit5NgzQ_Qjpn2AHc"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) OpenSeasonLinkCheck/1.0"
TIMEOUT = 15


def _status(url, method):
    req = urllib.request.Request(url, method=method, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:  # follows redirects
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except (urllib.error.URLError, ssl.SSLError, TimeoutError, OSError) as e:
        return f"ERR {type(e).__name__}"


def check_url(url):
    """Return final status for a URL: HEAD, retrying as GET on 405/403/errors."""
    s = _status(url, "HEAD")
    if s in (405, 403) or isinstance(s, str):
        s = _status(url, "GET")
    return s


def fetch_states(codes=None):
    q = f"{BASE}/states?is_active=eq.true&select=code,license_url&order=code"
    req = urllib.request.Request(q, headers={"apikey": KEY})
    with urllib.request.urlopen(req, timeout=30) as r:
        states = json.load(r)
    if codes:
        wanted = {c.upper() for c in codes}
        states = [s for s in states if s["code"] in wanted]
    return states


def check_license_urls(states):
    """Check each state's license_url. Returns list of (code, url, status) failures."""
    targets = [(s["code"], s["license_url"]) for s in states if s.get("license_url")]
    failures = []
    with ThreadPoolExecutor(max_workers=10) as ex:
        results = ex.map(lambda t: (t[0], t[1], check_url(t[1])), targets)
        for code, url, status in results:
            ok = isinstance(status, int) and status < 400
            print(f"  {'OK  ' if ok else 'FAIL'} {code}  {status}  {url}")
            if not ok:
                failures.append((code, url, status))
    missing = [s["code"] for s in states if not s.get("license_url")]
    for code in missing:
        print(f"  FAIL {code}  no license_url set")
        failures.append((code, "(none)", "missing"))
    return failures


if __name__ == "__main__":
    states = fetch_states(sys.argv[1:] or None)
    print(f"checking {len(states)} state license URLs...")
    failures = check_license_urls(states)
    if failures:
        print(f"\nLINK CHECK FAILED — {len(failures)} bad license URL(s):")
        for code, url, status in failures:
            print(f"  {code}  {url}  -> {status}")
        sys.exit(1)
    print("\nall license links healthy")
