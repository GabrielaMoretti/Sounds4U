// Last.fm public API — free key, meant to be used client-side (unlike Spotify's Client Secret).
// Used only for genre tags, since Spotify discontinued Audio Features for apps created after
// Nov 2024. See https://www.last.fm/api/account/create.

const API_KEY = import.meta.env.VITE_LASTFM_API_KEY
const BASE = 'https://ws.audioscrobbler.com/2.0/'
const TAGS_PER_ARTIST = 3

export const isLastfmConfigured = Boolean(API_KEY)

const cache = new Map() // artistName -> string[] tag names, sorted by Last.fm's own count desc

async function fetchTags(artistName) {
  if (!API_KEY || !artistName) return []
  if (cache.has(artistName)) return cache.get(artistName)

  const params = new URLSearchParams({
    method: 'artist.gettoptags',
    artist: artistName,
    api_key: API_KEY,
    format: 'json',
  })

  let tags = []
  try {
    const res = await fetch(`${BASE}?${params}`)
    if (res.ok) {
      const data = await res.json()
      tags = (data?.toptags?.tag ?? []).slice(0, TAGS_PER_ARTIST).map((t) => t.name)
    }
  } catch {
    tags = []
  }
  cache.set(artistName, tags)
  return tags
}

// The single dominant tag — used for node color/label.
export async function getArtistGenre(artistName) {
  const tags = await fetchTags(artistName)
  return tags[0] ?? null
}

// Fetches top tags (plural) for a list of artist names with limited concurrency, to stay well
// under Last.fm's rate limit even when a map has a hundred distinct artists. Returns
// Map<artistName, string[]> — the full tag list is used for connections, tags[0] for color.
export async function getTagsForArtists(artistNames, concurrency = 4) {
  const uniqueNames = [...new Set(artistNames)]
  const result = new Map()
  let cursor = 0

  async function worker() {
    while (cursor < uniqueNames.length) {
      const name = uniqueNames[cursor++]
      result.set(name, await fetchTags(name))
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
