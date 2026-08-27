import { supabase } from './supabase'
import { cacheTrack } from './tracksApi'

function trackFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    artist: row.artist,
    album: row.album,
    albumArtUrl: row.album_art_url,
    durationMs: row.duration_ms,
    externalUrl: row.external_url,
  }
}

export async function createPost({ userId, track, body }) {
  await cacheTrack(track)
  const { error } = await supabase.from('posts').insert({ user_id: userId, track_id: track.id, body })
  if (error) throw error
}

export async function deletePost(postId) {
  const { error } = await supabase.from('posts').delete().eq('id', postId)
  if (error) throw error
}

export async function getPost(postId) {
  const { data: row, error } = await supabase
    .from('posts')
    .select('*, tracks(*)')
    .eq('id', postId)
    .maybeSingle()
  if (error) throw error
  if (!row) return null

  const { data: author } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .eq('id', row.user_id)
    .maybeSingle()

  return {
    id: row.id,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
    track: trackFromRow(row.tracks),
    author: author ?? null,
  }
}

// userIds should include the viewer's own id plus their accepted friends' ids.
export async function listFeed(userIds) {
  if (userIds.length === 0) return []

  const { data: rows, error } = await supabase
    .from('posts')
    .select('*, tracks(*)')
    .in('user_id', userIds)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  if (rows.length === 0) return []

  const authorIds = [...new Set(rows.map((r) => r.user_id))]
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', authorIds)
  if (profilesError) throw profilesError
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]))

  return rows.map((row) => ({
    id: row.id,
    type: 'post',
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
    track: trackFromRow(row.tracks),
    author: profileById[row.user_id] ?? null,
  }))
}

// Returns { [postId]: { likeCount, likedByMe, commentCount } } for the given posts.
export async function getEngagement(postIds, userId) {
  const engagement = Object.fromEntries(postIds.map((id) => [id, { likeCount: 0, likedByMe: false, commentCount: 0 }]))
  if (postIds.length === 0) return engagement

  const [{ data: likes, error: likesError }, { data: comments, error: commentsError }] = await Promise.all([
    supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds),
    supabase.from('post_comments').select('post_id').in('post_id', postIds),
  ])
  if (likesError) throw likesError
  if (commentsError) throw commentsError

  for (const l of likes) {
    engagement[l.post_id].likeCount += 1
    if (l.user_id === userId) engagement[l.post_id].likedByMe = true
  }
  for (const c of comments) {
    engagement[c.post_id].commentCount += 1
  }
  return engagement
}

export async function likePost(postId, userId) {
  const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: userId })
  if (error && error.code !== '23505') throw error
}

export async function unlikePost(postId, userId) {
  const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId)
  if (error) throw error
}

export async function listComments(postId) {
  const { data: rows, error } = await supabase
    .from('post_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
  if (error) throw error
  if (rows.length === 0) return []

  const authorIds = [...new Set(rows.map((r) => r.user_id))]
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .in('id', authorIds)
  if (profilesError) throw profilesError
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]))

  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    userId: row.user_id,
    author: profileById[row.user_id] ?? null,
  }))
}

export async function addComment(postId, userId, body) {
  const { error } = await supabase.from('post_comments').insert({ post_id: postId, user_id: userId, body })
  if (error) throw error
}

export async function deleteComment(commentId) {
  const { error } = await supabase.from('post_comments').delete().eq('id', commentId)
  if (error) throw error
}
