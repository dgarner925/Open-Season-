-- 20260807140000_fix_ks_nv_license_urls.sql
-- The new link-health gate caught two more dead license links on its first run:
--   NV: ndowlicensing.com now 404s at root -> NDOW's Apply & Buy page
--   KS: ksoutdoors.gov firewalls to a 403 -> Go Outdoors Kansas official landing
-- Old values pinned so newer edits can't be clobbered.

update public.states set license_url = 'https://www.ndow.org/apply-buy/apply-buy-hunting/'
  where code = 'NV' and license_url = 'https://www.ndowlicensing.com';
update public.states set license_url = 'https://gooutdoorskansas.gov/'
  where code = 'KS' and license_url = 'https://www.ksoutdoors.gov/licenses-permits-fees';
