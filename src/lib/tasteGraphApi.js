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
    releaseYear: row.release_year ?? null,
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

function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 0
  let intersection = 0
  for (const x of a) if (b.has(x)) intersection += 1
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

function primaryArtistOf(track) {
  return track.artist.split(', ')[0]
}

function allArtistsOf(track) {
  return track.artist.split(', ').map((a) => a.trim())
}

// Spotify hands out different track IDs for what's really "the same song" all the time — a
// single vs. the album cut, a remaster, a regional release. Comparing by exact ID alone
// undercounts real overlap, so compatibility/recommendations match on title + artist instead
// (everywhere else in the app, exact ID is still correct and stays as-is).
function normalizeForMatch(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

function normalizedArtistsOf(track) {
  return allArtistsOf(track).map(normalizeForMatch)
}

// Same song if the title matches AND at least one artist overlaps — checking the whole artist
// list (not just whoever's listed first) matters a lot for collabs/feats., which credit the
// same song differently release to release (very common in funk/eletrofunk).
function tracksMatch(a, b) {
  if (normalizeForMatch(a.name) !== normalizeForMatch(b.name)) return false
  const artistsB = normalizedArtistsOf(b)
  return normalizedArtistsOf(a).some((name) => artistsB.includes(name))
}

// Greedily pairs up each of my tracks with an unused matching track on the other side —
// avoids double-counting when someone has the same song saved under two different IDs.
function countSharedTracks(myEntries, friendEntries) {
  const used = new Array(friendEntries.length).fill(false)
  let count = 0
  for (const mine of myEntries) {
    const idx = friendEntries.findIndex((f, i) => !used[i] && tracksMatch(mine.track, f.track))
    if (idx !== -1) {
      used[idx] = true
      count += 1
    }
  }
  return count
}

// A "genre fingerprint" for a person: how many of their tracks fall under each tag, across
// their whole listening — this is the "ecosystem" signal, not just exact matches.
function buildGenreProfile(entries, tagsByArtist) {
  const freq = new Map()
  if (!tagsByArtist) return freq
  for (const e of entries) {
    for (const tag of tagsByArtist.get(primaryArtistOf(e.track)) ?? []) {
      freq.set(tag, (freq.get(tag) ?? 0) + 1)
    }
  }
  return freq
}

function cosineSimilarity(freqA, freqB) {
  if (freqA.size === 0 || freqB.size === 0) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  const keys = new Set([...freqA.keys(), ...freqB.keys()])
  for (const k of keys) {
    const a = freqA.get(k) ?? 0
    const b = freqB.get(k) ?? 0
    dot += a * b
    normA += a * a
    normB += b * b
  }
  return normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// "Musical Tinder" score. Genre ecosystem carries the most weight on purpose — two people who
// live in the same musical world but never picked the exact same song should still score high.
// Track/artist overlap add on top as a bonus for literal matches. `tagsByArtist` is optional
// (Map<artistName, string[]>, from lastfmApi) — without it the score falls back to overlap only.
export function computeCompatibility(myEntries, friendEntries, tagsByArtist) {
  const myArtists = new Set(myEntries.flatMap((e) => normalizedArtistsOf(e.track)))
  const friendArtists = new Set(friendEntries.flatMap((e) => normalizedArtistsOf(e.track)))

  const sharedTracks = countSharedTracks(myEntries, friendEntries)
  const trackUnion = myEntries.length + friendEntries.length - sharedTracks
  const trackScore = trackUnion === 0 ? 0 : sharedTracks / trackUnion

  const artistScore = jaccard(myArtists, friendArtists)
  const genreScore = tagsByArtist
    ? cosineSimilarity(buildGenreProfile(myEntries, tagsByArtist), buildGenreProfile(friendEntries, tagsByArtist))
    : 0

  const percent = tagsByArtist
    ? Math.round((genreScore * 0.5 + artistScore * 0.3 + trackScore * 0.2) * 100)
    : Math.round((artistScore * 0.6 + trackScore * 0.4) * 100)

  let sharedArtists = 0
  for (const name of myArtists) if (friendArtists.has(name)) sharedArtists += 1

  return { percent, sharedTracks, sharedArtists }
}

// Ranks the other person's tracks (excluding ones you already have) by how well they fit your
// existing genre taste, plus how much they were into it (rating/plays/posted) — "músicas do seu
// amigo que você provavelmente vai curtir". Works without Last.fm too, just falls back to
// ranking purely by the other person's own enthusiasm.
export function crossRecommend(baseEntries, candidateEntries, tagsByArtist, limit = 8) {
  const baseProfile = buildGenreProfile(baseEntries, tagsByArtist)

  function score(entry) {
    const tags = tagsByArtist?.get(primaryArtistOf(entry.track)) ?? []
    let genreAffinity = 0
    for (const tag of tags) genreAffinity += baseProfile.get(tag) ?? 0
    const enthusiasm = (entry.rating ?? 0) * 2 + entry.playCount + (entry.posted ? 2 : 0)
    return genreAffinity * 3 + enthusiasm
  }

  return candidateEntries
    .filter((e) => !baseEntries.some((b) => tracksMatch(b.track, e.track)))
    .map((e) => ({ entry: e, score: score(e) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.entry)
}
