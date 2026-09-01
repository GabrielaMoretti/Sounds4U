-- Run after 006_notifications.sql. Lets accepted friends see each other's listening_history
-- (previously owner-only) so we can show "friends who listened to this" and "tracks in common".

drop policy if exists "friends can view each other's listening history" on listening_history;
create policy "friends can view each other's listening history"
  on listening_history for select to authenticated
  using (
    exists (
      select 1 from friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.addressee_id = listening_history.user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = listening_history.user_id)
        )
    )
  );
