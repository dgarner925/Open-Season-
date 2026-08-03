-- 20260802120000_notification_hide.sql
-- Let users remove entries from their notification history. Soft-hide, not
-- delete: sent_notifications doubles as the send-dedup log, and hard-deleting
-- a row inside an alert's active window (date changes, new-draw posts) would
-- re-fire the push. hidden_at keeps the receipt for dedup while removing it
-- from the user's view.

alter table public.sent_notifications
  add column if not exists hidden_at timestamptz;

-- Owners may update their own rows (the app only ever sets hidden_at; the
-- column-level grant below enforces that).
drop policy if exists sent_notifications_hide_own on public.sent_notifications;
create policy sent_notifications_hide_own on public.sent_notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant update (hidden_at) on public.sent_notifications to authenticated;
