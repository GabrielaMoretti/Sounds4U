// Vercel serverless function. Refreshes a Spotify access token using the Client Secret,
// which must never reach the browser bundle — this is the only place it's allowed to live
// (as the non-VITE_ env vars SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET).

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { refresh_token } = req.body ?? {}
  if (!refresh_token) {
    res.status(400).json({ error: 'refresh_token é obrigatório' })
    return
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    res.status(500).json({ error: 'Spotify client não configurado no servidor' })
    return
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token }),
  })

  if (!tokenRes.ok) {
    const details = await tokenRes.text()
    res.status(tokenRes.status).json({ error: 'Falha ao renovar token do Spotify', details })
    return
  }

  const data = await tokenRes.json()
  res.status(200).json({
    access_token: data.access_token,
    expires_in: data.expires_in,
    refresh_token: data.refresh_token ?? refresh_token,
  })
}
