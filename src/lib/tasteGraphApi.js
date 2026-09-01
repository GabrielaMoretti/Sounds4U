import { supabase } from './supabase'

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

// One entry per distinct track the user has interacted with, combining plays/reviews/posts.
export async function getUserTasteEntries(userId) {
  const [{ data: plays, error: playsError }, { data: reviews, error: reviewsError }, { data: posts, error: postsError }] =
    await Promise.all([
      supabase.from('listening_history').select('track_id, played_at, tracks(*)').eq('user_id', userId),
      supabase.from('reviews').select('track_id, rating, body, tracks(*)').eq('user_id', userId),
      supabase.from('posts').select('track_id, tracks(*)').eq('user_id', userId),
    ])
  if (playsError) throw playsError
  if (reviewsError) throw reviewsError
  if (postsError) throw postsError

  const byId = new Map()
  function ensure(row) {
    if (!byId.has(row.track_id)) {
      byId.set(row.track_id, {
        track: trackFromRow(row.tracks),
        playCount: 0,
        lastPlayedAt: null,
        rating: null,
        reviewBody: null,
        posted: false,
      })
    }
    return byId.get(row.track_id)
  }
  for (const p of plays) {
    const e = ensure(p)
    e.playCount += 1
    if (!e.lastPlayedAt || p.played_at > e.lastPlayedAt) e.lastPlayedAt = p.played_at
  }
  for (const r of reviews) {
    const e = ensure(r)
    e.rating = r.rating
    e.reviewBody = r.body
  }
  for (const p of posts) ensure(p).posted = true

  return [...byId.values()]
}

// Builds a node/edge graph connecting tracks that share an artist or an album.
// `entries` items may carry an `owner` tag ('me' | 'friend') for future two-person comparisons —
// when a track appears from both sides its weight and owner are merged.
export function buildTasteGraph(entries, { maxNodes = 150 } = {}) {
  const byTrack = new Map()
  for (const entry of entries) {
    const existing = byTrack.get(entry.track.id)
    const weight = entry.playCount + (entry.rating ? entry.rating * 2 : 0) + (entry.posted ? 3 : 0)
    if (!existing) {
      byTrack.set(entry.track.id, { track: entry.track, weight, owners: new Set([entry.owner ?? 'me']) })
    } else {
      existing.weight += weight
      existing.owners.add(entry.owner ?? 'me')
    }
  }

  const nodes = [...byTrack.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxNodes)
    .map((n) => ({
      id: n.track.id,
      track: n.track,
      weight: n.weight,
      shared: n.owners.size > 1,
      owner: n.owners.size > 1 ? 'both' : [...n.owners][0],
    }))

  const edges = []
  for (let i = 0; i < nodes.length; i++) {
    const artistsA = nodes[i].track.artist.split(', ')
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j].track
      const sharedAlbum = Boolean(nodes[i].track.album) && nodes[i].track.album === b.album
      const sharedArtist = artistsA.some((name) => b.artist.split(', ').includes(name))
      if (sharedAlbum || sharedArtist) {
        edges.push({ source: nodes[i].id, target: nodes[j].id, kind: sharedAlbum ? 'album' : 'artist' })
      }
    }
  }

  return { nodes, edges }
}
