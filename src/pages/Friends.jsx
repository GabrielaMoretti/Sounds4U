import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { searchProfiles } from '../lib/profilesApi'
import {
  listFriendships,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriendship,
} from '../lib/friendsApi'

export default function Friends() {
  const { user, profile } = useAuth()
  const [friendships, setFriendships] = useState([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const inviteLink = profile
    ? `${window.location.origin}/?convidado_por=${encodeURIComponent(profile.username)}`
    : window.location.origin

  function refresh() {
    if (!user) return
    listFriendships(user.id).then(setFriendships).catch((err) => setError(err.message))
  }

  useEffect(refresh, [user])

  useEffect(() => {
    if (!query.trim() || !user) {
      setResults([])
      return
    }
    const handle = setTimeout(() => {
      searchProfiles(query, user.id).then(setResults).catch((err) => setError(err.message))
    }, 300)
    return () => clearTimeout(handle)
  }, [query, user])

  async function handleCopyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Não consegui copiar o link — copie manualmente: ' + inviteLink)
    }
  }

  async function handleSendRequest(targetUserId) {
    try {
      await sendFriendRequest(user.id, targetUserId)
      setQuery('')
      setResults([])
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAccept(f) {
    await acceptFriendRequest(f.requesterId, f.addresseeId)
    refresh()
  }

  async function handleRemove(f) {
    await removeFriendship(f.requesterId, f.addresseeId)
    refresh()
  }

  const alreadyConnectedIds = new Set(friendships.map((f) => f.profile.id))
  const searchedButEmpty = query.trim().length > 0 && results.length === 0

  return (
    <div className="page">
      <h2>Amigos</h2>
      {profile && (
        <p className="dsp-note">
          Seu usuário: <strong>{profile.username}</strong>
        </p>
      )}
      {error && <div className="notice">{error}</div>}

      <div className="invite-box">
        <span className="invite-link">{inviteLink}</span>
        <button className="btn-ghost" onClick={handleCopyInvite}>
          {copied ? 'Copiado!' : 'Copiar link de convite'}
        </button>
      </div>

      <p className="dsp-note">
        O Spotify não deixa ler a lista de amigos de ninguém por API — só o app oficial deles faz
        isso. Busque pelo username de quem você quer adicionar; se a pessoa ainda não tiver conta
        aqui, manda o link de convite acima.
      </p>

      <form className="add-friend-form" onSubmit={(e) => e.preventDefault()}>
        <input
          className="search-input"
          placeholder="Buscar por username…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      {results.length > 0 && (
        <div className="track-list">
          {results.map((p) => (
            <div key={p.id} className="track-row">
              <Link to={`/u/${p.username}`} className="track-info">
                <div className="track-name">{p.display_name || p.username}</div>
                <div className="track-meta">@{p.username}</div>
              </Link>
              <div className="track-actions">
                {alreadyConnectedIds.has(p.id) ? (
                  <span className="track-meta">já conectados</span>
                ) : (
                  <button className="btn-ghost" onClick={() => handleSendRequest(p.id)}>
                    Adicionar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {searchedButEmpty && (
        <div className="track-row">
          <div className="track-info">
            <div className="track-name">Ninguém com esse username ainda</div>
            <div className="track-meta">Convide essa pessoa pra criar conta no Sounds4U</div>
          </div>
          <div className="track-actions">
            <button className="btn-ghost" onClick={handleCopyInvite}>
              {copied ? 'Copiado!' : 'Convidar'}
            </button>
          </div>
        </div>
      )}

      <div className="track-list">
        {friendships.length === 0 && <p>Nenhum amigo ainda — busque por username acima.</p>}
        {friendships.map((f) => (
          <div key={`${f.requesterId}-${f.addresseeId}`} className="track-row">
            <Link to={`/u/${f.profile.username}`} className="track-info">
              <div className="track-name">{f.profile.display_name || f.profile.username}</div>
              <div className="track-meta">
                @{f.profile.username} ·{' '}
                {f.status === 'accepted' ? 'amigos' : f.awaitingMe ? 'pediu amizade' : 'convite enviado'}
              </div>
            </Link>
            <div className="track-actions">
              {f.status === 'accepted' && (
                <Link className="btn-ghost" to={`/messages/${f.profile.username}`}>
                  Mensagem
                </Link>
              )}
              {f.awaitingMe && (
                <button className="btn-ghost" onClick={() => handleAccept(f)}>
                  Aceitar
                </button>
              )}
              <button className="btn-ghost" onClick={() => handleRemove(f)}>
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
