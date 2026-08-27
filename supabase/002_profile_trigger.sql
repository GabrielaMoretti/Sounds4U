-- Run this AFTER schema.sql. Auto-creates a profile row whenever someone signs in for the
-- first time via Supabase Auth (Spotify OAuth provider).

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    lower(
      regexp_replace(
        coalesce(new.raw_user_meta_data->>'preferred_username', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'user'),
        '[^a-zA-Z0-9]+', '', 'g'
      )
    ) || '_' || substr(new.id::text, 1, 4),
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
