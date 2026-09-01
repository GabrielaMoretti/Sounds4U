import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTrack, cacheTrack } from '../lib/tracksApi'
import { getTrackById, SpotifyReauthRequired } from '../lib/spotify'
import { listReviewsForTrack } from '../lib/reviewsApi'
import { listListenersForTrack } from '../lib/listeningHistoryApi'
import TrackRow from '../components/TrackRow'

export default function TrackDetail() {
  const { trackId } = useParams()
  const { user } = useAuth()
  const [track, setTrack] = useState(undefined) // undefined = loading, null = not found
  const [reviews, setReviews] = useState([])
  const [listeners, setListeners] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        let t = await getTrack(trackId)
        if (!t && user) {
          t = await getTrackById(user.id, trackId)
          await cacheTrack(t)
        }
        if (!cancelled) setTrack(t ?? null)

        const r = await listReviewsForTrack(trackId)
        if (!cancelled) setReviews(r)

        if (user) {
          const l = await listListenersForTrack(trackId, user.id)
          if (!cancelled) setListeners(l)
        }
      } catch (err) {
        if (cancelled) return
        if (err instanceof SpotifyReauthRequired) setError('Sessão do Spotify expirou — reconecte na aba Histórico.')
        else setError(err.message)
        setTrack((prev) => (prev === undefined ? null : prev))
      }
    }
    load()

    return () => {
      cancelled = true
    }
  }, [trackId, user])

  if (track === undefined) return <div className="page">Carregando…</div>
  if (track === null) return <div className="page">Música não encontrada.</div>

  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null

  return (
    <div className="page">
      {error && <div className="notice">{error}</div>}
      <TrackRow track={track} />
      {avg && (
        <p className="dsp-note">
          Média: {avg} ★ ({reviews.length} review{reviews.length > 1 ? 's' : ''})
        </p>
      )}

      {listeners.length > 0 && (
        <p className="dsp-note">
          Amigos que ouviram:{' '}
          {listeners.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ', '}
              <Link to={`/u/${p.username}`}>{p.display_name || p.username}</Link>
            </span>
          ))}
        </p>
      )}

      <h3>Reviews</h3>
      {reviews.length === 0 && <p>Nenhuma review ainda pra essa música.</p>}
      <div className="track-list">
        {reviews.map((r) => (
          <div key={r.id} className="track-row">
            <Link to={r.author ? `/u/${r.author.username}` : '#'} className="track-info">
              <div className="track-name">{r.author?.display_name || r.author?.username || 'alguém'}</div>
              <div className="track-meta">
                {'★'.repeat(r.rating)}
                {'☆'.repeat(5 - r.rating)}
                {r.body ? ` — ${r.body}` : ''}
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
