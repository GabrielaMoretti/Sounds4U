import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  isSpotifyConnected,
  getMyProfile,
  disconnectSpotify as disconnectSpotifyTokens,
} from '../lib/spotify'

const SpotifyContext = createContext(null)

export function SpotifyProvider({ children }) {
  const [connected, setConnected] = useState(isSpotifyConnected())
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refreshProfile = useCallback(async () => {
    if (!isSpotifyConnected()) {
      setConnected(false)
      setProfile(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const me = await getMyProfile()
      setProfile(me)
      setConnected(true)
    } catch (err) {
      setError(err.message)
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isSpotifyConnected()) refreshProfile()
  }, [refreshProfile])

  const disconnect = useCallback(() => {
    disconnectSpotifyTokens()
    setConnected(false)
    setProfile(null)
  }, [])

  return (
    <SpotifyContext.Provider value={{ connected, profile, loading, error, refreshProfile, disconnect }}>
      {children}
    </SpotifyContext.Provider>
  )
}

export function useSpotify() {
  const ctx = useContext(SpotifyContext)
  if (!ctx) throw new Error('useSpotify precisa estar dentro de <SpotifyProvider>')
  return ctx
}
