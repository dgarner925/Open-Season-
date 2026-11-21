-- Open Season: On the Water, part 3 of 3 -- the freshwater species list.
--
-- Scope is freshwater, 50 states. The list is the species that actually carry
-- a regulation somewhere in the country: a size limit, a creel limit, a closed
-- season, or a stocking programme. Species nobody regulates are left out, and
-- saltwater is out of scope for v1 (it adds a federal regulator we have never
-- read and a tide model we do not have).
--
-- `sort_order` starts at 1000 so fishing never interleaves with hunting in a
-- list that forgot to filter by pursuit -- a wrong list is then obviously
-- wrong rather than subtly wrong.
--
-- Idempotent: re-running corrects the name, category and pursuit of a row that
-- already exists, and adds nothing twice.

insert into species (key, name, category, pursuit, sort_order) values
  -- Trout and salmon. The engine of freshwater fishing regulation: most
  -- special-regulation waters, most stocking, most gear rules.
  ('rainbow-trout',       'Rainbow trout',       'trout_salmon', 'fishing', 1000),
  ('brown-trout',         'Brown trout',         'trout_salmon', 'fishing', 1001),
  ('brook-trout',         'Brook trout',         'trout_salmon', 'fishing', 1002),
  ('lake-trout',          'Lake trout',          'trout_salmon', 'fishing', 1003),
  ('cutthroat-trout',     'Cutthroat trout',     'trout_salmon', 'fishing', 1004),
  ('bull-trout',          'Bull trout',          'trout_salmon', 'fishing', 1005),
  ('golden-trout',        'Golden trout',        'trout_salmon', 'fishing', 1006),
  ('steelhead',           'Steelhead',           'trout_salmon', 'fishing', 1007),
  ('chinook-salmon',      'Chinook salmon',      'trout_salmon', 'fishing', 1008),
  ('coho-salmon',         'Coho salmon',         'trout_salmon', 'fishing', 1009),
  ('kokanee',             'Kokanee salmon',      'trout_salmon', 'fishing', 1010),
  ('atlantic-salmon',     'Atlantic salmon',     'trout_salmon', 'fishing', 1011),
  ('arctic-char',         'Arctic char',         'trout_salmon', 'fishing', 1012),
  ('arctic-grayling',     'Arctic grayling',     'trout_salmon', 'fishing', 1013),
  ('mountain-whitefish',  'Mountain whitefish',  'trout_salmon', 'fishing', 1014),
  ('lake-whitefish',      'Lake whitefish',      'trout_salmon', 'fishing', 1015),

  -- Bass. The most-fished group in the country, and where slot limits live.
  ('largemouth-bass',     'Largemouth bass',     'bass', 'fishing', 1100),
  ('smallmouth-bass',     'Smallmouth bass',     'bass', 'fishing', 1101),
  ('spotted-bass',        'Spotted bass',        'bass', 'fishing', 1102),
  ('striped-bass',        'Striped bass',        'bass', 'fishing', 1103),
  ('white-bass',          'White bass',          'bass', 'fishing', 1104),
  ('hybrid-striped-bass', 'Hybrid striped bass', 'bass', 'fishing', 1105),
  ('redeye-bass',         'Redeye bass',         'bass', 'fishing', 1106),
  ('guadalupe-bass',      'Guadalupe bass',      'bass', 'fishing', 1107),
  ('shoal-bass',          'Shoal bass',          'bass', 'fishing', 1108),

  -- Panfish. Usually generous limits, but the limits are real and asked about.
  ('bluegill',            'Bluegill',            'panfish', 'fishing', 1200),
  ('black-crappie',       'Black crappie',       'panfish', 'fishing', 1201),
  ('white-crappie',       'White crappie',       'panfish', 'fishing', 1202),
  ('yellow-perch',        'Yellow perch',        'panfish', 'fishing', 1203),
  ('redear-sunfish',      'Redear sunfish',      'panfish', 'fishing', 1204),
  ('rock-bass',           'Rock bass',           'panfish', 'fishing', 1205),
  ('warmouth',            'Warmouth',            'panfish', 'fishing', 1206),

  -- Walleye and pike. Closed seasons here are genuine and frequently missed,
  -- because unlike most fishing these species do shut.
  ('walleye',             'Walleye',             'walleye_pike', 'fishing', 1300),
  ('sauger',              'Sauger',              'walleye_pike', 'fishing', 1301),
  ('saugeye',             'Saugeye',             'walleye_pike', 'fishing', 1302),
  ('northern-pike',       'Northern pike',       'walleye_pike', 'fishing', 1303),
  ('muskellunge',         'Muskellunge',         'walleye_pike', 'fishing', 1304),
  ('tiger-muskellunge',   'Tiger muskellunge',   'walleye_pike', 'fishing', 1305),
  ('chain-pickerel',      'Chain pickerel',      'walleye_pike', 'fishing', 1306),

  -- Catfish. Trophy allowances ("one over 30 inches") are the usual shape.
  ('channel-catfish',     'Channel catfish',     'catfish', 'fishing', 1400),
  ('blue-catfish',        'Blue catfish',        'catfish', 'fishing', 1401),
  ('flathead-catfish',    'Flathead catfish',    'catfish', 'fishing', 1402),
  ('bullhead',            'Bullhead',            'catfish', 'fishing', 1403),

  -- Everything else that carries a rule. Sturgeon and paddlefish are the
  -- strictest freshwater regulations in the country -- tagging, lotteries,
  -- short seasons -- which is exactly the kind of thing this app is for.
  ('lake-sturgeon',       'Lake sturgeon',       'other_fish', 'fishing', 1500),
  ('white-sturgeon',      'White sturgeon',      'other_fish', 'fishing', 1501),
  ('shovelnose-sturgeon', 'Shovelnose sturgeon', 'other_fish', 'fishing', 1502),
  ('paddlefish',          'Paddlefish',          'other_fish', 'fishing', 1503),
  ('american-shad',       'American shad',       'other_fish', 'fishing', 1504),
  ('hickory-shad',        'Hickory shad',        'other_fish', 'fishing', 1505),
  ('burbot',              'Burbot',              'other_fish', 'fishing', 1506),
  ('cisco',               'Cisco',               'other_fish', 'fishing', 1507),
  ('freshwater-drum',     'Freshwater drum',     'other_fish', 'fishing', 1508),
  ('bowfin',              'Bowfin',              'other_fish', 'fishing', 1509),
  ('longnose-gar',        'Longnose gar',        'other_fish', 'fishing', 1510),
  ('alligator-gar',       'Alligator gar',       'other_fish', 'fishing', 1511),
  ('common-carp',         'Common carp',         'other_fish', 'fishing', 1512),
  ('snakehead',           'Northern snakehead',  'other_fish', 'fishing', 1513)
on conflict (key) do update set
  name       = excluded.name,
  category   = excluded.category,
  pursuit    = excluded.pursuit,
  sort_order = excluded.sort_order;
