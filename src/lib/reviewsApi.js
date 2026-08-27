import { supabase } from './supabase'
import { cacheTrack } from './tracksApi'

function fromRow(row) {
  return {
    id: row.id,
    trackId: row.track_id,
    rating: row.rating,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    track: {
      id: row.tracks.id,
      name: row.tracks.name,
      artist: row.tracks.artist,
      album: row.tracks.album,
      albumArtUrl: row.tracks.album_art_url,
      durationMs: row.tracks.duration_ms,
      externalUrl: row.tracks.external_url,
    },
  }
}

export async function listMyReviews(userId) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, tracks(*)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data.map(fromRow)
}

export async function listUserReviews(userId) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, tracks(*)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data.map(fromRow)
}

export async function upsertReview({ userId, track, rating, body }) {
  await cacheTrack(track)
  const { error } = await supabase
    .from('reviews')
    .upsert(
      { user_id: userId, track_id: track.id, rating, body, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,track_id' }
    )
  if (error) throw error
}

export async function deleteReview(userId, trackId) {
  const { error } = await supabase.from('reviews').delete().eq('user_id', userId).eq('track_id', trackId)
  if (error) throw error
}
