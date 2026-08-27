import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listAcceptedFriendIds } from '../lib/friendsApi'
import { listFeed, createPost, getEngagement } from '../lib/postsApi'
import TrackPicker from '../components/TrackPicker'
import FeedPost from '../components/FeedPost'

export default function Feed() {
  const { connected, user } = useAuth()
  const [track, setTrack] = useState(null)
  const [body, setBody] = useState('')
  const [posts, setPosts] = useState([])
  const [engagement, setEngagement] = useState({})
  const [error, setError] = useState(null)
  const [needsReauth, setNeedsReauth] = useState(false)
  const [posting, setPosting] = useState(false)

  async function refresh() {
    if (!user) return
    try {
      const friendIds = await listAcceptedFriendIds(user.id)
      const feedPosts = await listFeed([user.id, ...friendIds])
      setPosts(feedPosts)
      setEngagement(await getEngagement(feedPosts.map((p) => p.id), user.id))
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    refresh()
  }, [user])

  async function handlePost() {
    if (!track || !body.trim() || !user) return
    setPosting(true)
    try {
      await createPost({ userId: user.id, track, body: body.trim() })
      setTrack(null)
      setBody('')
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setPosting(false)
    }
  }

  if (!connected) return <Navigate to="/" replace />

  return (
    <div className="page">
      <h2>Feed</h2>
      {error && <div className="notice">{error}</div>}
      {needsReauth && (
        <div className="notice">Sessão do Spotify expirou — reconecte na aba Histórico.</div>
      )}

      <section className="review-composer">
        <h3>Postar sobre uma música</h3>
        <TrackPicker
          userId={user?.id}
          selectedTrack={track}
          onSelect={setTrack}
          onReauthRequired={() => setNeedsReauth(true)}
        />
        {track && (
          <div className="review-form">
            <textarea
              placeholder="O que você tem a dizer sobre essa música?"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
            />
            <button className="btn-primary" disabled={!body.trim() || posting} onClick={handlePost}>
              Postar
            </button>
          </div>
        )}
      </section>

      <section>
        {posts.length === 0 && <p>Nada por aqui ainda — adicione amigos ou seja o primeiro a postar.</p>}
        {posts.map((p) => (
          <FeedPost key={p.id} post={p} userId={user.id} engagement={engagement[p.id]} onChanged={refresh} />
        ))}
      </section>
    </div>
  )
}
