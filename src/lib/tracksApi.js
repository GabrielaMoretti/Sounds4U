import { supabase } from './supabase'

// Caches Spotify track metadata locally so reviews/history can FK to it without re-hitting
// Spotify on every read.
export async function cacheTrack(track) {
  const { error } = await supabase.from('tracks').upsert(
    {
      id: track.id,
      name: track.name,
      artist: track.artist,
      album: track.album,
      album_art_url: track.albumArtUrl,
      duration_ms: track.durationMs,
      external_url: track.externalUrl,
    },
    { onConflict: 'id' }
  )
  if (error) throw error
}

function fromRow(row) {
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

export async function getTrack(trackId) {
  const { data, error } = await supabase.from('tracks').select('*').eq('id', trackId).maybeSingle()
  if (error) throw error
  return data ? fromRow(data) : null
}
