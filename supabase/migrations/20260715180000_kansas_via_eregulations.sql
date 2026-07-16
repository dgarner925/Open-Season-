-- 20260715180000_kansas_via_eregulations.sql
-- Kansas's official site (ksoutdoors.gov) IP-blocks the extraction server with a
-- 403 (WAF blocks datacenter IPs — a browser user-agent doesn't help). eRegulations
-- hosts Kansas too, is reachable from the edge function, and is machine-parseable
-- (same host that works for Georgia). Point Kansas seasons/deadlines at it. The
-- states.license_url still points at ksoutdoors.gov, which is fine — that link
-- opens in the user's phone browser (residential IP), not the server.

update public.sources
set url = 'https://www.eregulations.com/kansas/hunting/hunting-seasons-and-dates',
    doc_type = 'webpage', last_extracted_at = null
where url = 'https://www.ksoutdoors.gov/outdoor-activities/hunting-in-kansas/when-to-hunt';

-- eRegulations' consolidated page covers deer/elk/duck seasons + deadlines, so
-- the two remaining IP-blocked species pages are redundant. (No published data or
-- review items reference them — every Kansas fetch 403'd.)
delete from public.sources
where url in (
  'https://www.ksoutdoors.gov/outdoor-activities/hunting-in-kansas/what-to-hunt/big-game/deer',
  'https://www.ksoutdoors.gov/outdoor-activities/hunting-in-kansas/what-to-hunt/big-game/elk'
);
