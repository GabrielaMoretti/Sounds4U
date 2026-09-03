import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import { listNotifications, markAllRead } from '../lib/notificationsApi'

function formatTime(iso) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function describe(n) {
  const name = n.actor?.display_name || n.actor?.username || 'alguém'
  switch (n.type) {
    case 'like':
      return `${name} curtiu seu post`
    case 'comment':
      return `${name} comentou no seu post`
    case 'friend_request':
      return `${name} te enviou um pedido de amizade`
    case 'friend_accept':
      return `${name} aceitou seu pedido de amizade`
    case 'message':
      return `${name} te mandou uma mensagem`
    case 'mention':
      return `${name} te marcou num post`
    default:
      return `${name} interagiu com você`
  }
}

function linkFor(n) {
  switch (n.type) {
    case 'like':
    case 'comment':
    case 'mention':
      return n.postId ? `/post/${n.postId}` : '#'
    case 'friend_request':
      return '/friends'
    case 'friend_accept':
      return n.actor ? `/u/${n.actor.username}` : '/friends'
    case 'message':
      return n.actor ? `/messages/${n.actor.username}` : '/messages'
    default:
      return '#'
  }
}

export default function Notifications() {
  const { connected, user } = useAuth()
  const { refresh } = useNotifications()
  const [items, setItems] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return
    listNotifications(user.id)
      .then(setItems)
      .catch((err) => setError(err.message))
    markAllRead(user.id)
      .then(refresh)
      .catch(() => {})
  }, [user])

  if (!connected) return <Navigate to="/" replace />

  return (
    <div className="page">
      <h2>Notificações</h2>
      {error && <div className="notice">{error}</div>}
      {items.length === 0 && <p>Nenhuma notificação ainda.</p>}
      <div className="track-list">
        {items.map((n) => (
          <Link key={n.id} to={linkFor(n)} className={`track-row notification-row${!n.readAt ? ' unread' : ''}`}>
            <div className="track-info">
              <div className="track-name">{describe(n)}</div>
              <div className="track-meta">{formatTime(n.createdAt)}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
