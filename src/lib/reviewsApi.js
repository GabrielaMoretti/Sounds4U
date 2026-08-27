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

function fromRow(row) {
  return {
    id: row.id,
    trackId: row.track_id,
    rating: row.rating,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    track: trackFromRow(row.tracks),
  }
}

async function withAuthors(rows) {
  if (rows.length === 0) return []
  const authorIds = [...new Set(rows.map((r) => r.user_id))]
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', authorIds)
  if (error) throw error
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]))
  return rows.map((row) => ({
    ...fromRow(row),
    type: 'review',
    userId: row.user_id,
    author: profileById[row.user_id] ?? null,
  }))
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

// All reviews for a given track, from any user — powers the track detail page.
export async function listReviewsForTrack(trackId) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, tracks(*)')
    .eq('track_id', trackId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return withAuthors(data)
}

// Reviews by the given users (self + accepted friends) — merged into the feed.
export async function listReviewsForUsers(userIds) {
  if (userIds.length === 0) return []
  const { data, error } = await supabase
    .from('reviews')
    .select('*, tracks(*)')
    .in('user_id', userIds)
    .order('updated_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return withAuthors(data)
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
