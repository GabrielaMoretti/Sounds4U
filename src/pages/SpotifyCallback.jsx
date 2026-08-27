import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { handleSpotifyCallback } from '../lib/spotify'
import { useSpotify } from '../context/SpotifyContext'

export default function SpotifyCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { refreshProfile } = useSpotify()
  const [error, setError] = useState(null)
  const ranOnce = useRef(false)

  useEffect(() => {
    if (ranOnce.current) return
    ranOnce.current = true

    const code = searchParams.get('code')
    const oauthError = searchParams.get('error')

    if (oauthError) {
      setError(`Spotify recusou a autorização: ${oauthError}`)
      return
    }
    if (!code) {
      setError('Código de autorização ausente no redirect.')
      return
    }

    handleSpotifyCallback(code)
      .then(() => refreshProfile())
      .then(() => navigate('/history', { replace: true }))
      .catch((err) => setError(err.message))
  }, [searchParams, navigate, refreshProfile])

  if (error) {
    return (
      <div className="login-screen">
        <h1>Falha ao conectar</h1>
        <p className="notice">{error}</p>
        <button className="btn-primary" onClick={() => navigate('/', { replace: true })}>
          Voltar
        </button>
      </div>
    )
  }

  return (
    <div className="login-screen">
      <p>Conectando ao Spotify…</p>
    </div>
  )
}
