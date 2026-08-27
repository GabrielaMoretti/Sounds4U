import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listMyReviews, upsertReview, deleteReview } from '../lib/reviewsApi'
import TrackRow from '../components/TrackRow'
import TrackPicker from '../components/TrackPicker'

function Stars({ value, onChange }) {
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star${n <= value ? ' filled' : ''}`}
          onClick={() => onChange(n)}
          aria-label={`${n} estrelas`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export default function Reviews() {
  const { connected, user, loginWithSpotify } = useAuth()
  const location = useLocation()

  const [selectedTrack, setSelectedTrack] = useState(location.state?.track ?? null)
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [reviews, setReviews] = useState([])
  const [needsReauth, setNeedsReauth] = useState(false)
  const [error, setError] = useState(null)

  function refreshReviews() {
    if (!user) return
    listMyReviews(user.id).then(setReviews).catch((err) => setError(err.message))
  }

  useEffect(refreshReviews, [user])

  function pickTrack(track) {
    setSelectedTrack(track)
    if (!track) return
    const existing = reviews.find((r) => r.trackId === track.id)
    setRating(existing?.rating ?? 0)
    setBody(existing?.body ?? '')
  }

  async function saveReview() {
    if (!selectedTrack || rating === 0 || !user) return
    try {
      await upsertReview({ userId: user.id, track: selectedTrack, rating, body })
      refreshReviews()
      setSelectedTrack(null)
      setRating(0)
      setBody('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeReview(trackId) {
    if (!user) return
    await deleteReview(user.id, trackId)
    refreshReviews()
  }

  return (
    <div className="page">
      <h2>Reviews</h2>
      {error && <div className="notice">{error}</div>}

      <section className="review-composer">
        <h3>Nova review</h3>
        {!connected && <p>Conecte o Spotify para buscar músicas.</p>}

        {needsReauth && (
          <div className="notice">
            Sessão do Spotify expirou.{' '}
            <button className="btn-ghost" onClick={loginWithSpotify}>
              Reconectar
            </button>
          </div>
        )}

        {connected && (
          <TrackPicker
            userId={user?.id}
            selectedTrack={selectedTrack}
            onSelect={pickTrack}
            onReauthRequired={() => setNeedsReauth(true)}
          />
        )}

        {selectedTrack && (
          <div className="review-form">
            <Stars value={rating} onChange={setRating} />
            <textarea
              placeholder="O que você achou?"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
            />
            <button className="btn-primary" disabled={rating === 0} onClick={saveReview}>
              Salvar review
            </button>
          </div>
        )}
      </section>

      <section>
        <h3>Suas reviews</h3>
        {reviews.length === 0 && <p>Nenhuma review ainda.</p>}
        <div className="track-list">
          {reviews.map((r) => (
            <TrackRow
              key={r.id}
              track={r.track}
              meta={`${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}${r.body ? ` — ${r.body}` : ''}`}
              actions={
                <>
                  <button className="btn-ghost" onClick={() => pickTrack(r.track)}>
                    Editar
                  </button>
                  <button className="btn-ghost" onClick={() => removeReview(r.trackId)}>
                    Excluir
                  </button>
                </>
              }
            />
          ))}
        </div>
      </section>
    </div>
  )
}
