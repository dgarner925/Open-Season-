-- Read the application-deadline pages on a schedule of their own.
--
-- Draw pages were invisible to the scheduler. coverage-watch reasons about
-- state x species *season* rows, so a state with complete season coverage and
-- no application window at all carries no gap, and gap mode never picks its
-- deadline page. The round-robin would have reached them, but nothing runs the
-- round-robin: the only nightly cron asks for gaps. Six western deadline pages
-- sat unread from July to November 2026, and application_windows held nothing
-- at all for CO, WY, AZ, NV, MT, UT, NM or ID -- the eight states whose draw
-- season is the one that earns subscriptions.
--
-- `carries_draws` is a new flag rather than a `purpose` value on purpose:
-- purpose='seasons' is load-bearing for the round-robin, and retagging a page
-- would silently drop it out of the season rotation.
--
-- Cheap by construction: an unchanged page skips on the content hash without a
-- model call, so a nightly sweep of five costs five fetches on a quiet night.

alter table public.sources
  add column if not exists carries_draws boolean not null default false;

-- The canonical deadline pages. News articles with a year in the URL are
-- deliberately absent: they never update, so flagging them buys nothing.
update public.sources set carries_draws = true, updated_at = now() where url in (
  -- already registered, unread since July 2026
  'https://cpw.state.co.us/activities/hunting/big-game/primary-draw',
  'https://cpw.state.co.us/activities/hunting/big-game/secondary-draw',
  'https://fwp.mt.gov/buyandapply/hunting-licenses/application-drawing-dates',
  'https://wildlife.dgf.nm.gov/hunting/applications-and-draw-information/',
  'https://wgfd.wyo.gov/licenses-applications/application-dates-deadlines',
  'https://www.ndow.org/wp-content/uploads/2026/01/CR-26-01-2026-2027-Application-Deadlines-Draw-Result-Dates-NBWC-Approved-January-2026.pdf',
  -- registered all along, never read as deadlines
  'https://www.adfg.alaska.gov/index.cfm?adfg=huntlicense.drawsupplements',
  'https://www.agfc.com/hunting/more-game/alligator/permit-application-schedule/',
  'https://www.agfc.com/resources/all-calendars/permit-deadlines/',
  'https://myfwc.com/license/limited-entry/apply/',
  'https://myfwc.com/license/limited-entry/statewide-alligator-hunt/',
  'https://idfg.idaho.gov/licenses/controlled/apply',
  'https://dnr.illinois.gov/lpr/deerpermitsfees.html',
  'https://fw.ky.gov/Hunt/Pages/ElkHuntingPermits.aspx',
  'https://www.wlf.louisiana.gov/page/lottery-hunts',
  'https://www.mass.gov/how-to/apply-for-an-antlerless-deer-permit',
  'https://www.maine.gov/ifw/hunting-trapping/hunting/species/moose/moose-permit.html',
  'https://mdc.mo.gov/hunting-trapping/species/elk/elk-application-process',
  'https://mdc.mo.gov/hunting-trapping/species/bear/bear-application-draw-process',
  'https://www.mdwfp.com/wildlife-hunting/wma-draw-hunts',
  'https://www.mdwfp.com/wildlife-hunting/wildlife-species-program/alligator-program/public-waters-permits',
  'https://www.ncwildlife.gov/hunting/license-types-and-fees/permit-hunting-opportunities',
  'https://www.eregulations.com/newhampshire/hunting/n-h-moose-hunt-lottery',
  'https://dec.ny.gov/things-to-do/hunting/deer-bear/deer-management-permits',
  'https://www.wildlifedepartment.com/hunting/controlledhunts',
  'https://myodfw.com/articles/controlled-hunt-navigation',
  'https://www.dnr.sc.gov/hunting/deerlotterysites.html',
  'https://tpwd.texas.gov/huntwild/hunt/public/public_hunt_drawing/deadlines.phtml',
  'https://www.eregulations.com/washington/hunting/special-permit-application-instructions',
  'https://wvdnr.gov/hunting/wv-lottery-hunts/'
);

-- 04:30 UTC: half an hour after the gaps run, so the two never share a wall
-- clock. Five a night sweeps thirty pages in six nights, which matters because
-- agencies publish the next year's deadlines across December to February.
--
-- The key is lifted from an existing job exactly as coverage-watch does it, so
-- no new copy of the secret is created and nothing prints it. The explicit
-- timeout is the point of difference: pg_net defaults to 5 seconds, which
-- records a timeout in net._http_response on every night the function works.
do $$
declare
  tok  text;
  cmd  text;
begin
  select (regexp_match(command, 'Bearer ([^'']+)'))[1]
    into tok
    from cron.job
   where command like '%Bearer %'
   order by jobid
   limit 1;

  if tok is null then
    raise exception 'no existing cron job carries a bearer token -- cannot schedule the draw sweep';
  end if;

  cmd := format(
    'select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'',''application/json'',''Authorization'',''Bearer %s''), timeout_milliseconds := 300000, body := ''{"draws": true, "max": 5}''::jsonb);',
    'https://soxglmgbhmpuxhngcsvx.supabase.co/functions/v1/extract-source', tok);

  perform cron.unschedule('refresh-draws-nightly')
    where exists (select 1 from cron.job where jobname = 'refresh-draws-nightly');
  perform cron.schedule('refresh-draws-nightly', '30 4 * * *', cmd);
end $$;
