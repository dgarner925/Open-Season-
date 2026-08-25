-- Purge non-hunt Recreation.gov entities that slipped past the ingest filter
-- (rental cabins, visitor centers, a campground — matched on "hunting" in
-- their descriptions). Real permits without "hunt" in the name are kept:
-- Somerville Lake Waterfowl Blind Permits, Eastern Neck NWR Permits.
delete from public.federal_permit_hunts
where (name ilike '%cabin%' or name ilike '%visitor center%' or name ilike '%campground%')
  and name not ilike '%hunt%';
