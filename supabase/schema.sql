-- Sounds4U schema
-- Run in Supabase SQL editor (or via `supabase db push`)

create extension if not exists "uuid-ossp";

-- Public profile for each auth.users row
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- One row per user's connected DSP account (Spotify only for MVP; `provider` keeps it pluggable)
create table if not exists dsp_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'spotify',
  provider_user_id text not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  connected_at timestamptz not null default now(),
  primary key (user_id, provider)
);

-- Cached track metadata so we don't refetch Spotify on every page load
create table if not exists tracks (
  id text primary key, -- spotify track id
  name text not null,
  artist text not null,
  album text,
  album_art_url text,
  duration_ms integer,
  external_url text,
  cached_at timestamptz not null default now()
);

-- A user's play history, pulled from the DSP's "recently played"
create table if not exists listening_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id text not null references tracks(id) on delete cascade,
  played_at timestamptz not null,
  provider text not null default 'spotify',
  unique (user_id, track_id, played_at)
);

create index if not exists listening_history_user_played_idx
  on listening_history (user_id, played_at desc);

-- Reviews of a track
create table if not exists reviews (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id text not null references tracks(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, track_id)
);

create index if not exists reviews_track_idx on reviews (track_id);

-- Friendships (directional request, accepted = mutual)
create table if not exists friendships (
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

-- ── Row Level Security ─────────────────────────────────────────────

alter table profiles enable row level security;
alter table dsp_connections enable row level security;
alter table tracks enable row level security;
alter table listening_history enable row level security;
alter table reviews enable row level security;
alter table friendships enable row level security;

-- profiles: anyone signed in can read (needed for friends/reviews UI); only owner writes
create policy "profiles are readable by authenticated users"
  on profiles for select to authenticated using (true);
create policy "users manage their own profile"
  on profiles for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- dsp_connections: strictly private, holds tokens
create policy "users manage their own dsp connections"
  on dsp_connections for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- tracks: shared cache, readable by anyone signed in, writable by anyone signed in (upsert on fetch)
create policy "tracks are readable by authenticated users"
  on tracks for select to authenticated using (true);
create policy "authenticated users can cache tracks"
  on tracks for insert to authenticated with check (true);
create policy "authenticated users can refresh cached tracks"
  on tracks for update to authenticated using (true);

-- listening_history: owner-only
create policy "users manage their own listening history"
  on listening_history for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- reviews: readable by anyone signed in, writable only by the author
create policy "reviews are readable by authenticated users"
  on reviews for select to authenticated using (true);
create policy "users manage their own reviews"
  on reviews for insert to authenticated with check (auth.uid() = user_id);
create policy "users update their own reviews"
  on reviews for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete their own reviews"
  on reviews for delete to authenticated using (auth.uid() = user_id);

-- friendships: visible to either side, only the requester creates, either side updates/removes
create policy "friendships visible to participants"
  on friendships for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "users send friend requests"
  on friendships for insert to authenticated with check (auth.uid() = requester_id);
create policy "participants update friendship status"
  on friendships for update to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id)
  with check (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "participants remove friendship"
  on friendships for delete to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
