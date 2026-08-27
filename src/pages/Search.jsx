import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { searchTracks, SpotifyReauthRequired } from '../lib/spotify'
import TrackRow from '../components/TrackRow'

export default function Search() {
  const { user, loginWithSpotify } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [needsReauth, setNeedsReauth] = useState(false)

  useEffect(() => {
    if (!query.trim() || !user) {
      setResults([])
      return
    }
    const handle = setTimeout(() => {
      searchTracks(user.id, query)
        .then((tracks) => {
          setResults(tracks)
          setNeedsReauth(false)
        })
        .catch((err) => {
          if (err instanceof SpotifyReauthRequired) setNeedsReauth(true)
          setResults([])
        })
    }, 350)
    return () => clearTimeout(handle)
  }, [query, user])

  return (
    <div className="page">
      <h2>Buscar músicas</h2>

      {needsReauth && (
        <div className="notice">
          Sessão do Spotify expirou.{' '}
          <button className="btn-ghost" onClick={loginWithSpotify}>
            Reconectar
          </button>
        </div>
      )}

      <input
        className="search-input"
        placeholder="Buscar música ou artista…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="track-list">
        {results.map((track) => (
          <Link key={track.id} to={`/track/${track.id}`} className="track-row-clickable">
            <TrackRow track={track} />
          </Link>
        ))}
      </div>

      {query.trim() && results.length === 0 && <p>Nenhum resultado.</p>}
    </div>
  )
}
