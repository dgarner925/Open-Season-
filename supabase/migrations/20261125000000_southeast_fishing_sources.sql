-- Let the review queue hold fishing proposals, then register the Southeast.
--
-- ===========================================================================
-- PART 1: review_queue could never have accepted a fishing proposal
--
-- target_table's CHECK allowed exactly four tables:
--
--   seasons, application_windows, regulation_summaries, leftover_tag_sales
--
-- processFishingSource proposes into 'waters' and 'fishing_rules'. Every
-- insert it has ever attempted was rejected by this constraint. propose()
-- caught the error, logged it to console, and returned false -- which the
-- caller counts as "not proposed", indistinguishable in the response from a
-- page that held nothing.
--
-- This was the third layer of the same failure. The first was extract()
-- dropping the model's `waters` and `fishing_rules` keys; the second was the
-- empty-result branch reporting that as "nothing freshwater on this page".
-- With the first two fixed, Georgia's pages now report read: 27-55 and
-- waters: 0, rules: 0 -- the rows arrive and cannot be stored.
--
-- The extractor now also reports insert_errors, so a write failure can never
-- again be read as an empty page.

alter table public.review_queue
  drop constraint if exists review_target_table_allowed;

alter table public.review_queue
  add constraint review_target_table_allowed
  check (target_table = any (array[
    'seasons', 'application_windows', 'regulation_summaries',
    'leftover_tag_sales',
    -- Fishing. Proposals land here for review exactly like the hunting
    -- tables; nothing reaches waters/fishing_rules without an approval.
    'waters', 'fishing_rules'
  ]));

-- ===========================================================================
-- PART 2: Southeast freshwater sources
--
-- Ten pages across six states, each FETCHED AND READ on 2026-11-21 before
-- being listed here -- not guessed from Georgia's slug pattern. eRegulations
-- hosts all six; no agency-site fallback was needed.
--
-- WHY EACH URL WAS CHECKED BY CONTENT AND NOT BY NAME
--
-- Georgia's own migration records the trap: the page called "Finfish Seasons,
-- Limits, Sizes" is SALTWATER, and the freshwater limits live under "Game
-- Species Daily Limits". An extractor pointed at the obvious page would have
-- produced a confident, fully grounded, entirely wrong Georgia.
--
-- The same trap is laid in three of these six states, so these are recorded
-- here as pages NOT to register:
--
--   SC  /southcarolina/fishing/finfish-size-catch-limits          saltwater
--   FL  /florida/fishing/saltwater/...                            saltwater
--   MS  /mississippi/fishing/saltwater/recreational-fishing-limits saltwater
--
-- Florida and Mississippi both put freshwater under a /freshwater/ path
-- segment while their fishing index is mostly saltwater links. Alabama and
-- North Carolina have no such split, and their main limits pages are MIXED:
-- notes below say so, because the extractor's saltwater instruction will have
-- to work on a page that is genuinely both.
--
-- Nothing here extracts. Registering a source only makes it eligible to be
-- read; proposals still go to review_queue for approval.

insert into sources (state_id, agency_name, url, doc_type, purpose, notes)
select st.id, v.agency, v.url, 'webpage', 'fishing_rules', v.note
  from states st
  join (values

  -- ----------------------------------------------------------- ALABAMA ---
  ('AL', 'Alabama Department of Conservation and Natural Resources',
   'https://www.eregulations.com/alabama/fishing/fishing-daily-creel-possession-size-limits',
   'MIXED, predominantly freshwater. Black bass, crappie (9in min on public '
   'waters), catfish, walleye, Sipsey Fork trout, and per-reservoir size '
   'limits (Pickwick, Wheeler, Guntersville, Lewis Smith, Walter F. George, '
   'West Point, Duck River). CAUTION: the page groups striped bass rules for '
   'coastal Baldwin/Mobile rivers under a "saltwater" heading alongside '
   'striped bass rules for FRESHWATER reservoirs (Lewis Smith, Martin, '
   'Thurlow, Yates). The heading is not a reliable freshwater/saltwater '
   'split on this page.'),

  -- ---------------------------------------------------- SOUTH CAROLINA ---
  ('SC', 'South Carolina Department of Natural Resources',
   'https://www.eregulations.com/southcarolina/fishing/freshwater-fish-size-possession-limits',
   'Freshwater size and possession limits. Bream, crappie, black bass by '
   'named lake (Hartwell, Keowee, Murray, Wateree, Marion), striped bass by '
   'water. NOTE: some striped bass waters listed are TIDAL rivers (Cooper, '
   'Ashley) and sit inside a freshwater page.'),
  ('SC', 'South Carolina Department of Natural Resources',
   'https://www.eregulations.com/southcarolina/fishing/trout-size-limits',
   'Freshwater trout. Statewide 5/day plus named waters: Lake Jocassee '
   '(15in min, 3/day), Chauga, Chattooga, Lower Saluda, Middle Saluda, '
   'Lake Russell.'),
  ('SC', 'South Carolina Department of Natural Resources',
   'https://www.eregulations.com/southcarolina/fishing/freshwater-game-fishing-regulations',
   'Freshwater game fish definition, lawful methods and devices, seasons '
   '(Lake Marion closures), prohibited practices. Carries NO limits table -- '
   'the limits are on the size/possession page.'),

  -- ---------------------------------------------------- NORTH CAROLINA ---
  ('NC', 'North Carolina Wildlife Resources Commission',
   'https://www.eregulations.com/northcarolina/fishing/warm-water-game-fish-regulations',
   'MIXED, predominantly freshwater. Largemouth, smallmouth, crappie, '
   'sunfish, striped bass, walleye by named water (Santeetlah, Chatuge, '
   'Hyco, Kerr, Gaston, Norman). CAUTION: the "inland and joint waters" '
   'section lists SALTWATER species -- red drum (18in min), spotted '
   'seatrout, flounder -- on the same page.'),
  ('NC', 'North Carolina Wildlife Resources Commission',
   'https://www.eregulations.com/northcarolina/fishing/general-mountain-trout-regulations',
   'Freshwater mountain trout. Water classes (Hatchery Supported, Delayed '
   'Harvest, Wild, Catch and Release, Special Regulation), 7/day statewide, '
   'Wild Trout 7in min and 4/day. Named: Catawba River (Muddy Creek to '
   'Morganton intake), Apalachia Reservoir (3/day), Lake Coffey.'),

  -- --------------------------------------------------------- TENNESSEE ---
  ('TN', 'Tennessee Wildlife Resources Agency',
   'https://www.eregulations.com/tennessee/fishing/statewide-limits-regulations',
   'Freshwater statewide limits. Black bass 5/day, crappie 15/day (10in '
   'min), striped bass 2/day (15in min), walleye, trout 7/day. Exceptions '
   'live on a separate page not yet registered.'),
  ('TN', 'Tennessee Wildlife Resources Agency',
   'https://www.eregulations.com/tennessee/fishing/trout-regulations',
   'Freshwater trout. Delayed Harvest areas (Big Soddy Creek, Buffalo '
   'Creek, Doe River, Montgomery Bell Acorn Lake) and special rules '
   '(Caney Fork, Clinch, South Holston/Boone, Watauga, Tellico-Citico '
   'permit areas, Gatlinburg).'),

  -- ----------------------------------------------------------- FLORIDA ---
  ('FL', 'Florida Fish and Wildlife Conservation Commission',
   'https://www.eregulations.com/florida/fishing/freshwater/bag-length-limits',
   'Freshwater bag and length limits. Black bass 5/day (only one 16in or '
   'longer), panfish 50, crappie 25, striped/white/sunshine bass 20, plus '
   'named-water exceptions (Seminole, Talquin, Jackson, Perdido River, '
   'Okeechobee, Wakulla River, Chipola River). The /florida/fishing/ index '
   'itself is a shell -- freshwater lives under /freshwater/.'),

  -- ------------------------------------------------------- MISSISSIPPI ---
  ('MS', 'Mississippi Department of Wildlife, Fisheries, and Parks',
   'https://www.eregulations.com/mississippi/fishing/freshwater/freshwater-size-creel-limits',
   'Freshwater size and creel limits. Black bass 10 combined, crappie 30, '
   'striped bass 6 at 15in, walleye 3, sauger 10, bream 100, plus '
   'named-water tables (Pickwick, Ross Barnett, Sardis, Arkabutla, Grenada, '
   'Enid, Bill Waller, Pascagoula River, Choctaw Lake). The page refers '
   'saltwater questions to the Department of Marine Resources. The MS '
   'fishing index is mostly saltwater links.')

 ) as v(code, agency, url, note) on v.code = st.code
on conflict (url) do update set
  purpose      = excluded.purpose,
  notes        = excluded.notes,
  agency_name  = excluded.agency_name;
