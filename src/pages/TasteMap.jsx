import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserTasteEntries, buildTasteGraph, computeCompatibility } from '../lib/tasteGraphApi'
import { listListenersForTrack } from '../lib/listeningHistoryApi'
import { listFriendships } from '../lib/friendsApi'
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

// Collapses two people's entries into one lookup, merging stats for tracks both interacted with.
function mergeEntriesById(entriesList) {
  const map = new Map()
  for (const e of entriesList) {
    const existing = map.get(e.track.id)
    if (!existing) {
      map.set(e.track.id, { ...e })
      continue
    }
    existing.playCount += e.playCount
    if (!existing.rating && e.rating) existing.rating = e.rating
    if (!existing.reviewBody && e.reviewBody) existing.reviewBody = e.reviewBody
    existing.posted = existing.posted || e.posted
    if (!existing.lastPlayedAt || (e.lastPlayedAt && e.lastPlayedAt > existing.lastPlayedAt)) {
      existing.lastPlayedAt = e.lastPlayedAt
    }
  }
  return map
}

export default function TasteMap() {
  const { connected, user } = useAuth()
  const [entries, setEntries] = useState(null)
  const [friends, setFriends] = useState([])
  const [compareFriendId, setCompareFriendId] = useState('')
  const [friendEntries, setFriendEntries] = useState([])
  const [genreByArtist, setGenreByArtist] = useState(new Map())
  const [selectedIds, setSelectedIds] = useState([])
  const [listeners, setListeners] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return
    getUserTasteEntries(user.id).then(setEntries).catch((err) => setError(err.message))
    listFriendships(user.id)
      .then((all) => setFriends(all.filter((f) => f.status === 'accepted')))
      .catch(() => {})
  }, [user])

  useEffect(() => {
    if (!compareFriendId) {
      setFriendEntries([])
      return
    }
    getUserTasteEntries(compareFriendId).then(setFriendEntries).catch((err) => setError(err.message))
  }, [compareFriendId])

  const comparing = Boolean(compareFriendId)
  const friendProfile = friends.find((f) => f.profile.id === compareFriendId)?.profile

  const combinedEntries = useMemo(() => {
    if (!entries) return null
    if (!comparing) return entries
    return [
      ...entries.map((e) => ({ ...e, owner: 'me' })),
      ...friendEntries.map((e) => ({ ...e, owner: 'friend' })),
    ]
  }, [entries, friendEntries, comparing])

  const compatibility = useMemo(() => {
    if (!comparing || !entries || friendEntries.length === 0) return null
    return computeCompatibility(entries, friendEntries)
  }, [comparing, entries, friendEntries])

  const graph = useMemo(() => (combinedEntries ? buildTasteGraph(combinedEntries) : null), [combinedEntries])
  const entryById = useMemo(() => mergeEntriesById(combinedEntries ?? []), [combinedEntries])

  useEffect(() => {
    if (!graph || !isLastfmConfigured || comparing) return
    getGenresForArtists(graph.nodes.map((n) => primaryArtist(n.track))).then(setGenreByArtist)
  }, [graph, comparing])

  const coloredNodes = useMemo(() => {
    if (!graph) return []
    if (!isLastfmConfigured || comparing) return graph.nodes
    return graph.nodes.map((n) => {
      const genre = genreByArtist.get(primaryArtist(n.track)) ?? null
      return { ...n, genre, color: genreColor(genre) }
    })
  }, [graph, genreByArtist, comparing])

  const nodeById = useMemo(() => new Map(coloredNodes.map((n) => [n.id, n])), [coloredNodes])

  // One "hub" per genre, everyone else in that genre connects to it — sub-clusters without
  // an O(n²) explosion of lines when lots of tracks share a genre.
  const genreEdges = useMemo(() => {
    if (!isLastfmConfigured || comparing) return []
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
  }, [coloredNodes, comparing])

  const allEdges = useMemo(() => {
    if (!graph) return []
    const seen = new Set(graph.edges.map((e) => pairKey(e.source, e.target)))
    const extra = genreEdges.filter((e) => !seen.has(pairKey(e.source, e.target)))
    return [...graph.edges, ...extra]
  }, [graph, genreEdges])

  const genreLegend = useMemo(() => {
    if (comparing) return []
    const seen = new Map()
    for (const n of coloredNodes) {
      if (n.genre && !seen.has(n.genre)) seen.set(n.genre, n.color)
    }
    return [...seen.entries()]
  }, [coloredNodes, comparing])

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
    connectionKind = allEdges.find((e) => pairKey(e.source, e.target) === pairKey(a.id, b.id))?.kind
  }

  return (
    <div className="page taste-map-page">
      <h2>Mapa Musical</h2>
      <p className="dsp-note">
        Cada bolinha é uma música que você já ouviu, avaliou ou postou. As linhas conectam por
        artista, álbum{isLastfmConfigured && !comparing && ' ou gênero'} em comum — quanto maior a
        bolinha, mais interação. Clique em duas músicas pra ver o que conecta elas.
      </p>
      {error && <div className="notice">{error}</div>}

      {friends.length > 0 && (
        <div className="compare-picker">
          <label>
            Comparar com:{' '}
            <select value={compareFriendId} onChange={(e) => setCompareFriendId(e.target.value)}>
              <option value="">Só o meu mapa</option>
              {friends.map((f) => (
                <option key={f.profile.id} value={f.profile.id}>
                  {f.profile.display_name || f.profile.username}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {comparing && compatibility && (
        <div className="compat-card">
          <div className="compat-percent">{compatibility.percent}%</div>
          <div>
            <div>
              compatibilidade musical com <strong>{friendProfile?.display_name || friendProfile?.username}</strong>
            </div>
            <div className="track-meta">
              {compatibility.sharedTracks} música{compatibility.sharedTracks !== 1 ? 's' : ''} e{' '}
              {compatibility.sharedArtists} artista{compatibility.sharedArtists !== 1 ? 's' : ''} em comum
            </div>
          </div>
        </div>
      )}
      {comparing && !compatibility && <p>Calculando compatibilidade…</p>}

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
            {comparing && (
              <div className="genre-legend">
                <span className="genre-legend-item">
                  <span className="genre-dot" style={{ background: 'var(--accent)' }} /> só você
                </span>
                <span className="genre-legend-item">
                  <span className="genre-dot" style={{ background: '#c084fc' }} /> só{' '}
                  {friendProfile?.display_name || friendProfile?.username}
                </span>
                <span className="genre-legend-item">
                  <span className="genre-dot" style={{ background: '#f2b705' }} /> os dois
                </span>
              </div>
            )}
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
                <span className="track-meta">Nota</span>
                <strong>{'★'.repeat(single.rating)}{'☆'.repeat(5 - single.rating)}</strong>
              </div>
            )}
            {single.posted && (
              <div className="taste-detail-item">
                <span className="track-meta">Status</span>
                <strong>Postado no feed</strong>
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
