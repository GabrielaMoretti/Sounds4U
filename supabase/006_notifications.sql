-- Run after 005_post_engagement.sql. Notifications for likes, comments, friend requests/accepts,
-- and DMs — created by triggers so nothing can forget to fire one.

create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade, -- recipient
  actor_id uuid not null references auth.users(id) on delete cascade, -- who caused it
  type text not null check (type in ('like', 'comment', 'friend_request', 'friend_accept', 'message')),
  post_id uuid references posts(id) on delete cascade,
  comment_id uuid references post_comments(id) on delete cascade,
  message_id uuid references messages(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx on notifications (user_id, created_at desc);

alter table notifications enable row level security;

drop policy if exists "users read their own notifications" on notifications;
create policy "users read their own notifications"
  on notifications for select to authenticated using (auth.uid() = user_id);

drop policy if exists "users mark their own notifications read" on notifications;
create policy "users mark their own notifications read"
  on notifications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users delete their own notifications" on notifications;
create policy "users delete their own notifications"
  on notifications for delete to authenticated using (auth.uid() = user_id);

-- realtime, so the bell updates without a refresh
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;

-- ── Triggers (security definer: the actor doesn't have insert rights on someone else's
--    notifications row directly, so these run with elevated privilege) ────────────────

create or replace function public.notify_on_like()
returns trigger as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from posts where id = new.post_id;
  if v_owner is not null and v_owner <> new.user_id then
    insert into notifications (user_id, actor_id, type, post_id)
    values (v_owner, new.user_id, 'like', new.post_id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_post_like_created on post_likes;
create trigger on_post_like_created
  after insert on post_likes
  for each row execute function public.notify_on_like();

create or replace function public.notify_on_comment()
returns trigger as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from posts where id = new.post_id;
  if v_owner is not null and v_owner <> new.user_id then
    insert into notifications (user_id, actor_id, type, post_id, comment_id)
    values (v_owner, new.user_id, 'comment', new.post_id, new.id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_post_comment_created on post_comments;
create trigger on_post_comment_created
  after insert on post_comments
  for each row execute function public.notify_on_comment();

create or replace function public.notify_on_friendship_change()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    insert into notifications (user_id, actor_id, type)
    values (new.addressee_id, new.requester_id, 'friend_request');
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    insert into notifications (user_id, actor_id, type)
    values (new.requester_id, new.addressee_id, 'friend_accept');
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_friendship_created on friendships;
create trigger on_friendship_created
  after insert on friendships
  for each row execute function public.notify_on_friendship_change();

drop trigger if exists on_friendship_updated on friendships;
create trigger on_friendship_updated
  after update on friendships
  for each row execute function public.notify_on_friendship_change();

create or replace function public.notify_on_message()
returns trigger as $$
begin
  insert into notifications (user_id, actor_id, type, message_id)
  values (new.recipient_id, new.sender_id, 'message', new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_message_created on messages;
create trigger on_message_created
  after insert on messages
  for each row execute function public.notify_on_message();
