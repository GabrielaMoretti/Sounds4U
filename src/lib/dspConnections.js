import { supabase } from './supabase'

// Spotify access tokens last 3600s. Supabase only hands us `provider_token` /
// `provider_refresh_token` once, right after the OAuth redirect (SIGNED_IN event) — so this
// runs from AuthContext at that moment, not on every page load.
export async function saveSpotifyConnection({ userId, providerUserId, accessToken, refreshToken }) {
  const { error } = await supabase.from('dsp_connections').upsert(
    {
      user_id: userId,
      provider: 'spotify',
      provider_user_id: providerUserId ?? '',
      access_token: accessToken,
      refresh_token: refreshToken ?? '',
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider' }
  )
  if (error) throw error
}

export async function getSpotifyConnection(userId) {
  const { data, error } = await supabase
    .from('dsp_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'spotify')
    .maybeSingle()
  if (error) throw error
  return data
}
