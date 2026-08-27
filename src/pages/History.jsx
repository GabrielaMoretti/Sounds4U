import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getRecentlyPlayed, getCurrentlyPlaying, SpotifyReauthRequired } from '../lib/spotify'
import { recordPlays } from '../lib/listeningHistoryApi'
import TrackRow from '../components/TrackRow'

function formatPlayedAt(iso) {
  const date = new Date(iso)
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function History() {
  const { connected, user, loginWithSpotify } = useAuth()
  const [history, setHistory] = useState([])
  const [nowPlaying, setNowPlaying] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [needsReauth, setNeedsReauth] = useState(false)

  useEffect(() => {
    if (!connected || !user) return
    setLoading(true)
    Promise.all([getRecentlyPlayed(user.id, 30), getCurrentlyPlaying(user.id)])
      .then(([recent, current]) => {
        setHistory(recent)
        setNowPlaying(current)
        setError(null)
        setNeedsReauth(false)
        recordPlays(user.id, recent).catch((err) => console.error('Falha ao salvar histórico:', err))
      })
      .catch((err) => {
        if (err instanceof SpotifyReauthRequired) setNeedsReauth(true)
        else setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [connected, user])

  if (!connected) return <Navigate to="/" replace />

  if (needsReauth) {
    return (
      <div className="page">
        <h2>Histórico de escuta</h2>
        <div className="notice">
          Sua sessão do Spotify expirou (o token dura 1h). Reconecte pra continuar vendo o
          histórico.
        </div>
        <button className="btn-primary" onClick={loginWithSpotify}>
          Reconectar com Spotify
        </button>
      </div>
    )
  }

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
