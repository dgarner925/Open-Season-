-- 20260720170000_results_reminders_enum.sql
-- v1.1: draw-results reminders. Add the new notification subject type in its own
-- migration so it's committed before notifications_due() references it — Postgres
-- forbids using a freshly-added enum value inside the same transaction.

alter type public.notification_subject_type add value if not exists 'application_results';
