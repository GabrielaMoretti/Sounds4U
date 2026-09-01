import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listAcceptedFriendIds } from '../lib/friendsApi'
import { listFeed, createPost, getEngagement } from '../lib/postsApi'
import { listReviewsForUsers, upsertReview } from '../lib/reviewsApi'
import TrackPicker from '../components/TrackPicker'
import FeedPost from '../components/FeedPost'
import FeedReviewItem from '../components/FeedReviewItem'
import Stars from '../components/Stars'

function mergeSorted(posts, reviews) {
  return [...posts, ...reviews].sort(
    (a, b) => new Date(b.createdAt ?? b.updatedAt) - new Date(a.createdAt ?? a.updatedAt)
  )
}

export default function Feed() {
  const { connected, user } = useAuth()
  const [scope, setScope] = useState('friends') // 'friends' | 'discover'
  const [autoSwitched, setAutoSwitched] = useState(false)
  const [mode, setMode] = useState('post') // 'post' | 'review'
  const [track, setTrack] = useState(null)
  const [body, setBody] = useState('')
  const [rating, setRating] = useState(0)
  const [items, setItems] = useState([])
  const [engagement, setEngagement] = useState({})
  const [error, setError] = useState(null)
  const [needsReauth, setNeedsReauth] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function refresh() {
    if (!user) return
    try {
      const ids = scope === 'friends' ? [user.id, ...(await listAcceptedFriendIds(user.id))] : null
      const [feedPosts, feedReviews] = await Promise.all([listFeed(ids), listReviewsForUsers(ids)])
      setItems(mergeSorted(feedPosts, feedReviews))
      setEngagement(await getEngagement(feedPosts.map((p) => p.id), user.id))

      // First time we see an empty friends feed, nudge to Descobrir so new users aren't
      // staring at a blank page.
      if (scope === 'friends' && feedPosts.length === 0 && feedReviews.length === 0 && !autoSwitched) {
        setAutoSwitched(true)
        setScope('discover')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    refresh()
  }, [user, scope])

  function resetComposer() {
    setTrack(null)
    setBody('')
    setRating(0)
  }

  async function handleSubmit() {
    if (!track || !user) return
    if (mode === 'review' && rating === 0) return
    if (mode === 'post' && !body.trim()) return

    setSubmitting(true)
    try {
      if (mode === 'review') {
        await upsertReview({ userId: user.id, track, rating, body })
      } else {
        await createPost({ userId: user.id, track, body: body.trim() })
      }
      resetComposer()
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!connected) return <Navigate to="/" replace />

  const submitDisabled = submitting || (mode === 'review' ? rating === 0 : !body.trim())

  return (
    <div className="page">
      <h2>Feed</h2>
      {error && <div className="notice">{error}</div>}
      {needsReauth && (
        <div className="notice">Sessão do Spotify expirou — reconecte na aba Histórico.</div>
      )}

      <section className="review-composer">
        <div className="mode-toggle">
          <button
            type="button"
            className={`mode-toggle-btn${mode === 'post' ? ' active' : ''}`}
            onClick={() => setMode('post')}
          >
            Post
          </button>
          <button
            type="button"
            className={`mode-toggle-btn${mode === 'review' ? ' active' : ''}`}
            onClick={() => setMode('review')}
          >
            Review
          </button>
        </div>

        <TrackPicker
          userId={user?.id}
          selectedTrack={track}
          onSelect={setTrack}
          onReauthRequired={() => setNeedsReauth(true)}
        />
        {track && (
          <div className="review-form">
            {mode === 'review' && <Stars value={rating} onChange={setRating} />}
            <textarea
              placeholder={mode === 'review' ? 'O que você achou?' : 'O que você tem a dizer sobre essa música?'}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
            />
            <button className="btn-primary" disabled={submitDisabled} onClick={handleSubmit}>
              {mode === 'review' ? 'Salvar review' : 'Postar'}
            </button>
          </div>
        )}
      </section>

      <div className="mode-toggle">
        <button
          type="button"
          className={`mode-toggle-btn${scope === 'friends' ? ' active' : ''}`}
          onClick={() => setScope('friends')}
        >
          Amigos
        </button>
        <button
          type="button"
          className={`mode-toggle-btn${scope === 'discover' ? ' active' : ''}`}
          onClick={() => setScope('discover')}
        >
          Descobrir
        </button>
      </div>

      <section>
        {items.length === 0 && scope === 'friends' && (
          <p>Nada dos seus amigos ainda — adicione alguém ou dá uma olhada em Descobrir.</p>
        )}
        {items.length === 0 && scope === 'discover' && <p>Ninguém postou nada ainda.</p>}
        {items.map((item) =>
          item.type === 'review' ? (
            <FeedReviewItem key={`review-${item.id}`} review={item} />
          ) : (
            <FeedPost key={`post-${item.id}`} post={item} userId={user.id} engagement={engagement[item.id]} onChanged={refresh} />
          )
        )}
      </section>
    </div>
  )
}
