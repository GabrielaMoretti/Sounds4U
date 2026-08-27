// Spotify Web API integration — Authorization Code + PKCE (public client, no secret required).
// Docs: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI
const SCOPES = [
  'user-read-email',
  'user-read-private',
  'user-read-recently-played',
  'user-read-currently-playing',
].join(' ')

const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize'
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'
const API_BASE = 'https://api.spotify.com/v1'

const STORAGE_KEYS = {
  verifier: 'm2u_spotify_pkce_verifier',
  tokens: 'm2u_spotify_tokens', // { access_token, refresh_token, expires_at, scope }
}

export const isSpotifyConfigured = Boolean(
  CLIENT_ID && REDIRECT_URI && CLIENT_ID !== 'your-spotify-client-id'
)

// ── PKCE helpers ─────────────────────────────────────────────────

function base64UrlEncode(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function generateCodeVerifier() {
  const bytes = crypto.getRandomValues(new Uint8Array(64))
  return base64UrlEncode(bytes)
}

async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}

// ── Auth flow ────────────────────────────────────────────────────

export async function startSpotifyLogin() {
  if (!isSpotifyConfigured) {
    throw new Error('Spotify não configurado (VITE_SPOTIFY_CLIENT_ID / VITE_SPOTIFY_REDIRECT_URI ausentes).')
  }
  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  sessionStorage.setItem(STORAGE_KEYS.verifier, verifier)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })
  window.location.href = `${AUTH_ENDPOINT}?${params.toString()}`
}

export async function handleSpotifyCallback(code) {
  const verifier = sessionStorage.getItem(STORAGE_KEYS.verifier)
  if (!verifier) throw new Error('Code verifier ausente — reinicie o login com o Spotify.')

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  })

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`Falha ao trocar código por token Spotify (${res.status}).`)
  const data = await res.json()
  storeTokens(data)
  sessionStorage.removeItem(STORAGE_KEYS.verifier)
  return data
}

function storeTokens(data) {
  const record = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? getStoredTokens()?.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  }
  localStorage.setItem(STORAGE_KEYS.tokens, JSON.stringify(record))
  return record
}

export function getStoredTokens() {
  const raw = localStorage.getItem(STORAGE_KEYS.tokens)
  return raw ? JSON.parse(raw) : null
}

export function disconnectSpotify() {
  localStorage.removeItem(STORAGE_KEYS.tokens)
}

export function isSpotifyConnected() {
  return Boolean(getStoredTokens())
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`Falha ao renovar token Spotify (${res.status}).`)
  const data = await res.json()
  return storeTokens(data)
}

async function getValidAccessToken() {
  let tokens = getStoredTokens()
  if (!tokens) throw new Error('Spotify não conectado.')
  const isExpiring = Date.now() > tokens.expires_at - 60_000
  if (isExpiring) {
    if (!tokens.refresh_token) throw new Error('Sessão do Spotify expirou — reconecte.')
    tokens = await refreshAccessToken(tokens.refresh_token)
  }
  return tokens.access_token
}

// ── API calls ────────────────────────────────────────────────────

async function spotifyFetch(path, params = {}) {
  const accessToken = await getValidAccessToken()
  const query = new URLSearchParams(params).toString()
  const res = await fetch(`${API_BASE}${path}${query ? `?${query}` : ''}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Spotify API ${path} falhou (${res.status}).`)
  if (res.status === 204) return null
  return res.json()
}

export function getMyProfile() {
  return spotifyFetch('/me')
}

export async function getRecentlyPlayed(limit = 30) {
  const data = await spotifyFetch('/me/player/recently-played', { limit })
  return (data?.items ?? []).map((item) => ({
    playedAt: item.played_at,
    track: normalizeTrack(item.track),
  }))
}

export async function getCurrentlyPlaying() {
  const data = await spotifyFetch('/me/player/currently-playing')
  if (!data?.item) return null
  return { track: normalizeTrack(data.item), isPlaying: data.is_playing }
}

export async function searchTracks(query, limit = 10) {
  if (!query.trim()) return []
  const data = await spotifyFetch('/search', { q: query, type: 'track', limit })
  return (data?.tracks?.items ?? []).map(normalizeTrack)
}

export function normalizeTrack(track) {
  return {
    id: track.id,
    name: track.name,
    artist: track.artists?.map((a) => a.name).join(', ') ?? '',
    album: track.album?.name ?? '',
    albumArtUrl: track.album?.images?.[0]?.url ?? null,
    durationMs: track.duration_ms,
    externalUrl: track.external_urls?.spotify ?? null,
  }
}
