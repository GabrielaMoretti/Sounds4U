-- Run after 004_profile_and_messages.sql. Likes + comments on feed posts.

create table if not exists post_likes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table post_likes enable row level security;

drop policy if exists "likes are readable by authenticated users" on post_likes;
create policy "likes are readable by authenticated users"
  on post_likes for select to authenticated using (true);
drop policy if exists "users like posts themselves" on post_likes;
create policy "users like posts themselves"
  on post_likes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "users remove their own like" on post_likes;
create policy "users remove their own like"
  on post_likes for delete to authenticated using (auth.uid() = user_id);

create table if not exists post_comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_idx on post_comments (post_id, created_at);

alter table post_comments enable row level security;

drop policy if exists "comments are readable by authenticated users" on post_comments;
create policy "comments are readable by authenticated users"
  on post_comments for select to authenticated using (true);
drop policy if exists "users create their own comments" on post_comments;
create policy "users create their own comments"
  on post_comments for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "users delete their own comments" on post_comments;
create policy "users delete their own comments"
  on post_comments for delete to authenticated using (auth.uid() = user_id);
