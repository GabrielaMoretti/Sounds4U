import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listFriendships } from '../lib/friendsApi'
import { getProfileByUsername } from '../lib/profilesApi'
import { listThread, listLastMessages, sendMessage, subscribeToThread } from '../lib/messagesApi'

function formatTime(iso) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function ConversationList({ user }) {
  const [friends, setFriends] = useState([])
  const [lastByFriend, setLastByFriend] = useState({})
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return
    listFriendships(user.id)
      .then((all) => {
        const accepted = all.filter((f) => f.status === 'accepted')
        setFriends(accepted)
        return listLastMessages(
          user.id,
          accepted.map((f) => f.profile.id)
        )
      })
      .then(setLastByFriend)
      .catch((err) => setError(err.message))
  }, [user])

  return (
    <div className="page">
      <h2>Mensagens</h2>
      {error && <div className="notice">{error}</div>}
      {friends.length === 0 && (
        <p>
          Você ainda não tem amigos pra conversar. Adicione alguém na aba{' '}
          <Link to="/friends">Amigos</Link>.
        </p>
      )}
      <div className="track-list">
        {friends.map((f) => {
          const last = lastByFriend[f.profile.id]
          return (
            <Link key={f.profile.id} to={`/messages/${f.profile.username}`} className="track-row">
              <div className="track-info">
                <div className="track-name">{f.profile.display_name || f.profile.username}</div>
                <div className="track-meta">{last ? last.body : 'sem mensagens ainda'}</div>
              </div>
              {last && <span className="track-meta">{formatTime(last.created_at)}</span>}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function Thread({ user, username }) {
  const [otherProfile, setOtherProfile] = useState(undefined)
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    getProfileByUsername(username).then(setOtherProfile).catch((err) => setError(err.message))
  }, [username])

  useEffect(() => {
    if (!user || !otherProfile) return
    listThread(user.id, otherProfile.id).then(setMessages).catch((err) => setError(err.message))
    return subscribeToThread(user.id, otherProfile.id, (msg) => setMessages((prev) => [...prev, msg]))
  }, [user, otherProfile])

  async function handleSend() {
    if (!body.trim() || !user || !otherProfile) return
    try {
      const sent = await sendMessage(user.id, otherProfile.id, body.trim())
      setMessages((prev) => [...prev, sent])
      setBody('')
    } catch (err) {
      setError(err.message)
    }
  }

  if (otherProfile === undefined) return <div className="page">Carregando…</div>
  if (otherProfile === null) return <div className="page">Usuário não encontrado.</div>

  return (
    <div className="page">
      <p className="dsp-note">
        <Link to="/messages">← Mensagens</Link>
      </p>
      <h2>{otherProfile.display_name || otherProfile.username}</h2>
      {error && <div className="notice">{error}</div>}

      <div className="thread">
        {messages.map((m) => (
          <div key={m.id} className={`bubble${m.sender_id === user.id ? ' mine' : ''}`}>
            <p>{m.body}</p>
            <span className="track-meta">{formatTime(m.created_at)}</span>
          </div>
        ))}
        {messages.length === 0 && <p>Nenhuma mensagem ainda — diga oi.</p>}
      </div>

      <form
        className="add-friend-form"
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
      >
        <input
          className="search-input"
          placeholder="Escreva uma mensagem…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button className="btn-primary" type="submit" disabled={!body.trim()}>
          Enviar
        </button>
      </form>
    </div>
  )
}

export default function Messages() {
  const { user } = useAuth()
  const { username } = useParams()

  if (!user) return null
  return username ? <Thread user={user} username={username} /> : <ConversationList user={user} />
}
