-- 20260720130000_insert_remaining_states.sql
-- Insert the remaining 22 states as INACTIVE rows (the prior migration's
-- on-conflict insert didn't land). Guarded with WHERE NOT EXISTS so it's a no-op
-- for the 28 states that already exist. Species mappings follow separately.

insert into public.states (code, name, is_active)
select v.code, v.name, false
from (values
  ('AK', 'Alaska'), ('AR', 'Arkansas'), ('CA', 'California'), ('CT', 'Connecticut'),
  ('DE', 'Delaware'), ('FL', 'Florida'), ('HI', 'Hawaii'), ('IN', 'Indiana'),
  ('LA', 'Louisiana'), ('ME', 'Maine'), ('MD', 'Maryland'), ('MA', 'Massachusetts'),
  ('MS', 'Mississippi'), ('NH', 'New Hampshire'), ('NJ', 'New Jersey'), ('NC', 'North Carolina'),
  ('OK', 'Oklahoma'), ('RI', 'Rhode Island'), ('SC', 'South Carolina'), ('TN', 'Tennessee'),
  ('VT', 'Vermont'), ('VA', 'Virginia')
) as v(code, name)
where not exists (select 1 from public.states s where s.code = v.code);
