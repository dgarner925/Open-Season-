-- 20260720120000_add_remaining_states.sql
-- Seed the remaining 22 states as INACTIVE rows and populate their huntable-
-- species matrix (state_species). They don't appear in the app until activated
-- by a wave migration (agency + license_url + is_active). The population block
-- is re-run from scripts/gen_state_species.py and is idempotent for the 28
-- states that already exist.

insert into public.states (code, name, is_active) values
  ('AK','Alaska',false),
  ('AR','Arkansas',false),
  ('CA','California',false),
  ('CT','Connecticut',false),
  ('DE','Delaware',false),
  ('FL','Florida',false),
  ('HI','Hawaii',false),
  ('IN','Indiana',false),
  ('LA','Louisiana',false),
  ('ME','Maine',false),
  ('MD','Maryland',false),
  ('MA','Massachusetts',false),
  ('MS','Mississippi',false),
  ('NH','New Hampshire',false),
  ('NJ','New Jersey',false),
  ('NC','North Carolina',false),
  ('OK','Oklahoma',false),
  ('RI','Rhode Island',false),
  ('SC','South Carolina',false),
  ('TN','Tennessee',false),
  ('VT','Vermont',false),
  ('VA','Virginia',false)
on conflict (code) do nothing;

-- Populate (idempotent) --
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'deer'
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'elk' and st.code in ('AZ','CA','CO','ID','MT','NV','NM','OR','UT','WA','WY','KS','MN','NE','ND','OK','SD','AR','KY','MI','PA','TN','VA','WI','WV')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'moose' and st.code in ('AK','CO','ID','ME','MT','ND','NH','UT','VT','WA','WY')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'pronghorn' and st.code in ('AZ','CA','CO','ID','KS','MT','NE','NV','NM','ND','OK','OR','SD','TX','UT','WY')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'caribou' and st.code in ('AK')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'bison' and st.code in ('AK','AZ','MT','SD','UT','WY')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'bighorn-sheep' and st.code in ('AZ','CA','CO','ID','MT','NE','NV','NM','ND','OR','SD','TX','UT','WA','WY')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'dall-sheep' and st.code in ('AK')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'mountain-goat' and st.code in ('AK','CO','ID','MT','NV','OR','UT','WA','WY')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'muskox' and st.code in ('AK')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'bear' and st.code in ('AK','AZ','AR','CA','CO','GA','ID','ME','MD','MA','MI','MN','MT','NH','NJ','NM','NY','NC','OR','PA','TN','UT','VT','VA','WA','WV','WI','WY')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'brown-bear' and st.code in ('AK')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'mountain-lion' and st.code in ('AZ','CO','ID','MT','NE','NV','NM','ND','OR','SD','TX','UT','WA','WY')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'javelina' and st.code in ('AZ','NM','TX')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'wild-hog' and st.code in ('AL','AR','CA','FL','GA','HI','KY','LA','MS','NC','OK','SC','TN','TX','VA','WV')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'turkey' and st.code not in ('AK')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'duck'
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'goose'
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'dove' and st.code not in ('MI','NY','NJ','ME','VT','NH','MA','CT','AK')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'band-tailed-pigeon' and st.code in ('AZ','CA','CO','NM','OR','WA','UT')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'sandhill-crane' and st.code in ('AL','AK','AZ','CO','ID','KS','KY','MN','MT','NM','ND','OK','SD','TN','TX','UT','WY')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'woodcock' and st.code in ('AL','AR','CT','DE','FL','GA','IL','IN','IA','KY','LA','ME','MD','MA','MI','MN','MS','MO','NH','NJ','NY','NC','OH','PA','RI','SC','TN','VT','VA','WV','WI')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'snipe' and st.code not in ('HI')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'pheasant' and st.code in ('SD','ND','KS','NE','IA','MN','MT','CO','WI','IL','MI','IN','MO','WY','WA','OR','ID','CA','UT','NV','TX','OK','NM','AZ','OH','PA','NY','NJ','MD','DE','MA','CT','RI','SC','VA','KY')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'bobwhite' and st.code in ('TX','OK','KS','AL','GA','FL','MS','LA','AR','SC','NC','TN','MO','NE','IA','KY','VA','WV','IL','IN','CO','OH','WI','NY','PA','NJ','MD')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'western-quail' and st.code in ('AZ','NM','TX','CA','NV','UT','OR','WA','ID','CO','OK')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'ruffed-grouse' and st.code in ('ME','NH','VT','MA','CT','RI','NY','PA','MD','WV','VA','NC','GA','OH','MI','WI','MN','IA','MT','ID','WY','UT','WA','OR','AK','ND','SD','TN','KY')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'spruce-grouse' and st.code in ('AK','MN','MT','ID','WA','WY')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'sharptail-grouse' and st.code in ('ND','SD','MT','WY','ID','NE','CO','UT','MN','MI','AK')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'sage-grouse' and st.code in ('MT','WY','ID','NV','OR','UT','CO')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'prairie-chicken' and st.code in ('KS','NE','SD','CO','MN','OK')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'chukar' and st.code in ('AZ','CA','CO','ID','MT','NV','OR','UT','WA','WY')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'gray-partridge' and st.code in ('IA','ID','MN','MT','ND','NE','NV','OR','SD','UT','WA','WI','WY')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'ptarmigan' and st.code in ('AK','CO','UT')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'rabbit' and st.code not in ('AK','HI')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'snowshoe-hare' and st.code in ('ME','NH','VT','MA','NY','PA','MI','WI','MN','MT','ID','WY','CO','UT','WA','OR','AK')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'squirrel' and st.code not in ('AK','HI')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'coyote' and st.code not in ('HI')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'bobcat' and st.code not in ('OH','NJ','DE','HI')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'fox' and st.code not in ('HI','AK')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'raccoon' and st.code not in ('HI','AK')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'fisher' and st.code in ('ME','NH','VT','MA','CT','RI','NY','PA','WV','MI','WI','MN')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'marten' and st.code in ('ME','NY','MN','MT','ID','WY','CO','UT','NV','OR','WA','AK')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'nutria' and st.code in ('LA','TX','OR','WA','MS','AL','GA','FL','SC','NC','VA')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'ringtail' and st.code in ('AZ','NM','TX','NV','UT')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'wolf' and st.code in ('AK','ID','MT','WY')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'wolverine' and st.code in ('AK')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'alligator' and st.code in ('AL','AR','FL','GA','LA','MS','SC','TX')
  on conflict do nothing;
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where sp.key = 'crow' and st.code not in ('HI')
  on conflict do nothing;
