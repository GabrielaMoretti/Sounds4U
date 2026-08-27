import { useEffect, useState } from 'react'
import TrackRow from './TrackRow'
import { searchTracks, SpotifyReauthRequired } from '../lib/spotify'

export default function TrackPicker({ userId, selectedTrack, onSelect, onReauthRequired }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])

  useEffect(() => {
    if (!query.trim() || !userId) {
      setResults([])
      return
    }
    const handle = setTimeout(() => {
      searchTracks(userId, query)
        .then(setResults)
        .catch((err) => {
          if (err instanceof SpotifyReauthRequired) onReauthRequired?.()
          setResults([])
        })
    }, 350)
    return () => clearTimeout(handle)
  }, [query, userId, onReauthRequired])

  if (selectedTrack) {
    return (
      <TrackRow
        track={selectedTrack}
        actions={
          <button type="button" className="btn-ghost" onClick={() => onSelect(null)}>
            Trocar
          </button>
        }
      />
    )
  }

  return (
    <>
      <input
        className="search-input"
        placeholder="Buscar música ou artista…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="track-list">
        {results.map((track) => (
          <div
            key={track.id}
            className="track-row-clickable"
            onClick={() => {
              onSelect(track)
              setQuery('')
              setResults([])
            }}
          >
            <TrackRow track={track} />
          </div>
        ))}
      </div>
    </>
  )
}
