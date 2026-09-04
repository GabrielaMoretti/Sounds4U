import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getProfileByUsername } from '../lib/profilesApi'
import { listUserReviews } from '../lib/reviewsApi'
import { listFeed, getEngagement } from '../lib/postsApi'
import { listOspnmForUsers } from '../lib/ospnmApi'
import { getFriendship, sendFriendRequest, acceptFriendRequest } from '../lib/friendsApi'
import { listCommonTracks } from '../lib/listeningHistoryApi'
import FeedPost from '../components/FeedPost'
import FeedReviewItem from '../components/FeedReviewItem'
import FeedOspnmItem from '../components/FeedOspnmItem'
import TrackRow from '../components/TrackRow'

export default function PublicProfile() {
  const { username } = useParams()
  const { user } = useAuth()
  const [profile, setProfile] = useState(undefined) // undefined = loading, null = not found
  const [items, setItems] = useState([])
  const [engagement, setEngagement] = useState({})
  const [friendship, setFriendship] = useState(null)
  const [commonTracks, setCommonTracks] = useState([])
  const [error, setError] = useState(null)

  function refresh() {
    getProfileByUsername(username)
      .then(async (p) => {
        setProfile(p)
        if (!p) return

        const [posts, reviews, ospnm] = await Promise.all([
          listFeed([p.id]),
          listUserReviews(p.id),
          listOspnmForUsers([p.id]),
        ])
        const merged = [...posts, ...reviews, ...ospnm].sort(
          (a, b) => new Date(b.createdAt ?? b.updatedAt) - new Date(a.createdAt ?? a.updatedAt)
        )
        setItems(merged)
        if (user) setEngagement(await getEngagement(posts.map((post) => post.id), user.id))

        if (user && user.id !== p.id) {
          const f = await getFriendship(user.id, p.id).catch(() => null)
          setFriendship(f)
          if (f?.status === 'accepted') {
            listCommonTracks(user.id, p.id).then(setCommonTracks).catch(() => {})
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

      {friendship?.status === 'accepted' && commonTracks.length > 0 && (
        <>
          <h3>Músicas em comum ({commonTracks.length})</h3>
          <div className="track-list">
            {commonTracks.map((t) => (
              <TrackRow key={t.id} track={t} linkTo={`/track/${t.id}`} />
            ))}
          </div>
        </>
      )}

      <h3>Atividade</h3>
      {items.length === 0 && <p>Nada por aqui ainda.</p>}
      {items.map((item) => {
        if (item.type === 'review') return <FeedReviewItem key={`review-${item.id}`} review={item} />
        if (item.type === 'ospnm') return <FeedOspnmItem key={`ospnm-${item.id}`} entry={item} />
        return (
          <FeedPost
            key={`post-${item.id}`}
            post={item}
            userId={user?.id}
            engagement={engagement[item.id]}
            onChanged={refresh}
          />
        )
      })}
    </div>
  )
}
