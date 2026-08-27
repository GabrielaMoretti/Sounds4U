import { useState } from 'react'
import { Link } from 'react-router-dom'
import TrackRow from './TrackRow'
import {
  likePost,
  unlikePost,
  listComments,
  addComment,
  deleteComment as deleteCommentApi,
  deletePost as deletePostApi,
} from '../lib/postsApi'

function formatTime(iso) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function FeedPost({ post, userId, engagement, onChanged }) {
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState(null) // null = not loaded yet
  const [commentBody, setCommentBody] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const liked = engagement?.likedByMe ?? false
  const likeCount = engagement?.likeCount ?? 0
  const commentCount = engagement?.commentCount ?? 0

  async function toggleLike() {
    if (busy) return
    setBusy(true)
    try {
      if (liked) await unlikePost(post.id, userId)
      else await likePost(post.id, userId)
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function toggleComments() {
    const next = !showComments
    setShowComments(next)
    if (next && comments === null) setComments(await listComments(post.id))
  }

  async function handleAddComment() {
    if (!commentBody.trim()) return
    await addComment(post.id, userId, commentBody.trim())
    setCommentBody('')
    setComments(await listComments(post.id))
    await onChanged()
  }

  async function handleDeleteComment(id) {
    await deleteCommentApi(id)
    setComments(await listComments(post.id))
    await onChanged()
  }

  async function handleDeletePost() {
    if (!window.confirm('Excluir esse post?')) return
    await deletePostApi(post.id)
    await onChanged()
  }

  async function handleShare() {
    const url = `${window.location.origin}/post/${post.id}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copie o link do post:', url)
    }
  }

  return (
    <article className="feed-post">
      <div className="feed-post-header">
        <Link to={post.author ? `/u/${post.author.username}` : '#'}>
          <strong>{post.author?.display_name || post.author?.username || 'alguém'}</strong>
        </Link>
        <span className="track-meta">{formatTime(post.createdAt)}</span>
      </div>
      <p className="feed-post-body">{post.body}</p>
      <TrackRow track={post.track} />

      <div className="feed-post-actions">
        <button className={`btn-ghost${liked ? ' active' : ''}`} onClick={toggleLike} disabled={busy}>
          ♥ {likeCount}
        </button>
        <button className="btn-ghost" onClick={toggleComments}>
          💬 {commentCount}
        </button>
        <button className="btn-ghost" onClick={handleShare}>
          {copied ? 'Link copiado!' : 'Compartilhar'}
        </button>
        {post.userId === userId && (
          <button className="btn-ghost" onClick={handleDeletePost}>
            Excluir
          </button>
        )}
      </div>

      {showComments && (
        <div className="comments">
          {comments === null && <p className="track-meta">Carregando…</p>}
          {comments?.length === 0 && <p className="track-meta">Nenhum comentário ainda.</p>}
          {comments?.map((c) => (
            <div key={c.id} className="comment-row">
              <span>
                <Link to={c.author ? `/u/${c.author.username}` : '#'}>
                  <strong>{c.author?.display_name || c.author?.username || 'alguém'}</strong>
                </Link>{' '}
                {c.body}
              </span>
              {c.userId === userId && (
                <button className="btn-ghost" onClick={() => handleDeleteComment(c.id)}>
                  excluir
                </button>
              )}
            </div>
          ))}
          <form
            className="add-friend-form"
            onSubmit={(e) => {
              e.preventDefault()
              handleAddComment()
            }}
          >
            <input
              className="search-input"
              placeholder="Comentar…"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
            />
            <button className="btn-primary" type="submit" disabled={!commentBody.trim()}>
              Enviar
            </button>
          </form>
        </div>
      )}
    </article>
  )
}
