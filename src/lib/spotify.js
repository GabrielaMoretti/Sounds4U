// Spotify Web API calls. Auth itself is handled by Supabase (Authentication → Providers →
// Spotify) — see src/context/AuthContext.jsx. This module only knows how to read the token
// Supabase handed us (persisted in `dsp_connections`) and call the Web API with it.

import { supabase } from './supabase'

const API_BASE = 'https://api.spotify.com/v1'

export class SpotifyReauthRequired extends Error {
  constructor() {
    super('Sessão do Spotify expirou — reconecte.')
    this.name = 'SpotifyReauthRequired'
  }
}

async function refreshAccessToken(userId, refreshToken) {
  let res
  try {
    res = await fetch('/api/spotify-refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
  } catch {
    // /api not served (e.g. local `vite dev` without `vercel dev`) — fall back to reconnect.
    throw new SpotifyReauthRequired()
  }
  if (!res.ok) throw new SpotifyReauthRequired()

  const data = await res.json()
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

  const { error } = await supabase
    .from('dsp_connections')
    .update({ access_token: data.access_token, refresh_token: data.refresh_token, expires_at: expiresAt })
    .eq('user_id', userId)
    .eq('provider', 'spotify')
  if (error) throw error

  return data.access_token
}

async function getValidAccessToken(userId) {
  const { data, error } = await supabase
    .from('dsp_connections')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('provider', 'spotify')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new SpotifyReauthRequired()

  const isExpired = Date.now() > new Date(data.expires_at).getTime() - 30_000
  if (!isExpired) return data.access_token

  if (!data.refresh_token) throw new SpotifyReauthRequired()
  return refreshAccessToken(userId, data.refresh_token)
}

async function spotifyFetch(userId, path, params = {}) {
  const accessToken = await getValidAccessToken(userId)
  const query = new URLSearchParams(params).toString()
  const res = await fetch(`${API_BASE}${path}${query ? `?${query}` : ''}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 401) throw new SpotifyReauthRequired()
  if (!res.ok) throw new Error(`Spotify API ${path} falhou (${res.status}).`)
  if (res.status === 204) return null
  return res.json()
}

export function getMyProfile(userId) {
  return spotifyFetch(userId, '/me')
}

export async function getRecentlyPlayed(userId, limit = 30) {
  const data = await spotifyFetch(userId, '/me/player/recently-played', { limit })
  return (data?.items ?? []).map((item) => ({
    playedAt: item.played_at,
    track: normalizeTrack(item.track),
  }))
}

export async function getCurrentlyPlaying(userId) {
  const data = await spotifyFetch(userId, '/me/player/currently-playing')
  if (!data?.item) return null
  return { track: normalizeTrack(data.item), isPlaying: data.is_playing }
}

export async function searchTracks(userId, query, limit = 10) {
  if (!query.trim()) return []
  const data = await spotifyFetch(userId, '/search', { q: query, type: 'track', limit })
  return (data?.tracks?.items ?? []).map(normalizeTrack)
}

export async function getTrackById(userId, trackId) {
  const data = await spotifyFetch(userId, `/tracks/${trackId}`)
  return normalizeTrack(data)
}

export function normalizeTrack(track) {
  const releaseDate = track.album?.release_date
  return {
    id: track.id,
    name: track.name,
    artist: track.artists?.map((a) => a.name).join(', ') ?? '',
    album: track.album?.name ?? '',
    albumArtUrl: track.album?.images?.[0]?.url ?? null,
    durationMs: track.duration_ms,
    externalUrl: track.external_urls?.spotify ?? null,
    releaseYear: releaseDate ? parseInt(releaseDate.slice(0, 4), 10) : null,
  }
}
