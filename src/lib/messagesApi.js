import { supabase } from './supabase'

export async function listThread(userId, otherUserId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(
      `and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`
    )
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function sendMessage(senderId, recipientId, body) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: senderId, recipient_id: recipientId, body })
    .select()
    .single()
  if (error) {
    if (error.code === '23503' || error.message?.includes('row-level security'))
      throw new Error('Só dá pra mandar mensagem pra quem já é seu amigo.')
    throw error
  }
  return data
}

export function subscribeToThread(userId, otherUserId, onMessage) {
  const channel = supabase
    .channel(`dm-${[userId, otherUserId].sort().join('-')}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${otherUserId}` },
      (payload) => {
        if (payload.new.recipient_id === userId) onMessage(payload.new)
      }
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}

// Last message per accepted friend, for the conversation list — friendIds comes from friendsApi.
export async function listLastMessages(userId, friendIds) {
  if (friendIds.length === 0) return {}
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (error) throw error

  const lastByFriend = {}
  for (const m of data) {
    const otherId = m.sender_id === userId ? m.recipient_id : m.sender_id
    if (!friendIds.includes(otherId)) continue
    if (!lastByFriend[otherId]) lastByFriend[otherId] = m
  }
  return lastByFriend
}
