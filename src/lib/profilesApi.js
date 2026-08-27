import { supabase } from './supabase'

// Profile row is created automatically by the `on_auth_user_created` trigger
// (supabase/002_profile_trigger.sql) — this just reads it back.
export async function getMyProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data
}

export async function getProfileByUsername(username) {
  const { data, error } = await supabase.from('profiles').select('*').eq('username', username).maybeSingle()
  if (error) throw error
  return data
}

export async function searchProfiles(query, excludeUserId) {
  if (!query.trim()) return []
  let q = supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .ilike('username', `%${query.trim()}%`)
    .limit(10)
  if (excludeUserId) q = q.neq('id', excludeUserId)
  const { data, error } = await q
  if (error) throw error
  return data
}

const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/

export function isValidUsername(username) {
  return USERNAME_PATTERN.test(username)
}

export async function isUsernameAvailable(username, currentUserId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .neq('id', currentUserId)
    .maybeSingle()
  if (error) throw error
  return !data
}

export async function updateProfile(userId, { username, displayName, bio, socialLinks, avatarUrl }) {
  const patch = {}
  if (username !== undefined) patch.username = username
  if (displayName !== undefined) patch.display_name = displayName
  if (bio !== undefined) patch.bio = bio
  if (socialLinks !== undefined) patch.social_links = socialLinks
  if (avatarUrl !== undefined) patch.avatar_url = avatarUrl

  const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
  if (error) {
    if (error.code === '23505') throw new Error('Esse username já está em uso.')
    throw error
  }
}

export async function uploadAvatar(userId, file) {
  const ext = file.name.split('.').pop()
  const path = `${userId}/avatar.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, cacheControl: '3600' })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  // cache-bust so the new photo shows immediately instead of the browser's cached old one
  return `${data.publicUrl}?t=${Date.now()}`
}
