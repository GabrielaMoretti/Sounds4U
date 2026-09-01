import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserTasteEntries, buildTasteGraph } from '../lib/tasteGraphApi'
import { listListenersForTrack } from '../lib/listeningHistoryApi'
import TasteMapCanvas from '../components/TasteMapCanvas'
import TrackRow from '../components/TrackRow'

function formatTime(iso) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function TasteMap() {
  const { connected, user } = useAuth()
  const [entries, setEntries] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [listeners, setListeners] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return
    getUserTasteEntries(user.id).then(setEntries).catch((err) => setError(err.message))
  }, [user])

  const graph = useMemo(() => (entries ? buildTasteGraph(entries) : null), [entries])
  const entryById = useMemo(() => new Map((entries ?? []).map((e) => [e.track.id, e])), [entries])
  const selected = selectedId ? entryById.get(selectedId) : null

  function handleSelect(track) {
    setSelectedId(track.id)
    setListeners(null)
    listListenersForTrack(track.id, user.id).then(setListeners).catch(() => setListeners([]))
  }

  if (!connected) return <Navigate to="/" replace />

  return (
    <div className="page taste-map-page">
      <h2>Mapa Musical</h2>
      <p className="dsp-note">
        Cada bolinha é uma música que você já ouviu, avaliou ou postou. As linhas conectam músicas
        do mesmo artista ou álbum — quanto maior a bolinha, mais você interagiu com ela. Arraste
        pra reorganizar, role o mouse pra dar zoom, clique numa música pra ver os detalhes.
      </p>
      {error && <div className="notice">{error}</div>}

      {!graph && <p>Carregando…</p>}
      {graph && graph.nodes.length === 0 && (
        <p>
          Ainda não tem dados suficientes — ouça, avalie ou poste sobre algumas músicas primeiro.
        </p>
      )}
      {graph && graph.nodes.length > 0 && (
        <div className="taste-map-wrap">
          <TasteMapCanvas nodes={graph.nodes} edges={graph.edges} onNodeClick={handleSelect} />
        </div>
      )}

      {selected && (
        <div className="taste-map-selected">
          <TrackRow
            track={selected.track}
            actions={
              <Link className="btn-ghost" to={`/track/${selected.track.id}`}>
                Ver música
              </Link>
            }
          />

          <div className="taste-detail-grid">
            <div className="taste-detail-item">
              <span className="track-meta">Vezes ouvida</span>
              <strong>{selected.playCount}</strong>
            </div>
            {selected.lastPlayedAt && (
              <div className="taste-detail-item">
                <span className="track-meta">Última vez</span>
                <strong>{formatTime(selected.lastPlayedAt)}</strong>
              </div>
            )}
            {selected.rating && (
              <div className="taste-detail-item">
                <span className="track-meta">Sua nota</span>
                <strong>{'★'.repeat(selected.rating)}{'☆'.repeat(5 - selected.rating)}</strong>
              </div>
            )}
            {selected.posted && (
              <div className="taste-detail-item">
                <span className="track-meta">Status</span>
                <strong>Você postou sobre ela</strong>
              </div>
            )}
          </div>

          {selected.reviewBody && <p className="taste-review-quote">"{selected.reviewBody}"</p>}

          {listeners === null && <p className="track-meta">Verificando amigos…</p>}
          {listeners && listeners.length > 0 && (
            <p className="dsp-note">
              Amigos que também ouviram:{' '}
              {listeners.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && ', '}
                  <Link to={`/u/${p.username}`}>{p.display_name || p.username}</Link>
                </span>
              ))}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
