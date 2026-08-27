import { supabase } from './supabase'
import { cacheTrack } from './tracksApi'

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
