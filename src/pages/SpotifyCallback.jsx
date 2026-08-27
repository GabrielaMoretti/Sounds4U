import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function SpotifyCallback() {
  const { connected, loading } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    const oauthError = searchParams.get('error_description') || searchParams.get('error')
    if (oauthError) setError(oauthError)
  }, [searchParams])

  useEffect(() => {
    if (!loading && connected) navigate('/feed', { replace: true })
  }, [loading, connected, navigate])

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
