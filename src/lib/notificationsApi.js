import { supabase } from './supabase'

async function withActors(rows) {
  if (rows.length === 0) return []
  const actorIds = [...new Set(rows.map((r) => r.actor_id))]
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', actorIds)
  if (error) throw error
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]))

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    postId: row.post_id,
    commentId: row.comment_id,
    messageId: row.message_id,
    readAt: row.read_at,
    createdAt: row.created_at,
    actor: profileById[row.actor_id] ?? null,
  }))
}

export async function listNotifications(userId, limit = 50) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return withActors(data)
}

export async function countUnread(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
  if (error) throw error
  return count ?? 0
}

export async function markAllRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
  if (error) throw error
}

export function subscribeToNotifications(userId, onInsert) {
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}
