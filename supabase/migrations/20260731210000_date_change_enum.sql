-- 20260731210000_date_change_enum.sql
-- Regs watchdog: new notification subject type for "a date you follow moved"
-- alerts. Separate migration so the enum value is committed before
-- notifications_due() references it (Postgres forbids same-transaction use).

alter type public.notification_subject_type add value if not exists 'date_change';
