-- Teach apply_review_item to apply a water and a fishing rule.
--
-- Patched from the function's own live definition rather than retyped, so the
-- hunting branches are byte-identical to what has been running.
--
-- Both new branches resolve their references BY NAME at apply time rather than
-- storing ids in the proposal. A rule and the water it is about are usually
-- read from the same page in the same run, so the water does not have an id
-- until its own card is approved -- which may be moments before.

CREATE OR REPLACE FUNCTION public.apply_review_item(p_review_id uuid, p_quiet boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r public.review_queue;
  p jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into r from public.review_queue where id = p_review_id and status = 'pending';
  if not found then
    raise exception 'review item not found or not pending';
  end if;

  -- Transaction-local: it covers the writes below and is cleared before we
  -- return, so a later statement in the same transaction alerts normally.
  if coalesce(p_quiet, false) then
    perform set_config('openseason.quiet_apply', 'on', true);
  end if;

  p := r.proposed_payload;

  -- seasons -----------------------------------------------------------------
  if r.target_table = 'seasons' then
    if r.change_type = 'create' then
      insert into public.seasons (
        state_id, species_id, zone_id, season_year, method, label,
        open_date, close_date, bag_limit_summary, notes, source_id, last_verified_at, status
      ) values (
        (p->>'state_id')::uuid,
        (p->>'species_id')::uuid,
        (p->>'zone_id')::uuid,
        (p->>'season_year')::smallint,
        (p->>'method')::season_method,
        nullif(p->>'label', ''),
        nullif(p->>'open_date', '')::date,
        nullif(p->>'close_date', '')::date,
        nullif(p->>'bag_limit_summary', ''),
        nullif(p->>'notes', ''),
        (p->>'source_id')::uuid,
        now(),
        coalesce(nullif(p->>'status', ''), 'published')::content_status
      );
    else
      update public.seasons set
        open_date         = nullif(p->>'open_date', '')::date,
        close_date        = nullif(p->>'close_date', '')::date,
        bag_limit_summary = coalesce(nullif(p->>'bag_limit_summary', ''), bag_limit_summary),
        notes             = coalesce(nullif(p->>'notes', ''), notes),
        label             = coalesce(nullif(p->>'label', ''), label),
        last_verified_at  = now(),
        status            = coalesce(nullif(p->>'status', ''), status::text)::content_status
      where id = r.target_id;
    end if;

  -- application_windows -----------------------------------------------------
  elsif r.target_table = 'application_windows' then
    if r.change_type = 'create' then
      insert into public.application_windows (
        state_id, species_id, zone_id, season_year, name,
        opens_at, closes_at, results_expected_at, fee_summary, application_url,
        source_id, last_verified_at, status
      ) values (
        (p->>'state_id')::uuid,
        (p->>'species_id')::uuid,
        nullif(p->>'zone_id', '')::uuid,
        (p->>'season_year')::smallint,
        nullif(p->>'name', ''),
        nullif(p->>'opens_at', '')::date,
        nullif(p->>'closes_at', '')::date,
        nullif(p->>'results_expected_at', '')::date,
        nullif(p->>'fee_summary', ''),
        nullif(p->>'application_url', ''),
        (p->>'source_id')::uuid,
        now(),
        coalesce(nullif(p->>'status', ''), 'published')::content_status
      );
    else
      update public.application_windows set
        opens_at            = nullif(p->>'opens_at', '')::date,
        closes_at           = nullif(p->>'closes_at', '')::date,
        results_expected_at = nullif(p->>'results_expected_at', '')::date,
        name                = coalesce(nullif(p->>'name', ''), name),
        fee_summary         = coalesce(nullif(p->>'fee_summary', ''), fee_summary),
        application_url     = coalesce(nullif(p->>'application_url', ''), application_url),
        last_verified_at    = now(),
        status              = coalesce(nullif(p->>'status', ''), status::text)::content_status
      where id = r.target_id;
    end if;

  -- regulation_summaries ----------------------------------------------------
  elsif r.target_table = 'regulation_summaries' then
    if r.change_type = 'create' then
      insert into public.regulation_summaries (
        state_id, species_id, body, source_id, last_verified_at, status
      ) values (
        (p->>'state_id')::uuid,
        (p->>'species_id')::uuid,
        p->>'body',
        (p->>'source_id')::uuid,
        now(),
        coalesce(nullif(p->>'status', ''), 'published')::content_status
      );
    else
      update public.regulation_summaries set
        body             = coalesce(nullif(p->>'body', ''), body),
        last_verified_at = now(),
        status           = coalesce(nullif(p->>'status', ''), status::text)::content_status
      where id = r.target_id;
    end if;

  -- leftover_tag_sales ------------------------------------------------------
  elsif r.target_table = 'leftover_tag_sales' then
    if r.change_type = 'create' then
      insert into public.leftover_tag_sales (
        state_id, species_id, zone_id, season_year, sale_type, name,
        sale_start_date, sale_start_time, sale_end_date, sale_end_time, time_zone,
        residency, purchase_url, source_id, source_url, notes,
        last_verified_at, status
      ) values (
        (p->>'state_id')::uuid,
        (p->>'species_id')::uuid,
        nullif(p->>'zone_id', '')::uuid,
        (p->>'season_year')::smallint,
        (p->>'sale_type')::leftover_sale_type,
        p->>'name',
        nullif(p->>'sale_start_date', '')::date,
        nullif(p->>'sale_start_time', '')::time,
        nullif(p->>'sale_end_date', '')::date,
        nullif(p->>'sale_end_time', '')::time,
        nullif(p->>'time_zone', ''),
        coalesce(
          (select array_agg(x) from jsonb_array_elements_text(p->'residency') as t(x)),
          '{resident,nonresident}'::text[]
        ),
        nullif(p->>'purchase_url', ''),
        (p->>'source_id')::uuid,
        nullif(p->>'source_url', ''),
        nullif(p->>'notes', ''),
        now(),
        coalesce(nullif(p->>'status', ''), 'published')::content_status
      );
    else
      update public.leftover_tag_sales set
        zone_id          = coalesce(nullif(p->>'zone_id', '')::uuid, zone_id),
        name             = coalesce(nullif(p->>'name', ''), name),
        sale_start_date  = coalesce(nullif(p->>'sale_start_date', '')::date, sale_start_date),
        -- `?` not `->>`: a later fetch that simply stops publishing an hour
        -- must not erase the hour we already verified. Only a payload that
        -- carries the key explicitly, with an empty value, clears it.
        sale_start_time  = case when p ? 'sale_start_time'
                                then nullif(p->>'sale_start_time', '')::time
                                else sale_start_time end,
        sale_end_date    = case when p ? 'sale_end_date'
                                then nullif(p->>'sale_end_date', '')::date
                                else sale_end_date end,
        sale_end_time    = case when p ? 'sale_end_time'
                                then nullif(p->>'sale_end_time', '')::time
                                else sale_end_time end,
        time_zone        = coalesce(nullif(p->>'time_zone', ''), time_zone),
        residency        = coalesce(
                             (select array_agg(x) from jsonb_array_elements_text(p->'residency') as t(x)),
                             residency),
        purchase_url     = coalesce(nullif(p->>'purchase_url', ''), purchase_url),
        source_url       = coalesce(nullif(p->>'source_url', ''), source_url),
        notes            = coalesce(nullif(p->>'notes', ''), notes),
        last_verified_at = now(),
        status           = coalesce(nullif(p->>'status', ''), status::text)::content_status
      where id = r.target_id;
    end if;

  -- waters -----------------------------------------------------------------
  --
  -- A water is identified within its state by slug, so re-approving a water
  -- the extractor saw again updates it rather than creating a second one.
  -- The parent is resolved by NAME at apply time, not at proposal time: the
  -- river may have been approved in the same batch, moments earlier.
  elsif r.target_table = 'waters' then
    insert into public.waters (
      state_id, name, slug, kind, extent_note, county, parent_water_id,
      source_id, last_verified_at, status
    ) values (
      (p->>'state_id')::uuid,
      p->>'name',
      p->>'slug',
      coalesce(nullif(p->>'kind', ''), 'other'),
      nullif(p->>'extent_note', ''),
      nullif(p->>'county', ''),
      (select w.id from public.waters w
        where w.state_id = (p->>'state_id')::uuid
          and w.name = nullif(p->>'parent_water_name', '')
        limit 1),
      (p->>'source_id')::uuid,
      now(),
      'published'
    )
    on conflict (state_id, slug) do update set
      name             = excluded.name,
      kind             = excluded.kind,
      extent_note      = coalesce(excluded.extent_note, public.waters.extent_note),
      county           = coalesce(excluded.county, public.waters.county),
      parent_water_id  = coalesce(excluded.parent_water_id, public.waters.parent_water_id),
      last_verified_at = now();

  -- fishing_rules -----------------------------------------------------------
  --
  -- The species set and the water are both resolved by name here, for the
  -- same reason: a rule and the water it is about usually arrive in one batch.
  elsif r.target_table = 'fishing_rules' then
    declare
      v_water uuid;
      v_rule  uuid;
      v_keys  text[];
      v_found int;
    begin
      if nullif(p->>'water_name', '') is not null then
        select w.id into v_water from public.waters w
         where w.state_id = (p->>'state_id')::uuid
           and w.name = p->>'water_name'
         limit 1;
        if v_water is null then
          -- Left pending with a reason a person can act on. Waters are
          -- proposed before their rules, so this normally means the water's
          -- own card has not been approved yet.
          perform set_config('openseason.quiet_apply', 'off', true);
          raise exception
            'no water named % in this state yet -- approve the water first',
            p->>'water_name';
        end if;
      end if;

      v_keys := coalesce(
        (select array_agg(x) from jsonb_array_elements_text(p->'species_keys') as t(x)),
        '{}'::text[]);

      select count(*) into v_found from public.species
       where key = any (v_keys) and pursuit = 'fishing';
      if v_found = 0 or v_found <> cardinality(v_keys) then
        perform set_config('openseason.quiet_apply', 'off', true);
        raise exception
          'fishing rule names % species keys but only % exist: %',
          cardinality(v_keys), v_found, v_keys;
      end if;

      insert into public.fishing_rules (
        state_id, species_id, zone_id, water_id, season_year,
        size_rule, min_length_inches, max_length_inches,
        daily_limit_kind, daily_limit, possession_limit,
        trophy_allowance, trophy_min_length_inches,
        limit_basis, restrictions, effective_from, effective_to,
        notes, source_id, last_verified_at, status
      ) values (
        (p->>'state_id')::uuid,
        -- species_id stays null; the set lives in fishing_rule_species, even
        -- for a single species, so one code path reads every rule.
        null,
        null,
        v_water,
        (p->>'season_year')::smallint,
        coalesce(nullif(p->>'size_rule', ''), 'none'),
        (p->>'min_length_inches')::numeric,
        (p->>'max_length_inches')::numeric,
        coalesce(nullif(p->>'daily_limit_kind', ''), 'unknown'),
        (p->>'daily_limit')::smallint,
        (p->>'possession_limit')::smallint,
        (p->>'trophy_allowance')::smallint,
        (p->>'trophy_min_length_inches')::numeric,
        coalesce(nullif(p->>'limit_basis', ''), 'aggregate'),
        coalesce(
          (select array_agg(x) from jsonb_array_elements_text(p->'restrictions') as t(x)),
          '{}'::text[]),
        nullif(p->>'effective_from', '')::date,
        nullif(p->>'effective_to', '')::date,
        nullif(p->>'notes', ''),
        (p->>'source_id')::uuid,
        now(),
        'published'
      )
      returning id into v_rule;

      insert into public.fishing_rule_species (rule_id, species_id)
      select v_rule, sp.id from public.species sp
       where sp.key = any (v_keys) and sp.pursuit = 'fishing'
      on conflict do nothing;
    end;

  else
    perform set_config('openseason.quiet_apply', 'off', true);
    raise exception 'unsupported target_table: %', r.target_table;
  end if;

  update public.review_queue
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = case when coalesce(p_quiet, false)
                          then 'applied quietly (no follower alert)'
                          else review_notes end
  where id = r.id;

  perform set_config('openseason.quiet_apply', 'off', true);
end;
$function$

