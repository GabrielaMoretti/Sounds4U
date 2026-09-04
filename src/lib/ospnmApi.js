import { supabase } from './supabase'
import { cacheTrack } from './tracksApi'
import { getRecentlyPlayed } from './spotify'
import { getTagsForArtists, isLastfmConfigured } from './lastfmApi'

// A gente pode ir esticando essa lista — mas sempre nessa linha de batidão.
const BATIDAO_KEYWORDS = [
  'funk',
  'funk carioca',
  'electrofunk',
  'eletrofunk',
  'baile funk',
  'brazilian funk',
  'funk ostentacao',
  'funk ostentação',
  'phonk',
  'brazilian phonk',
  'favela funk',
  'mandelao',
  'mandelão',
]

function isBatidao(tags) {
  return tags.some((tag) => {
    const t = tag.toLowerCase()
    return BATIDAO_KEYWORDS.some((kw) => t.includes(kw))
  })
}

function primaryArtist(track) {
  return track.artist.split(', ')[0]
}

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

// Puxa o histórico recente e filtra só quem está na linha do batidão (via tags da Last.fm do
// artista). Sem Last.fm configurado não dá pra confirmar gênero com confiança nenhuma, então
// devolve vazio em vez de arriscar deixar passar música errada.
export async function getRoleSuggestions(userId, limit = 50) {
  if (!isLastfmConfigured) return []

  const recent = await getRecentlyPlayed(userId, limit)
  const uniqueByTrack = new Map()
  for (const item of recent) {
    if (!uniqueByTrack.has(item.track.id)) uniqueByTrack.set(item.track.id, item.track)
  }
  const tracks = [...uniqueByTrack.values()]
  if (tracks.length === 0) return []

  const tagsByArtist = await getTagsForArtists(tracks.map(primaryArtist))
  return tracks.filter((t) => isBatidao(tagsByArtist.get(primaryArtist(t)) ?? []))
}

function fromRow(row) {
  return {
    id: row.id,
    trackId: row.track_id,
    stars: row.stars,
    bottles: row.bottles,
    justification: row.justification,
    crazinessNote: row.craziness_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    track: trackFromRow(row.tracks),
  }
}

export async function listMyOspnm(userId) {
  const { data, error } = await supabase
    .from('ospnm_entries')
    .select('*, tracks(*)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data.map(fromRow)
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
    type: 'ospnm',
    userId: row.user_id,
    author: profileById[row.user_id] ?? null,
  }))
}

// OSPNM entries by the given users — merged into the feed. Pass null/undefined for the public
// "discover" feed (everyone, not just friends), same convention as posts/reviews.
export async function listOspnmForUsers(userIds) {
  if (userIds && userIds.length === 0) return []
  let query = supabase
    .from('ospnm_entries')
    .select('*, tracks(*)')
    .order('updated_at', { ascending: false })
    .limit(50)
  if (userIds) query = query.in('user_id', userIds)
  const { data, error } = await query
  if (error) throw error
  return withAuthors(data)
}

export async function upsertOspnm({ userId, track, stars, bottles, justification, crazinessNote }) {
  await cacheTrack(track)
  const { error } = await supabase.from('ospnm_entries').upsert(
    {
      user_id: userId,
      track_id: track.id,
      stars,
      bottles,
      justification,
      craziness_note: crazinessNote,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,track_id' }
  )
  if (error) throw error
}

export async function deleteOspnm(userId, trackId) {
  const { error } = await supabase.from('ospnm_entries').delete().eq('user_id', userId).eq('track_id', trackId)
  if (error) throw error
}
