import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useSpotify } from '../context/SpotifyContext'
import { getRecentlyPlayed, getCurrentlyPlaying } from '../lib/spotify'
import TrackRow from '../components/TrackRow'

function formatPlayedAt(iso) {
  const date = new Date(iso)
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function History() {
  const { connected } = useSpotify()
  const [history, setHistory] = useState([])
  const [nowPlaying, setNowPlaying] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!connected) return
    setLoading(true)
    Promise.all([getRecentlyPlayed(30), getCurrentlyPlaying()])
      .then(([recent, current]) => {
        setHistory(recent)
        setNowPlaying(current)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [connected])

  if (!connected) return <Navigate to="/" replace />

  return (
    <div className="page">
      <h2>Histórico de escuta</h2>
      {error && <div className="notice">{error}</div>}

      {nowPlaying?.track && (
        <section className="now-playing">
          <h3>Ouvindo agora</h3>
          <TrackRow
            track={nowPlaying.track}
            meta={nowPlaying.isPlaying ? 'tocando' : 'pausado'}
            actions={
              <Link className="btn-ghost" to="/reviews" state={{ track: nowPlaying.track }}>
                Avaliar
              </Link>
            }
          />
        </section>
      )}

      <section>
        <h3>Últimas músicas ouvidas</h3>
        {loading && <p>Carregando…</p>}
        {!loading && history.length === 0 && !error && <p>Nada tocado recentemente.</p>}
        <div className="track-list">
          {history.map((item, idx) => (
            <TrackRow
              key={`${item.track.id}-${item.playedAt}-${idx}`}
              track={item.track}
              meta={formatPlayedAt(item.playedAt)}
              actions={
                <Link className="btn-ghost" to="/reviews" state={{ track: item.track }}>
                  Avaliar
                </Link>
              }
            />
          ))}
        </div>
      </section>
    </div>
  )
}
