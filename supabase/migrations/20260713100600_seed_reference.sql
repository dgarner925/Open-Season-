-- 20260713100600_seed_reference.sql
-- Deterministic reference seed: all 50 states (5 active for V1), the four V1
-- species, and a Statewide zone per active state.
--
-- Season/window/regs seed (with real, sourced dates) is a SEPARATE migration
-- (20260713100700_seed_seasons.sql) so this structural seed can be reviewed and
-- re-run independently. Everything here is safe to re-run (ON CONFLICT DO NOTHING).

-- ---------------------------------------------------------------------------
-- States — all 50. is_active = true only for the V1 launch states.
-- ---------------------------------------------------------------------------
insert into public.states (code, name, is_active) values
  ('AL','Alabama',true),
  ('AK','Alaska',false),
  ('AZ','Arizona',false),
  ('AR','Arkansas',false),
  ('CA','California',false),
  ('CO','Colorado',true),
  ('CT','Connecticut',false),
  ('DE','Delaware',false),
  ('FL','Florida',false),
  ('GA','Georgia',true),
  ('HI','Hawaii',false),
  ('ID','Idaho',false),
  ('IL','Illinois',false),
  ('IN','Indiana',false),
  ('IA','Iowa',false),
  ('KS','Kansas',false),
  ('KY','Kentucky',false),
  ('LA','Louisiana',false),
  ('ME','Maine',false),
  ('MD','Maryland',false),
  ('MA','Massachusetts',false),
  ('MI','Michigan',false),
  ('MN','Minnesota',false),
  ('MS','Mississippi',false),
  ('MO','Missouri',false),
  ('MT','Montana',true),
  ('NE','Nebraska',false),
  ('NV','Nevada',false),
  ('NH','New Hampshire',false),
  ('NJ','New Jersey',false),
  ('NM','New Mexico',false),
  ('NY','New York',false),
  ('NC','North Carolina',false),
  ('ND','North Dakota',false),
  ('OH','Ohio',false),
  ('OK','Oklahoma',false),
  ('OR','Oregon',false),
  ('PA','Pennsylvania',false),
  ('RI','Rhode Island',false),
  ('SC','South Carolina',false),
  ('SD','South Dakota',false),
  ('TN','Tennessee',false),
  ('TX','Texas',false),
  ('UT','Utah',false),
  ('VT','Vermont',false),
  ('VA','Virginia',false),
  ('WA','Washington',false),
  ('WV','West Virginia',false),
  ('WI','Wisconsin',false),
  ('WY','Wyoming',true)
on conflict (code) do nothing;

-- Official agency names for the active states (used as source/link labels).
update public.states set agency_name = 'Georgia DNR Wildlife Resources Division' where code = 'GA' and agency_name is null;
update public.states set agency_name = 'Alabama Department of Conservation and Natural Resources' where code = 'AL' and agency_name is null;
update public.states set agency_name = 'Colorado Parks & Wildlife' where code = 'CO' and agency_name is null;
update public.states set agency_name = 'Montana Fish, Wildlife & Parks' where code = 'MT' and agency_name is null;
update public.states set agency_name = 'Wyoming Game & Fish Department' where code = 'WY' and agency_name is null;

-- ---------------------------------------------------------------------------
-- Species — the four V1 species. Extensible later (turkey, pronghorn, ...).
-- ---------------------------------------------------------------------------
insert into public.species (key, name, sort_order) values
  ('deer','Deer',1),
  ('elk','Elk',2),
  ('bear','Bear',3),
  ('duck','Duck',4)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Zones — a Statewide zone for each active state. Waterfowl flyway zones and
-- western GMUs get added alongside the season seed as needed.
-- ---------------------------------------------------------------------------
insert into public.zones (state_id, type, name, notes)
select s.id, 'statewide', 'Statewide', null
from public.states s
where s.code in ('GA','AL','CO','MT','WY')
on conflict (state_id, name) do nothing;
