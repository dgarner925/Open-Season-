-- The Weekend Brief: one Friday-morning push composed from the user's follows
-- (openers Fri-Sun, last-chance closers, deadlines within 7 days). Pro-gated,
-- silent on empty weekends. This migration adds the pref + enum value; the
-- notifications_due() branch lands in the next migration (a new enum value
-- can't be referenced in the transaction that adds it).
alter table public.profiles add column if not exists weekend_brief boolean not null default true;

alter type public.notification_subject_type add value if not exists 'weekend_brief';
