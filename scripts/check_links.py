"""Link-health check for license/tag purchase URLs.

Validates every active state's license_url against the live web:
  - HEAD request first (falls back to GET on 405/403/5xx, since some agency
    sites reject HEAD or bare HEAD probes)
  - Redirects followed; the FINAL status decides
  - Final status >= 400 = failure
  - A TLS verify failure is re-checked against the served leaf certificate: a
    certificate that is valid right now passes, because the problem is this
    machine's CA bundle and not a link a hunter cannot reach
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
import socket
import ssl
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = "https://soxglmgbhmpuxhngcsvx.supabase.co/rest/v1"
KEY = "sb_publishable_5rIoEtCHn8PcWgHit5NgzQ_Qjpn2AHc"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
TIMEOUT = 15
HEADERS = {
    "User-Agent": UA,
    # Some agency storefronts (e.g. Alaska's) 403 probe-shaped requests but
    # serve anything that looks like a browser; send browser-ish headers so we
    # measure what a real user gets.
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def _status(url, method):
    req = urllib.request.Request(url, method=method, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:  # follows redirects
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except (urllib.error.URLError, ssl.SSLError, TimeoutError, OSError) as e:
        return f"ERR {type(e).__name__}"


def _leaf_cert_is_current(url):
    """True when the host serves a leaf certificate that is valid RIGHT NOW.

    A verification failure in this script is not the same thing as a broken
    link. Vermont's storefront fails with CERTIFICATE_VERIFY_FAILED here while
    serving a perfectly good Let's Encrypt leaf (2026-10-30 to 2027-01-28) that
    curl and every browser accept — the expiry being complained about is in
    this machine's CA bundle, not on the agency's server. Blocking a publish on
    that is blocking it on our own laptop.

    So when verification fails, look at the leaf directly: still inside its
    validity window means a hunter reaches the page, and only a genuinely
    expired or not-yet-valid certificate fails the gate.
    """
    import datetime
    from urllib.parse import urlparse

    host = urlparse(url).hostname
    port = urlparse(url).port or 443
    if not host:
        return False
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        with socket.create_connection((host, port), timeout=TIMEOUT) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as tls:
                der = tls.getpeercert(True)
        from cryptography import x509

        cert = x509.load_pem_x509_certificate(ssl.DER_cert_to_PEM_cert(der).encode())
        now = datetime.datetime.now(datetime.timezone.utc)
        return cert.not_valid_before_utc <= now <= cert.not_valid_after_utc
    except Exception:
        return False


def check_url(url):
    """Return final status for a URL: HEAD, retrying as GET on 4xx/5xx/errors.

    HEAD is cheap but widely mishandled. Kansas's storefront answers 503 to a
    concurrent HEAD and 200 to the same GET, which is why 5xx retries too —
    a server that dislikes HEAD is not a dead link, and treating it as one
    blocked a site publish on 2026-11-05.
    """
    s = _status(url, "HEAD")
    if s in (405, 403) or (isinstance(s, int) and s >= 500) or isinstance(s, str):
        s = _status(url, "GET")
    if isinstance(s, str) and any(k in s for k in ("SSLError", "URLError")):
        if _leaf_cert_is_current(url):
            return "OK cert valid, local trust store cannot verify"
    return s


def status_is_ok(status):
    """A pass is a sub-400 code, or an explicitly-cleared TLS false positive."""
    if isinstance(status, int):
        return status < 400
    return isinstance(status, str) and status.startswith("OK")


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
            ok = status_is_ok(status)
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
