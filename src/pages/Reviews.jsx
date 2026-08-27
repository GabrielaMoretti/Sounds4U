import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useSpotify } from '../context/SpotifyContext'
import { searchTracks } from '../lib/spotify'
import { listReviews, upsertReview, deleteReview } from '../lib/localStore'
import { isSupabaseConfigured } from '../lib/supabase'
import TrackRow from '../components/TrackRow'

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
  const { connected } = useSpotify()
  const location = useLocation()

  const [selectedTrack, setSelectedTrack] = useState(location.state?.track ?? null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [reviews, setReviews] = useState(listReviews())

  useEffect(() => {
    if (!query.trim() || !connected) {
      setResults([])
      return
    }
    const handle = setTimeout(() => {
      searchTracks(query).then(setResults).catch(() => setResults([]))
    }, 350)
    return () => clearTimeout(handle)
  }, [query, connected])

  function pickTrack(track) {
    setSelectedTrack(track)
    setResults([])
    setQuery('')
    const existing = reviews.find((r) => r.trackId === track.id)
    setRating(existing?.rating ?? 0)
    setBody(existing?.body ?? '')
  }

  function saveReview() {
    if (!selectedTrack || rating === 0) return
    const record = upsertReview({ track: selectedTrack, rating, body })
    setReviews(listReviews())
    setSelectedTrack(null)
    setRating(0)
    setBody('')
    return record
  }

  function removeReview(id) {
    deleteReview(id)
    setReviews(listReviews())
  }

  return (
    <div className="page">
      <h2>Reviews</h2>
      {!isSupabaseConfigured && (
        <div className="notice">
          Supabase ainda não configurado — reviews estão salvas só neste navegador
          (localStorage), como placeholder.
        </div>
      )}

      <section className="review-composer">
        <h3>Nova review</h3>
        {!connected && <p>Conecte o Spotify para buscar músicas.</p>}

        {connected && !selectedTrack && (
          <>
            <input
              className="search-input"
              placeholder="Buscar música ou artista…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="track-list">
              {results.map((track) => (
                <div key={track.id} onClick={() => pickTrack(track)} className="track-row-clickable">
                  <TrackRow track={track} />
                </div>
              ))}
            </div>
          </>
        )}

        {selectedTrack && (
          <div className="review-form">
            <TrackRow
              track={selectedTrack}
              actions={
                <button className="btn-ghost" onClick={() => setSelectedTrack(null)}>
                  Trocar
                </button>
              }
            />
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
                  <button className="btn-ghost" onClick={() => removeReview(r.id)}>
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
