// Placeholder persistence used only while Supabase isn't configured yet.
// Same shape as the eventual Supabase tables (see supabase/schema.sql) so swapping is a drop-in.

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

const REVIEWS_KEY = 'm2u_local_reviews'
const FRIENDS_KEY = 'm2u_local_friends'

export function listReviews() {
  return read(REVIEWS_KEY, [])
}

export function upsertReview({ track, rating, body }) {
  const reviews = listReviews()
  const existingIdx = reviews.findIndex((r) => r.trackId === track.id)
  const record = {
    id: existingIdx >= 0 ? reviews[existingIdx].id : crypto.randomUUID(),
    trackId: track.id,
    track,
    rating,
    body,
    createdAt: existingIdx >= 0 ? reviews[existingIdx].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  if (existingIdx >= 0) reviews[existingIdx] = record
  else reviews.unshift(record)
  write(REVIEWS_KEY, reviews)
  return record
}

export function deleteReview(id) {
  write(REVIEWS_KEY, listReviews().filter((r) => r.id !== id))
}

export function listFriends() {
  return read(FRIENDS_KEY, [])
}

export function addFriend(username) {
  const friends = listFriends()
  if (friends.some((f) => f.username.toLowerCase() === username.toLowerCase())) return friends
  friends.push({ id: crypto.randomUUID(), username, status: 'pending', addedAt: new Date().toISOString() })
  write(FRIENDS_KEY, friends)
  return friends
}

export function removeFriend(id) {
  write(FRIENDS_KEY, listFriends().filter((f) => f.id !== id))
}
