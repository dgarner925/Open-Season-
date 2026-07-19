"""Emit the migration SQL for the expanded species list + state_species mapping,
from the reviewed state x species matrix. Run: python scripts/gen_state_species.py > migration.sql
Species rule: ('all',) = every state; ('states',[...]) = only these; ('except',[...]) = all but these."""

ALL = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"]

# (key, name, category, rule)
SP = [
 ("deer","Deer","big_game",("all",)),
 ("elk","Elk","big_game",("states",["AZ","CA","CO","ID","MT","NV","NM","OR","UT","WA","WY","KS","MN","NE","ND","OK","SD","AR","KY","MI","PA","TN","VA","WI","WV"])),
 ("moose","Moose","big_game",("states",["AK","CO","ID","ME","MT","ND","NH","UT","VT","WA","WY"])),
 ("pronghorn","Pronghorn","big_game",("states",["AZ","CA","CO","ID","KS","MT","NE","NV","NM","ND","OK","OR","SD","TX","UT","WY"])),
 ("caribou","Caribou","big_game",("states",["AK"])),
 ("bison","Bison","big_game",("states",["AK","AZ","MT","SD","UT","WY"])),
 ("bighorn-sheep","Bighorn sheep","big_game",("states",["AZ","CA","CO","ID","MT","NE","NV","NM","ND","OR","SD","TX","UT","WA","WY"])),
 ("dall-sheep","Dall sheep","big_game",("states",["AK"])),
 ("mountain-goat","Mountain goat","big_game",("states",["AK","CO","ID","MT","NV","OR","UT","WA","WY"])),
 ("muskox","Muskox","big_game",("states",["AK"])),
 ("bear","Black bear","big_game",("states",["AK","AZ","AR","CA","CO","GA","ID","ME","MD","MA","MI","MN","MT","NH","NJ","NM","NY","NC","OR","PA","TN","UT","VT","VA","WA","WV","WI","WY"])),
 ("brown-bear","Brown/grizzly bear","big_game",("states",["AK"])),
 ("mountain-lion","Mountain lion","big_game",("states",["AZ","CO","ID","MT","NE","NV","NM","ND","OR","SD","TX","UT","WA","WY"])),
 ("javelina","Javelina","big_game",("states",["AZ","NM","TX"])),
 ("wild-hog","Wild hog","big_game",("states",["AL","AR","CA","FL","GA","HI","KY","LA","MS","NC","OK","SC","TN","TX","VA","WV"])),
 ("turkey","Wild turkey","turkey",("except",["AK"])),
 ("duck","Ducks","waterfowl",("all",)),
 ("goose","Geese","waterfowl",("all",)),
 ("dove","Mourning dove","waterfowl",("except",["MI","NY","NJ","ME","VT","NH","MA","CT","AK"])),
 ("band-tailed-pigeon","Band-tailed pigeon","waterfowl",("states",["AZ","CA","CO","NM","OR","WA","UT"])),
 ("sandhill-crane","Sandhill crane","waterfowl",("states",["AL","AK","AZ","CO","ID","KS","KY","MN","MT","NM","ND","OK","SD","TN","TX","UT","WY"])),
 ("woodcock","Woodcock","waterfowl",("states",["AL","AR","CT","DE","FL","GA","IL","IN","IA","KY","LA","ME","MD","MA","MI","MN","MS","MO","NH","NJ","NY","NC","OH","PA","RI","SC","TN","VT","VA","WV","WI"])),
 ("snipe","Snipe","waterfowl",("except",["HI"])),
 ("pheasant","Ring-necked pheasant","upland",("states",["SD","ND","KS","NE","IA","MN","MT","CO","WI","IL","MI","IN","MO","WY","WA","OR","ID","CA","UT","NV","TX","OK","NM","AZ","OH","PA","NY","NJ","MD","DE","MA","CT","RI","SC","VA","KY"])),
 ("bobwhite","Bobwhite quail","upland",("states",["TX","OK","KS","AL","GA","FL","MS","LA","AR","SC","NC","TN","MO","NE","IA","KY","VA","WV","IL","IN","CO","OH","WI","NY","PA","NJ","MD"])),
 ("western-quail","Western quail","upland",("states",["AZ","NM","TX","CA","NV","UT","OR","WA","ID","CO","OK"])),
 ("ruffed-grouse","Ruffed grouse","upland",("states",["ME","NH","VT","MA","CT","RI","NY","PA","MD","WV","VA","NC","GA","OH","MI","WI","MN","IA","MT","ID","WY","UT","WA","OR","AK","ND","SD","TN","KY"])),
 ("spruce-grouse","Spruce grouse","upland",("states",["AK","MN","MT","ID","WA","WY"])),
 ("sharptail-grouse","Sharp-tailed grouse","upland",("states",["ND","SD","MT","WY","ID","NE","CO","UT","MN","MI","AK"])),
 ("sage-grouse","Sage grouse","upland",("states",["MT","WY","ID","NV","OR","UT","CO"])),
 ("prairie-chicken","Prairie chicken","upland",("states",["KS","NE","SD","CO","MN","OK"])),
 ("chukar","Chukar","upland",("states",["AZ","CA","CO","ID","MT","NV","OR","UT","WA","WY"])),
 ("gray-partridge","Gray partridge","upland",("states",["IA","ID","MN","MT","ND","NE","NV","OR","SD","UT","WA","WI","WY"])),
 ("ptarmigan","Ptarmigan","upland",("states",["AK","CO","UT"])),
 ("rabbit","Cottontail rabbit","small_game",("except",["AK","HI"])),
 ("snowshoe-hare","Snowshoe hare","small_game",("states",["ME","NH","VT","MA","NY","PA","MI","WI","MN","MT","ID","WY","CO","UT","WA","OR","AK"])),
 ("squirrel","Squirrel","small_game",("except",["AK","HI"])),
 ("coyote","Coyote","furbearer",("except",["HI"])),
 ("bobcat","Bobcat","furbearer",("except",["OH","NJ","DE","HI"])),
 ("fox","Fox","furbearer",("except",["HI","AK"])),
 ("raccoon","Raccoon","furbearer",("except",["HI","AK"])),
 ("fisher","Fisher","furbearer",("states",["ME","NH","VT","MA","CT","RI","NY","PA","WV","MI","WI","MN"])),
 ("marten","Marten","furbearer",("states",["ME","NY","MN","MT","ID","WY","CO","UT","NV","OR","WA","AK"])),
 ("nutria","Nutria","furbearer",("states",["LA","TX","OR","WA","MS","AL","GA","FL","SC","NC","VA"])),
 ("ringtail","Ringtail","furbearer",("states",["AZ","NM","TX","NV","UT"])),
 ("wolf","Gray wolf","furbearer",("states",["AK","ID","MT","WY"])),
 ("wolverine","Wolverine","furbearer",("states",["AK"])),
 ("alligator","American alligator","other",("states",["AL","AR","FL","GA","LA","MS","SC","TX"])),
 ("crow","Crow","other",("except",["HI"])),
]

def q(codes):
    return ",".join("'%s'" % c for c in codes)

out = []
out.append("-- 20260719140000_species_matrix.sql")
out.append("-- Expanded species list + state_species mapping, from the reviewed state x")
out.append("-- species matrix. Generated by scripts/gen_state_species.py - do not hand-edit;")
out.append("-- re-run the generator to change.\n")
out.append("alter table public.species add column if not exists category text;\n")

out.append("-- Species (upsert; existing deer/elk/bear/duck keep their ids, gain category) --")
out.append("insert into public.species (key, name, category, sort_order) values")
rows = []
for i, (key, name, cat, _rule) in enumerate(SP, start=1):
    rows.append("  ('%s','%s','%s',%d)" % (key, name.replace("'", "''"), cat, i))
out.append(",\n".join(rows))
out.append("on conflict (key) do update set name = excluded.name, category = excluded.category, sort_order = excluded.sort_order;\n")

out.append("-- state_species mapping (which species are huntable in which state) --")
out.append("""create table if not exists public.state_species (
  state_id   uuid not null references public.states(id) on delete cascade,
  species_id uuid not null references public.species(id) on delete cascade,
  primary key (state_id, species_id)
);
alter table public.state_species enable row level security;
drop policy if exists state_species_public_read on public.state_species;
create policy state_species_public_read on public.state_species
  for select to anon, authenticated using (true);
drop policy if exists state_species_admin_all on public.state_species;
create policy state_species_admin_all on public.state_species
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
""")

out.append("-- Populate (idempotent) --")
for key, name, cat, rule in SP:
    if rule[0] == "all":
        cond = ""
    elif rule[0] == "states":
        cond = " and st.code in (%s)" % q(rule[1])
    else:  # except
        cond = " and st.code not in (%s)" % q(rule[1])
    out.append(
        "insert into public.state_species (state_id, species_id)\n"
        "  select st.id, sp.id from public.states st, public.species sp\n"
        "  where sp.key = '%s'%s\n"
        "  on conflict do nothing;" % (key, cond)
    )

print("\n".join(out))
