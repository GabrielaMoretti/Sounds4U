import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserTasteEntries, buildTasteGraph } from '../lib/tasteGraphApi'
import { listListenersForTrack } from '../lib/listeningHistoryApi'
import { getGenresForArtists, genreColor, isLastfmConfigured } from '../lib/lastfmApi'
import TasteMapCanvas from '../components/TasteMapCanvas'
import TrackRow from '../components/TrackRow'

function formatTime(iso) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function primaryArtist(track) {
  return track.artist.split(', ')[0]
}

function pairKey(a, b) {
  return [a, b].sort().join('__')
}

export default function TasteMap() {
  const { connected, user } = useAuth()
  const [entries, setEntries] = useState(null)
  const [genreByArtist, setGenreByArtist] = useState(new Map())
  const [selectedIds, setSelectedIds] = useState([])
  const [listeners, setListeners] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return
    getUserTasteEntries(user.id).then(setEntries).catch((err) => setError(err.message))
  }, [user])

  const graph = useMemo(() => (entries ? buildTasteGraph(entries) : null), [entries])
  const entryById = useMemo(() => new Map((entries ?? []).map((e) => [e.track.id, e])), [entries])

  useEffect(() => {
    if (!graph || !isLastfmConfigured) return
    getGenresForArtists(graph.nodes.map((n) => primaryArtist(n.track))).then(setGenreByArtist)
  }, [graph])

  const coloredNodes = useMemo(() => {
    if (!graph) return []
    if (!isLastfmConfigured) return graph.nodes
    return graph.nodes.map((n) => {
      const genre = genreByArtist.get(primaryArtist(n.track)) ?? null
      return { ...n, genre, color: genreColor(genre) }
    })
  }, [graph, genreByArtist])

  const nodeById = useMemo(() => new Map(coloredNodes.map((n) => [n.id, n])), [coloredNodes])

  // One "hub" per genre, everyone else in that genre connects to it — sub-clusters without
  // an O(n²) explosion of lines when lots of tracks share a genre.
  const genreEdges = useMemo(() => {
    if (!isLastfmConfigured) return []
    const byGenre = new Map()
    for (const n of coloredNodes) {
      if (!n.genre) continue
      if (!byGenre.has(n.genre)) byGenre.set(n.genre, [])
      byGenre.get(n.genre).push(n)
    }
    const edges = []
    for (const group of byGenre.values()) {
      if (group.length < 2) continue
      const hub = group.reduce((max, n) => (n.weight > max.weight ? n : max), group[0])
      for (const n of group) {
        if (n.id !== hub.id) edges.push({ source: hub.id, target: n.id, kind: 'genre' })
      }
    }
    return edges
  }, [coloredNodes])

  const allEdges = useMemo(() => {
    if (!graph) return []
    const seen = new Set(graph.edges.map((e) => pairKey(e.source, e.target)))
    const extra = genreEdges.filter((e) => !seen.has(pairKey(e.source, e.target)))
    return [...graph.edges, ...extra]
  }, [graph, genreEdges])

  const genreLegend = useMemo(() => {
    const seen = new Map()
    for (const n of coloredNodes) {
      if (n.genre && !seen.has(n.genre)) seen.set(n.genre, n.color)
    }
    return [...seen.entries()]
  }, [coloredNodes])

  useEffect(() => {
    if (selectedIds.length !== 1 || !user) {
      setListeners(null)
      return
    }
    setListeners(null)
    listListenersForTrack(selectedIds[0], user.id).then(setListeners).catch(() => setListeners([]))
  }, [selectedIds, user])

  function handleSelect(track) {
    setSelectedIds((prev) => {
      if (prev.includes(track.id)) return prev
      return [...prev, track.id].slice(-2)
    })
  }

  if (!connected) return <Navigate to="/" replace />

  const single = selectedIds.length === 1 ? entryById.get(selectedIds[0]) : null
  const pair = selectedIds.length === 2 ? selectedIds.map((id) => nodeById.get(id)) : null

  let connectionKind = null
  let sharedArtists = []
  let sharedAlbum = null
  let sharedGenre = null
  if (pair && pair[0] && pair[1]) {
    const [a, b] = pair
    const artistsA = a.track.artist.split(', ')
    const artistsB = b.track.artist.split(', ')
    sharedArtists = artistsA.filter((name) => artistsB.includes(name))
    sharedAlbum = a.track.album && a.track.album === b.track.album ? a.track.album : null
    sharedGenre = a.genre && a.genre === b.genre ? a.genre : null
    connectionKind = allEdges.find(
      (e) => pairKey(e.source, e.target) === pairKey(a.id, b.id)
    )?.kind
  }

  return (
    <div className="page taste-map-page">
      <h2>Mapa Musical</h2>
      <p className="dsp-note">
        Cada bolinha é uma música que você já ouviu, avaliou ou postou. As linhas conectam por
        artista, álbum{isLastfmConfigured && ' ou gênero'} em comum — quanto maior a bolinha, mais
        você interagiu com ela.
        {isLastfmConfigured && ' A cor vem do gênero do artista (Last.fm).'} Clique em duas
        músicas pra ver o que conecta elas.
      </p>
      {error && <div className="notice">{error}</div>}

      {!graph && <p>Carregando…</p>}
      {graph && graph.nodes.length === 0 && (
        <p>
          Ainda não tem dados suficientes — ouça, avalie ou poste sobre algumas músicas primeiro.
        </p>
      )}
      {graph && graph.nodes.length > 0 && (
        <>
          <div className="taste-map-wrap">
            <TasteMapCanvas
              nodes={coloredNodes}
              edges={allEdges}
              selectedIds={selectedIds}
              onNodeClick={handleSelect}
            />
          </div>
          <div className="taste-map-toolbar">
            {genreLegend.length > 0 && (
              <div className="genre-legend">
                {genreLegend.map(([genre, color]) => (
                  <span key={genre} className="genre-legend-item">
                    <span className="genre-dot" style={{ background: color }} />
                    {genre}
                  </span>
                ))}
              </div>
            )}
            {selectedIds.length > 0 && (
              <button className="btn-ghost" onClick={() => setSelectedIds([])}>
                Limpar seleção
              </button>
            )}
          </div>
        </>
      )}

      {pair && pair[0] && pair[1] && (
        <div className="taste-map-selected">
          <h3>O que conecta essas duas</h3>
          <div className="compare-tracks">
            <TrackRow track={pair[0].track} />
            <TrackRow track={pair[1].track} />
          </div>
          <ul className="connection-list">
            {sharedArtists.length > 0 && <li>Mesmo artista: {sharedArtists.join(', ')}</li>}
            {sharedAlbum && <li>Mesmo álbum: {sharedAlbum}</li>}
            {sharedGenre && <li>Mesmo gênero: {sharedGenre}</li>}
            {!sharedArtists.length && !sharedAlbum && !sharedGenre && (
              <li>Nenhuma conexão direta — músicas independentes no seu mapa.</li>
            )}
          </ul>
          {!connectionKind && (sharedArtists.length > 0 || sharedAlbum || sharedGenre) && (
            <p className="dsp-note">(conexão indireta — não aparece como linha no mapa)</p>
          )}
        </div>
      )}

      {single && (
        <div className="taste-map-selected">
          <TrackRow
            track={single.track}
            actions={
              <Link className="btn-ghost" to={`/track/${single.track.id}`}>
                Ver música
              </Link>
            }
          />

          <div className="taste-detail-grid">
            <div className="taste-detail-item">
              <span className="track-meta">Vezes ouvida</span>
              <strong>{single.playCount}</strong>
            </div>
            {single.lastPlayedAt && (
              <div className="taste-detail-item">
                <span className="track-meta">Última vez</span>
                <strong>{formatTime(single.lastPlayedAt)}</strong>
              </div>
            )}
            {single.rating && (
              <div className="taste-detail-item">
                <span className="track-meta">Sua nota</span>
                <strong>{'★'.repeat(single.rating)}{'☆'.repeat(5 - single.rating)}</strong>
              </div>
            )}
            {single.posted && (
              <div className="taste-detail-item">
                <span className="track-meta">Status</span>
                <strong>Você postou sobre ela</strong>
              </div>
            )}
          </div>

          {single.reviewBody && <p className="taste-review-quote">"{single.reviewBody}"</p>}

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
