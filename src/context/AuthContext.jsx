import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { saveSpotifyConnection } from '../lib/dspConnections'
import { getMyProfile } from '../lib/profilesApi'

const AuthContext = createContext(null)

const SPOTIFY_SCOPES = [
  'user-read-email',
  'user-read-private',
  'user-read-recently-played',
  'user-read-currently-playing',
].join(' ')

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId) => {
    try {
      setProfile(await getMyProfile(userId))
    } catch {
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) loadProfile(data.session.user.id)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)

      if (event === 'SIGNED_IN' && newSession?.provider_token) {
        const spotifyIdentity = newSession.user.identities?.find((i) => i.provider === 'spotify')
        saveSpotifyConnection({
          userId: newSession.user.id,
          providerUserId: spotifyIdentity?.id ?? '',
          accessToken: newSession.provider_token,
          refreshToken: newSession.provider_refresh_token,
        }).catch((err) => console.error('Falha ao salvar conexão do Spotify:', err))
      }

      if (newSession) loadProfile(newSession.user.id)
      else setProfile(null)
    })

    return () => subscription.subscription.unsubscribe()
  }, [loadProfile])

  const loginWithSpotify = useCallback(() => {
    return supabase.auth.signInWithOAuth({
      provider: 'spotify',
      options: {
        scopes: SPOTIFY_SCOPES,
        redirectTo: `${window.location.origin}/callback/spotify`,
      },
    })
  }, [])

  const logout = useCallback(() => supabase.auth.signOut(), [])

  const refreshProfile = useCallback(() => {
    if (session) return loadProfile(session.user.id)
  }, [session, loadProfile])

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    connected: Boolean(session),
    loading,
    loginWithSpotify,
    logout,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
