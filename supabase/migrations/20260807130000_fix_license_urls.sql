-- 20260807130000_fix_license_urls.sql
-- Fix broken/vendor-root "Buy a license / tag" links: point CO, MT, AL at
-- agency-owned landing pages (cpwshop.com root serves 403; OLS root is the
-- same class of vendor-portal risk). GA and WY already point at the targets.
-- Old values pinned in the WHERE so this never clobbers a newer edit.

update public.states set license_url = 'https://cpw.state.co.us/buy-apply'
  where code = 'CO' and license_url = 'https://www.cpwshop.com/';
update public.states set license_url = 'https://fwp.mt.gov/buyandapply/hunting-licenses'
  where code = 'MT' and license_url = 'https://ols.fwp.mt.gov/';
update public.states set license_url = 'https://www.outdooralabama.com/licenses/hunting-licenses'
  where code = 'AL' and license_url = 'https://www.outdooralabama.com/licenses';
