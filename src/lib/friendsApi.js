import { supabase } from './supabase'

// Returns friendships involving `userId`, each enriched with the *other* person's profile.
// Dedupes by the other person in case a legacy double-row (one per direction, from before
// sendFriendRequest auto-merged reciprocal requests) still exists for a pair.
export async function listFriendships(userId) {
  const { data: rows, error } = await supabase
    .from('friendships')
    .select('*')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
  if (error) throw error
  if (rows.length === 0) return []

  const byOtherId = new Map()
  for (const r of rows) {
    const otherId = r.requester_id === userId ? r.addressee_id : r.requester_id
    const existing = byOtherId.get(otherId)
    if (!existing || (existing.status !== 'accepted' && r.status === 'accepted')) {
      byOtherId.set(otherId, r)
    }
  }
  const dedupedRows = [...byOtherId.values()]

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', [...byOtherId.keys()])
  if (profilesError) throw profilesError

  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]))

  return dedupedRows.map((r) => {
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
  return [...new Set(data.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id)))]
}

// Uses a plain select instead of .maybeSingle() so a legacy double-row (bug fixed in
// sendFriendRequest below) doesn't throw a "multiple rows" error — picks the accepted one if
// either row is accepted, otherwise the first.
export async function getFriendship(userId, otherId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${userId})`
    )
  if (error) throw error
  if (!data || data.length === 0) return null
  const row = data.find((r) => r.status === 'accepted') ?? data[0]
  const isRequester = row.requester_id === userId
  return {
    requesterId: row.requester_id,
    addresseeId: row.addressee_id,
    status: row.status,
    awaitingThem: isRequester && row.status === 'pending',
    awaitingMe: !isRequester && row.status === 'pending',
  }
}

// If the other person already sent *you* a request, sending one back confirms it — accept
// theirs instead of inserting a second row in the opposite direction (which used to leave the
// friendship stuck in a contradictory state that never resolved).
export async function sendFriendRequest(userId, targetUserId) {
  const { data: reverse, error: reverseError } = await supabase
    .from('friendships')
    .select('status')
    .eq('requester_id', targetUserId)
    .eq('addressee_id', userId)
    .maybeSingle()
  if (reverseError) throw reverseError

  if (reverse) {
    if (reverse.status === 'pending') await acceptFriendRequest(targetUserId, userId)
    return
  }

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
