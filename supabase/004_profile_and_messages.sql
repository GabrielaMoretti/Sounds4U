-- Run after 003_posts.sql. Adds profile customization (bio, social links, avatar storage) and DMs.

-- ── Profile: bio + social links ─────────────────────────────────────
alter table profiles add column if not exists bio text;
alter table profiles add column if not exists social_links jsonb not null default '[]'::jsonb;

-- ── Avatar storage (public bucket, each user can only write inside their own folder) ─
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar images are publicly accessible" on storage.objects;
create policy "avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "users upload their own avatar" on storage.objects;
create policy "users upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users update their own avatar" on storage.objects;
create policy "users update their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users delete their own avatar" on storage.objects;
create policy "users delete their own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Direct messages — only between accepted friends ─────────────────
create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);

create index if not exists messages_recipient_idx on messages (recipient_id, created_at desc);
create index if not exists messages_sender_idx on messages (sender_id, created_at desc);

alter table messages enable row level security;

drop policy if exists "participants read their messages" on messages;
create policy "participants read their messages"
  on messages for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "users message accepted friends" on messages;
create policy "users message accepted friends"
  on messages for insert to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.addressee_id = recipient_id)
          or (f.addressee_id = auth.uid() and f.requester_id = recipient_id)
        )
    )
  );

drop policy if exists "recipients mark messages read" on messages;
create policy "recipients mark messages read"
  on messages for update to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- realtime, so an open DM thread updates live
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
end $$;
