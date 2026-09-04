import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getRoleSuggestions, listMyOspnm, upsertOspnm, deleteOspnm } from '../lib/ospnmApi'
import { isLastfmConfigured } from '../lib/lastfmApi'
import { SpotifyReauthRequired } from '../lib/spotify'
import TrackRow from '../components/TrackRow'
import Stars from '../components/Stars'
import Bottles from '../components/Bottles'

export default function Ospnm() {
  const { connected, user, loginWithSpotify } = useAuth()
  const [suggestions, setSuggestions] = useState(null)
  const [selectedTrack, setSelectedTrack] = useState(null)
  const [stars, setStars] = useState(0)
  const [bottles, setBottles] = useState(0)
  const [justification, setJustification] = useState('')
  const [crazinessNote, setCrazinessNote] = useState('')
  const [entries, setEntries] = useState([])
  const [needsReauth, setNeedsReauth] = useState(false)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  function refreshEntries() {
    if (!user) return
    listMyOspnm(user.id).then(setEntries).catch((err) => setError(err.message))
  }

  useEffect(refreshEntries, [user])

  useEffect(() => {
    if (!user) return
    getRoleSuggestions(user.id)
      .then((tracks) => {
        setSuggestions(tracks)
        setNeedsReauth(false)
      })
      .catch((err) => {
        if (err instanceof SpotifyReauthRequired) setNeedsReauth(true)
        else setError(err.message)
        setSuggestions([])
      })
  }, [user])

  function pickTrack(track) {
    setSelectedTrack(track)
    const existing = entries.find((e) => e.trackId === track.id)
    setStars(existing?.stars ?? 0)
    setBottles(existing?.bottles ?? 0)
    setJustification(existing?.justification ?? '')
    setCrazinessNote(existing?.crazinessNote ?? '')
  }

  async function handleSave() {
    if (!selectedTrack || !user) return
    if (stars === 0 || bottles === 0 || !justification.trim() || !crazinessNote.trim()) return
    setSaving(true)
    try {
      await upsertOspnm({
        userId: user.id,
        track: selectedTrack,
        stars,
        bottles,
        justification: justification.trim(),
        crazinessNote: crazinessNote.trim(),
      })
      refreshEntries()
      setSelectedTrack(null)
      setStars(0)
      setBottles(0)
      setJustification('')
      setCrazinessNote('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(trackId) {
    if (!user) return
    await deleteOspnm(user.id, trackId)
    refreshEntries()
  }

  if (!connected) return <Navigate to="/" replace />

  const canSave = stars > 0 && bottles > 0 && justification.trim() && crazinessNote.trim()

  return (
    <div className="page">
      <p className="ospnm-presented-by">Um oferecimento Chope de Vinho Feat Skol Beats</p>
      <h2>OSPNM</h2>
      <p className="dsp-note">
        O Quanto Nós Passamos Nessa Música. Só entra faixa da linha do batidão — funk, eletrofunk
        e afins — puxadas do seu histórico de escuta recente.
      </p>
      {error && <div className="notice">{error}</div>}

      {!isLastfmConfigured && (
        <div className="notice">
          Precisa da Last.fm configurada pra identificar o gênero e filtrar a lista — sem isso não
          arrisco deixar passar música fora da linha.
        </div>
      )}

      {needsReauth && (
        <div className="notice">
          Sessão do Spotify expirou.{' '}
          <button className="btn-ghost" onClick={loginWithSpotify}>
            Reconectar
          </button>
        </div>
      )}

      <section className="review-composer">
        <h3>Nova avaliação de rolê</h3>

        {!selectedTrack && (
          <>
            {suggestions === null && <p>Carregando sugestões…</p>}
            {suggestions && suggestions.length === 0 && isLastfmConfigured && !needsReauth && (
              <p>Nenhuma música do batidão no seu histórico recente ainda — vai ouvir umas paradas e volta aqui.</p>
            )}
            <div className="track-list">
              {suggestions?.map((track) => (
                <div key={track.id} className="track-row-clickable" onClick={() => pickTrack(track)}>
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

            <label className="field-label">
              Quão bom foi se passar
              <Stars value={stars} onChange={setStars} />
            </label>

            <label className="field-label">
              Nível de bebida
              <Bottles value={bottles} onChange={setBottles} />
            </label>

            <label className="field-label">
              Justificativa das estrelinhas (de forma cômica, obrigatório)
              <textarea
                placeholder="Por que essa nota, com detalhes e drama…"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={3}
              />
            </label>

            <label className="field-label">
              Nível de loucura do álcool (obrigatório)
              <textarea
                placeholder="Descreve em poucas palavras o quão loco você tava…"
                value={crazinessNote}
                onChange={(e) => setCrazinessNote(e.target.value)}
                rows={2}
              />
            </label>

            <button className="btn-primary" disabled={!canSave || saving} onClick={handleSave}>
              Salvar
            </button>
          </div>
        )}
      </section>

      <section>
        <h3>Suas OSPNM</h3>
        {entries.length === 0 && <p>Nenhuma avaliação de rolê ainda.</p>}
        <div className="track-list">
          {entries.map((e) => (
            <div key={e.id} className="ospnm-entry">
              <TrackRow
                track={e.track}
                actions={
                  <>
                    <button className="btn-ghost" onClick={() => pickTrack(e.track)}>
                      Editar
                    </button>
                    <button className="btn-ghost" onClick={() => handleRemove(e.trackId)}>
                      Excluir
                    </button>
                  </>
                }
              />
              <div className="ospnm-entry-meta">
                <span>{'★'.repeat(e.stars)}{'☆'.repeat(5 - e.stars)}</span>
                <span>{'🍾'.repeat(e.bottles)}</span>
              </div>
              <p className="taste-review-quote">"{e.justification}"</p>
              <p className="dsp-note">Nível de loucura: {e.crazinessNote}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
