-- 20260807150000_co_license_landing.sql
-- cpw.state.co.us/buy-apply turned out to be a bare redirector into the
-- cpwshop vendor portal via a Queue-it token handshake that intermittently
-- fails on real phones (dropped token -> 403 at licensing.page). Point CO at
-- CPW's true agency landing page instead; users click through to purchase in a
-- context where the vendor handshake reliably works.

update public.states set license_url = 'https://cpw.state.co.us/activities/hunting'
  where code = 'CO' and license_url = 'https://cpw.state.co.us/buy-apply';
