-- 20260720150000_add_states_wave5_northeast.sql
-- Wave 5: the Northeast / Mid-Atlantic — Maine, New Hampshire, Vermont,
-- Massachusetts, Connecticut, Rhode Island, New Jersey, Delaware, Maryland,
-- Virginia. All already exist as inactive rows with species matrix populated.
-- Activate them, set agency + verified license portal, add a Statewide zone, and
-- register official sources. Every source verified live (July 2026). Entirely
-- lightweight HTML (agency pages where reachable, eRegulations mirrors otherwise)
-- — no PDF-timeout risk. Moose lotteries (ME/NH/VT) and the VA elk lottery included.
--
-- NOTE on Massachusetts: mass.gov IP-blocks datacenter fetches (403) and its
-- eReg mirror is an empty stub, so the extractor may 403 on MA sources. Activated
-- anyway; MA may not auto-populate until a fetch workaround is in place.

-- 1. Activate states + agency + license portal ------------------------------
update public.states set is_active = true,
  agency_name = 'Maine Department of Inland Fisheries and Wildlife',
  license_url = coalesce(license_url, 'https://apps1.web.maine.gov/cgi-bin/online/moses_v3/index')
where code = 'ME';
update public.states set is_active = true,
  agency_name = 'New Hampshire Fish and Game Department',
  license_url = coalesce(license_url, 'https://nhfishandgame.com/')
where code = 'NH';
update public.states set is_active = true,
  agency_name = 'Vermont Fish & Wildlife Department',
  license_url = coalesce(license_url, 'https://www.vtfwdsales.com/online/cid_entry.php')
where code = 'VT';
update public.states set is_active = true,
  agency_name = 'Massachusetts Division of Fisheries & Wildlife',
  license_url = coalesce(license_url, 'https://massfishhunt.mass.gov/')
where code = 'MA';
update public.states set is_active = true,
  agency_name = 'Connecticut DEEP Wildlife Division',
  license_url = coalesce(license_url, 'https://ct.aspirafocus.com/internetsales')
where code = 'CT';
update public.states set is_active = true,
  agency_name = 'Rhode Island DEM Division of Fish & Wildlife',
  license_url = coalesce(license_url, 'https://rio.ri.gov')
where code = 'RI';
update public.states set is_active = true,
  agency_name = 'New Jersey Division of Fish & Wildlife',
  license_url = coalesce(license_url, 'https://dep.nj.gov/njfw/licenses-and-permits/fishing-and-hunting-license-and-permit-information/')
where code = 'NJ';
update public.states set is_active = true,
  agency_name = 'Delaware Division of Fish & Wildlife',
  license_url = coalesce(license_url, 'https://epermitting.dnrec.delaware.gov/')
where code = 'DE';
update public.states set is_active = true,
  agency_name = 'Maryland Department of Natural Resources',
  license_url = coalesce(license_url, 'https://mdoutdoors.maryland.gov')
where code = 'MD';
update public.states set is_active = true,
  agency_name = 'Virginia Department of Wildlife Resources',
  license_url = coalesce(license_url, 'https://www.gooutdoorsvirginia.com/')
where code = 'VA';

-- 2. Statewide zone per new state -------------------------------------------
insert into public.zones (state_id, name, type)
select s.id, 'Statewide', 'statewide'
from public.states s
where s.code in ('ME', 'NH', 'VT', 'MA', 'CT', 'RI', 'NJ', 'DE', 'MD', 'VA')
  and not exists (select 1 from public.zones z where z.state_id = s.id and z.name = 'Statewide');

-- 3. Sources (guarded inserts; state_id resolved by code) -------------------
insert into public.sources (agency_name, url, doc_type, state_id)
select v.agency, v.url, v.doc_type::source_doc_type, (select id from public.states where code = v.code)
from (values
  -- Maine (maine.gov not blocked, 2026-27 HTML; eReg fallback)
  ('Maine Department of Inland Fisheries and Wildlife', 'https://www.maine.gov/ifw/hunting-trapping/hunting/laws-rules/season-dates-bag-limits.html', 'webpage', 'ME'),
  ('Maine Department of Inland Fisheries and Wildlife', 'https://www.maine.gov/ifw/hunting-trapping/hunting/laws-rules/migratory-gamebirds.html', 'webpage', 'ME'),
  ('Maine Department of Inland Fisheries and Wildlife', 'https://www.maine.gov/ifw/hunting-trapping/hunting/species/moose/moose-permit.html', 'webpage', 'ME'),
  ('Maine Department of Inland Fisheries and Wildlife', 'https://www.eregulations.com/maine/hunting/hunting-seasons-and-dates', 'webpage', 'ME'),
  -- New Hampshire (wildlife.nh.gov 403-blocks; eReg mirror)
  ('New Hampshire Fish and Game Department', 'https://www.eregulations.com/newhampshire/hunting/deer-hunting-seasons', 'webpage', 'NH'),
  ('New Hampshire Fish and Game Department', 'https://www.eregulations.com/newhampshire/hunting/bear-hunting-seasons', 'webpage', 'NH'),
  ('New Hampshire Fish and Game Department', 'https://www.eregulations.com/newhampshire/hunting/n-h-moose-hunt-lottery', 'webpage', 'NH'),
  ('New Hampshire Fish and Game Department', 'https://www.eregulations.com/newhampshire/hunting/turkey-hunting-seasons', 'webpage', 'NH'),
  ('New Hampshire Fish and Game Department', 'https://www.eregulations.com/newhampshire/hunting/small-game-hunting-seasons', 'webpage', 'NH'),
  ('New Hampshire Fish and Game Department', 'https://www.eregulations.com/newhampshire/hunting/waterfowl-migratory-bird-hunting-seasons-bag-limits', 'webpage', 'NH'),
  -- Vermont (vtfishandwildlife.com 403-blocks; eReg mirror 2026)
  ('Vermont Fish & Wildlife Department', 'https://www.eregulations.com/vermont/hunting/deer-hunting', 'webpage', 'VT'),
  ('Vermont Fish & Wildlife Department', 'https://www.eregulations.com/vermont/hunting/bear-hunting', 'webpage', 'VT'),
  ('Vermont Fish & Wildlife Department', 'https://www.eregulations.com/vermont/hunting/moose-hunting', 'webpage', 'VT'),
  ('Vermont Fish & Wildlife Department', 'https://www.eregulations.com/vermont/hunting/turkey-hunting', 'webpage', 'VT'),
  ('Vermont Fish & Wildlife Department', 'https://www.eregulations.com/vermont/hunting/small-game-hunting', 'webpage', 'VT'),
  ('Vermont Fish & Wildlife Department', 'https://www.eregulations.com/vermont/hunting/game-bird-hunting', 'webpage', 'VT'),
  -- Massachusetts (mass.gov 403-blocks datacenter; eReg empty — may not extract)
  ('Massachusetts Division of Fisheries & Wildlife', 'https://www.mass.gov/info-details/2026-hunting-and-freshwater-fishing-season-summary', 'webpage', 'MA'),
  ('Massachusetts Division of Fisheries & Wildlife', 'https://www.mass.gov/info-details/migratory-game-bird-hunting-regulations', 'webpage', 'MA'),
  ('Massachusetts Division of Fisheries & Wildlife', 'https://www.mass.gov/how-to/apply-for-an-antlerless-deer-permit', 'webpage', 'MA'),
  -- Connecticut (portal.ct.gov not blocked, 2026 HTML)
  ('Connecticut DEEP Wildlife Division', 'https://portal.ct.gov/deep/hunting/2026-connecticut-hunting-and-trapping-guide/deer-hunting', 'webpage', 'CT'),
  ('Connecticut DEEP Wildlife Division', 'https://portal.ct.gov/deep/hunting/2026-connecticut-hunting-and-trapping-guide/wild-turkey-hunting', 'webpage', 'CT'),
  ('Connecticut DEEP Wildlife Division', 'https://portal.ct.gov/deep/hunting/2026-connecticut-hunting-and-trapping-guide/small-game-and-pheasant-hunting', 'webpage', 'CT'),
  ('Connecticut DEEP Wildlife Division', 'https://portal.ct.gov/deep/hunting/connecticut-migratory-bird-hunting-guide/season-dates-and-bag-limits', 'webpage', 'CT'),
  -- Rhode Island (eReg mirror 2025-26; DEM has no HTML dates)
  ('Rhode Island DEM Division of Fish & Wildlife', 'https://www.eregulations.com/rhodeisland/hunting/deer-hunting-seasons-and-limits', 'webpage', 'RI'),
  ('Rhode Island DEM Division of Fish & Wildlife', 'https://www.eregulations.com/rhodeisland/hunting/turkey-seasons-and-limits', 'webpage', 'RI'),
  ('Rhode Island DEM Division of Fish & Wildlife', 'https://www.eregulations.com/rhodeisland/hunting/small-game-seasons-and-limits', 'webpage', 'RI'),
  ('Rhode Island DEM Division of Fish & Wildlife', 'https://www.eregulations.com/rhodeisland/hunting/migratory-bird-seasons-and-limits', 'webpage', 'RI'),
  -- New Jersey (dep.nj.gov not blocked; eReg mirror 2025-26)
  ('New Jersey Division of Fish & Wildlife', 'https://www.eregulations.com/newjersey/hunting/deer-hunting-seasons', 'webpage', 'NJ'),
  ('New Jersey Division of Fish & Wildlife', 'https://www.eregulations.com/newjersey/hunting/bear-hunting-regulations', 'webpage', 'NJ'),
  ('New Jersey Division of Fish & Wildlife', 'https://www.eregulations.com/newjersey/hunting/turkey-hunting', 'webpage', 'NJ'),
  ('New Jersey Division of Fish & Wildlife', 'https://www.eregulations.com/newjersey/hunting/small-game-hunting', 'webpage', 'NJ'),
  ('New Jersey Division of Fish & Wildlife', 'https://www.eregulations.com/newjersey/hunting/upland-game-birds', 'webpage', 'NJ'),
  ('New Jersey Division of Fish & Wildlife', 'https://www.eregulations.com/newjersey/hunting/migratory-bird-regulations', 'webpage', 'NJ'),
  -- Delaware (DNREC defers to eReg mirror 2026-27)
  ('Delaware Division of Fish & Wildlife', 'https://www.eregulations.com/delaware/hunting/deer-seasons', 'webpage', 'DE'),
  ('Delaware Division of Fish & Wildlife', 'https://www.eregulations.com/delaware/hunting/turkey-hunting', 'webpage', 'DE'),
  ('Delaware Division of Fish & Wildlife', 'https://www.eregulations.com/delaware/hunting/small-game-hunting', 'webpage', 'DE'),
  ('Delaware Division of Fish & Wildlife', 'https://www.eregulations.com/delaware/hunting/migratory-bird-seasons-bag-limits', 'webpage', 'DE'),
  -- Maryland (DNR defers to eReg mirror 2026-27)
  ('Maryland Department of Natural Resources', 'https://www.eregulations.com/maryland/hunting/deer-seasons-bag-limits', 'webpage', 'MD'),
  ('Maryland Department of Natural Resources', 'https://www.eregulations.com/maryland/hunting/black-bear-hunting', 'webpage', 'MD'),
  ('Maryland Department of Natural Resources', 'https://www.eregulations.com/maryland/hunting/turkey-seasons-limits', 'webpage', 'MD'),
  ('Maryland Department of Natural Resources', 'https://www.eregulations.com/maryland/hunting/small-game-seasons-limits', 'webpage', 'MD'),
  ('Maryland Department of Natural Resources', 'https://www.eregulations.com/maryland/hunting/migratory-game-bird-seasons-limits', 'webpage', 'MD'),
  -- Virginia (dwr.virginia.gov not blocked; eReg + DWR pages, VA elk lottery)
  ('Virginia Department of Wildlife Resources', 'https://www.eregulations.com/virginia/hunting/deer-hunting-firearms-seasons', 'webpage', 'VA'),
  ('Virginia Department of Wildlife Resources', 'https://www.eregulations.com/virginia/hunting/deer-hunting-seasons', 'webpage', 'VA'),
  ('Virginia Department of Wildlife Resources', 'https://www.eregulations.com/virginia/hunting/bear-hunting-firearms-seasons', 'webpage', 'VA'),
  ('Virginia Department of Wildlife Resources', 'https://dwr.virginia.gov/wildlife/elk/hunting/', 'webpage', 'VA'),
  ('Virginia Department of Wildlife Resources', 'https://www.eregulations.com/virginia/hunting/turkey-fall-firearms-seasons', 'webpage', 'VA'),
  ('Virginia Department of Wildlife Resources', 'https://www.eregulations.com/virginia/hunting/small-game-hunting', 'webpage', 'VA'),
  ('Virginia Department of Wildlife Resources', 'https://dwr.virginia.gov/hunting/regulations/migratory-gamebirds/', 'webpage', 'VA')
) as v(agency, url, doc_type, code)
where not exists (select 1 from public.sources s where s.url = v.url);
