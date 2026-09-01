import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserTasteEntries, buildTasteGraph } from '../lib/tasteGraphApi'
import TasteMapCanvas from '../components/TasteMapCanvas'
import TrackRow from '../components/TrackRow'

export default function TasteMap() {
  const { connected, user } = useAuth()
  const [entries, setEntries] = useState(null)
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return
    getUserTasteEntries(user.id).then(setEntries).catch((err) => setError(err.message))
  }, [user])

  const graph = useMemo(() => (entries ? buildTasteGraph(entries) : null), [entries])

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
          <TasteMapCanvas nodes={graph.nodes} edges={graph.edges} onNodeClick={setSelected} />
        </div>
      )}

      {selected && (
        <div className="taste-map-selected">
          <TrackRow
            track={selected}
            actions={
              <Link className="btn-ghost" to={`/track/${selected.id}`}>
                Ver música
              </Link>
            }
          />
        </div>
      )}
    </div>
  )
}
