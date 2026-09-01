// Last.fm public API — free key, meant to be used client-side (unlike Spotify's Client Secret).
// Used only for genre tags, since Spotify discontinued Audio Features for apps created after
// Nov 2024. See https://www.last.fm/api/account/create.

const API_KEY = import.meta.env.VITE_LASTFM_API_KEY
const BASE = 'https://ws.audioscrobbler.com/2.0/'

export const isLastfmConfigured = Boolean(API_KEY)

const cache = new Map()

// Top Last.fm tag for an artist — used as a stand-in for "genre". Cached in memory per session
// since the same artist shows up across many tracks.
export async function getArtistGenre(artistName) {
  if (!API_KEY || !artistName) return null
  if (cache.has(artistName)) return cache.get(artistName)

  const params = new URLSearchParams({
    method: 'artist.gettoptags',
    artist: artistName,
    api_key: API_KEY,
    format: 'json',
  })

  let genre = null
  try {
    const res = await fetch(`${BASE}?${params}`)
    if (res.ok) {
      const data = await res.json()
      const tags = data?.toptags?.tag ?? []
      genre = tags.length > 0 ? tags[0].name : null
    }
  } catch {
    genre = null
  }
  cache.set(artistName, genre)
  return genre
}

// Fetches genres for a list of artist names with limited concurrency, to stay well under
// Last.fm's rate limit even when a map has a hundred distinct artists.
export async function getGenresForArtists(artistNames, concurrency = 4) {
  const uniqueNames = [...new Set(artistNames)]
  const result = new Map()
  let cursor = 0

  async function worker() {
    while (cursor < uniqueNames.length) {
      const name = uniqueNames[cursor++]
      result.set(name, await getArtistGenre(name))
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, uniqueNames.length) }, worker))
  return result
}

function hashHue(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  return hash % 360
}

export function genreColor(genre) {
  if (!genre) return 'hsl(220, 8%, 55%)'
  return `hsl(${hashHue(genre.toLowerCase())}, 70%, 55%)`
}
