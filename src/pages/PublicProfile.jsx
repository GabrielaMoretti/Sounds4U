import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getProfileByUsername } from '../lib/profilesApi'
import { listUserReviews } from '../lib/reviewsApi'
import { getFriendship, sendFriendRequest, acceptFriendRequest } from '../lib/friendsApi'
import TrackRow from '../components/TrackRow'

export default function PublicProfile() {
  const { username } = useParams()
  const { user } = useAuth()
  const [profile, setProfile] = useState(undefined) // undefined = loading, null = not found
  const [reviews, setReviews] = useState([])
  const [friendship, setFriendship] = useState(null)
  const [error, setError] = useState(null)

  function refresh() {
    getProfileByUsername(username)
      .then((p) => {
        setProfile(p)
        if (p) {
          listUserReviews(p.id).then(setReviews).catch(() => {})
          if (user && user.id !== p.id) {
            getFriendship(user.id, p.id).then(setFriendship).catch(() => {})
          }
        }
      })
      .catch((err) => setError(err.message))
  }

  useEffect(refresh, [username, user])

  async function handleAddFriend() {
    if (!user || !profile) return
    await sendFriendRequest(user.id, profile.id)
    refresh()
  }

  async function handleAccept() {
    if (!friendship) return
    await acceptFriendRequest(friendship.requesterId, friendship.addresseeId)
    refresh()
  }

  if (profile === undefined) return <div className="page">Carregando…</div>
  if (profile === null) return <div className="page">Usuário não encontrado.</div>

  const isSelf = user?.id === profile.id

  return (
    <div className="page">
      {error && <div className="notice">{error}</div>}

      <div className="profile-header">
        {profile.avatar_url ? (
          <img className="avatar-preview" src={profile.avatar_url} alt="" />
        ) : (
          <div className="avatar-preview placeholder" />
        )}
        <div>
          <h2>{profile.display_name || profile.username}</h2>
          <p className="dsp-note">@{profile.username}</p>
        </div>
      </div>

      {profile.bio && <p>{profile.bio}</p>}

      {profile.social_links?.length > 0 && (
        <div className="social-links">
          {profile.social_links.map((l, i) => (
            <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="btn-ghost">
              {l.platform}
            </a>
          ))}
        </div>
      )}

      {isSelf && (
        <p className="dsp-note">
          <Link to="/profile">Editar seu perfil</Link>
        </p>
      )}

      {!isSelf && user && (
        <div className="profile-actions">
          {!friendship && (
            <button className="btn-primary" onClick={handleAddFriend}>
              Adicionar amigo
            </button>
          )}
          {friendship?.awaitingThem && <span className="track-meta">convite enviado</span>}
          {friendship?.awaitingMe && (
            <button className="btn-primary" onClick={handleAccept}>
              Aceitar pedido de amizade
            </button>
          )}
          {friendship?.status === 'accepted' && (
            <Link className="btn-ghost" to={`/messages/${profile.username}`}>
              Mandar mensagem
            </Link>
          )}
        </div>
      )}

      <h3>Reviews</h3>
      {reviews.length === 0 && <p>Nenhuma review ainda.</p>}
      <div className="track-list">
        {reviews.map((r) => (
          <TrackRow
            key={r.id}
            track={r.track}
            linkTo={`/track/${r.trackId}`}
            meta={`${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}${r.body ? ` — ${r.body}` : ''}`}
          />
        ))}
      </div>
    </div>
  )
}
