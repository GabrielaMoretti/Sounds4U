import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'

export default function Login() {
  const { connected, loginWithSpotify } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (connected) navigate('/feed', { replace: true })
  }, [connected, navigate])

  return (
    <div className="login-screen">
      <h1>Sounds4U</h1>
      <p className="subtitle">Letterboxd, mas para música. Conecte seu Spotify para começar.</p>

      {!isSupabaseConfigured && (
        <div className="notice">
          Supabase não configurado. Preencha <code>VITE_SUPABASE_URL</code> e{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> no <code>.env</code> (veja <code>.env.example</code>).
        </div>
      )}

      <button className="btn-primary" disabled={!isSupabaseConfigured} onClick={loginWithSpotify}>
        Conectar com Spotify
      </button>

      <p className="dsp-note">
        Deezer, Apple Music e Amazon Music entram depois — Spotify é a única DSP com API viável para
        login + histórico de escuta hoje.
      </p>
    </div>
  )
}
