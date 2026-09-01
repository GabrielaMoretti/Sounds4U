import { supabase } from './supabase'
import { cacheTrack } from './tracksApi'

function trackFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    artist: row.artist,
    album: row.album,
    albumArtUrl: row.album_art_url,
    durationMs: row.duration_ms,
    externalUrl: row.external_url,
  }
}

// Persists recently-played items so history isn't lost once the Spotify API's own
// short recently-played window rolls off. Silently no-ops duplicates (unique constraint).
export async function recordPlays(userId, items) {
  if (items.length === 0) return
  await Promise.all(items.map((item) => cacheTrack(item.track)))
  const { error } = await supabase.from('listening_history').upsert(
    items.map((item) => ({
      user_id: userId,
      track_id: item.track.id,
      played_at: item.playedAt,
      provider: 'spotify',
    })),
    { onConflict: 'user_id,track_id,played_at', ignoreDuplicates: true }
  )
  if (error) throw error
}

// Accepted friends who have this track in their listening history — relies on the RLS policy
// that only lets you read rows you own or an accepted friend's, so no extra access checks needed.
export async function listListenersForTrack(trackId, excludeUserId) {
  const { data, error } = await supabase.from('listening_history').select('user_id').eq('track_id', trackId)
  if (error) throw error

  const userIds = [...new Set(data.map((r) => r.user_id))].filter((id) => id !== excludeUserId)
  if (userIds.length === 0) return []

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', userIds)
  if (profilesError) throw profilesError
  return profiles
}

// Tracks that appear in both users' listening history — same RLS-backed access rule.
export async function listCommonTracks(myUserId, otherUserId, limit = 30) {
  const [{ data: mine, error: mineError }, { data: theirs, error: theirsError }] = await Promise.all([
    supabase.from('listening_history').select('track_id').eq('user_id', myUserId),
    supabase
      .from('listening_history')
      .select('track_id, played_at, tracks(*)')
      .eq('user_id', otherUserId)
      .order('played_at', { ascending: false }),
  ])
  if (mineError) throw mineError
  if (theirsError) throw theirsError

  const myTrackIds = new Set(mine.map((r) => r.track_id))
  const seen = new Set()
  const common = []
  for (const row of theirs) {
    if (!myTrackIds.has(row.track_id) || seen.has(row.track_id)) continue
    seen.add(row.track_id)
    common.push(trackFromRow(row.tracks))
    if (common.length >= limit) break
  }
  return common
}
