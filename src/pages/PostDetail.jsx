import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getPost, getEngagement } from '../lib/postsApi'
import FeedPost from '../components/FeedPost'

export default function PostDetail() {
  const { postId } = useParams()
  const { user } = useAuth()
  const [post, setPost] = useState(undefined) // undefined = loading, null = not found
  const [engagement, setEngagement] = useState(null)
  const [error, setError] = useState(null)

  async function refresh() {
    try {
      const p = await getPost(postId)
      setPost(p)
      if (p && user) {
        const eng = await getEngagement([p.id], user.id)
        setEngagement(eng[p.id])
      }
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    refresh()
  }, [postId, user])

  if (post === undefined) return <div className="page">Carregando…</div>
  if (post === null) return <div className="page">Post não encontrado.</div>

  return (
    <div className="page">
      <h2>Post</h2>
      {error && <div className="notice">{error}</div>}
      <FeedPost post={post} userId={user.id} engagement={engagement} onChanged={refresh} />
    </div>
  )
}
