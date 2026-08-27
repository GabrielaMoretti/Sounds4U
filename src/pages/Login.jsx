import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useSpotify } from '../context/SpotifyContext'
import { startSpotifyLogin, isSpotifyConfigured } from '../lib/spotify'

export default function Login() {
  const { connected } = useSpotify()
  const navigate = useNavigate()

  useEffect(() => {
    if (connected) navigate('/history', { replace: true })
  }, [connected, navigate])

  return (
    <div className="login-screen">
      <h1>musics2u</h1>
      <p className="subtitle">Letterboxd, mas para música. Conecte seu Spotify para começar.</p>

      {!isSpotifyConfigured && (
        <div className="notice">
          Spotify não configurado. Preencha <code>VITE_SPOTIFY_CLIENT_ID</code> e{' '}
          <code>VITE_SPOTIFY_REDIRECT_URI</code> no <code>.env</code> (veja <code>.env.example</code>).
        </div>
      )}

      <button className="btn-primary" disabled={!isSpotifyConfigured} onClick={startSpotifyLogin}>
        Conectar com Spotify
      </button>

      <p className="dsp-note">
        Deezer, Apple Music e Amazon Music entram depois — Spotify é a única DSP com API viável para
        login + histórico de escuta hoje.
      </p>
    </div>
  )
}
