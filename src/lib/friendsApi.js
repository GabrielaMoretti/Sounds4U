import { supabase } from './supabase'

// Returns friendships involving `userId`, each enriched with the *other* person's profile.
export async function listFriendships(userId) {
  const { data: rows, error } = await supabase
    .from('friendships')
    .select('*')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
  if (error) throw error
  if (rows.length === 0) return []

  const otherIds = rows.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id))
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', otherIds)
  if (profilesError) throw profilesError

  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]))

  return rows.map((r) => {
    const isRequester = r.requester_id === userId
    const otherId = isRequester ? r.addressee_id : r.requester_id
    return {
      requesterId: r.requester_id,
      addresseeId: r.addressee_id,
      status: r.status,
      createdAt: r.created_at,
      // true if this user sent the request and it's still pending on the other person
      awaitingThem: isRequester && r.status === 'pending',
      // true if the other person sent the request and this user needs to accept it
      awaitingMe: !isRequester && r.status === 'pending',
      profile: profileById[otherId] ?? { id: otherId, username: '(perfil removido)' },
    }
  })
}

export async function listAcceptedFriendIds(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
  if (error) throw error
  return data.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id))
}

export async function getFriendship(userId, otherId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${userId})`
    )
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const isRequester = data.requester_id === userId
  return {
    requesterId: data.requester_id,
    addresseeId: data.addressee_id,
    status: data.status,
    awaitingThem: isRequester && data.status === 'pending',
    awaitingMe: !isRequester && data.status === 'pending',
  }
}

export async function sendFriendRequest(userId, targetUserId) {
  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: userId, addressee_id: targetUserId, status: 'pending' })
  if (error) throw error
}

export async function acceptFriendRequest(requesterId, addresseeId) {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('requester_id', requesterId)
    .eq('addressee_id', addresseeId)
  if (error) throw error
}

export async function removeFriendship(requesterId, addresseeId) {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('requester_id', requesterId)
    .eq('addressee_id', addresseeId)
  if (error) throw error
}
