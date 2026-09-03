-- Run after 009_friendship_unique_pair.sql. @menções em posts, com notificação pra quem foi
-- marcado.

create table if not exists post_mentions (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table post_mentions enable row level security;

drop policy if exists "mentions are readable by authenticated users" on post_mentions;
create policy "mentions are readable by authenticated users"
  on post_mentions for select to authenticated using (true);

drop policy if exists "post authors create mentions on their own posts" on post_mentions;
create policy "post authors create mentions on their own posts"
  on post_mentions for insert to authenticated
  with check (
    exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid())
  );

-- Add 'mention' to the notification types allowed.
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('like', 'comment', 'friend_request', 'friend_accept', 'message', 'mention'));

create or replace function public.notify_on_mention()
returns trigger as $$
declare
  v_author uuid;
begin
  select user_id into v_author from posts where id = new.post_id;
  if v_author is not null and v_author <> new.user_id then
    insert into notifications (user_id, actor_id, type, post_id)
    values (new.user_id, v_author, 'mention', new.post_id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_post_mention_created on post_mentions;
create trigger on_post_mention_created
  after insert on post_mentions
  for each row execute function public.notify_on_mention();
