-- Run after 007_shared_listening_history.sql. Adds release year for "same era" connections
-- on the Mapa Musical — this is basic Spotify catalog metadata (album.release_date), not part
-- of the deprecated Audio Features set.

alter table tracks add column if not exists release_year integer;
