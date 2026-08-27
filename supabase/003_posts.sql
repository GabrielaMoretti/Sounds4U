-- Run after 002_profile_trigger.sql. Adds the feed: short posts, each tied to a track.

create table if not exists posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id text not null references tracks(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on posts (created_at desc);
create index if not exists posts_user_idx on posts (user_id);

alter table posts enable row level security;

create policy "posts are readable by authenticated users"
  on posts for select to authenticated using (true);
create policy "users create their own posts"
  on posts for insert to authenticated with check (auth.uid() = user_id);
create policy "users delete their own posts"
  on posts for delete to authenticated using (auth.uid() = user_id);
