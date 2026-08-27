import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  updateProfile,
  uploadAvatar,
  isUsernameAvailable,
  isValidUsername,
} from '../lib/profilesApi'

const PLATFORM_OPTIONS = ['instagram', 'x', 'tiktok', 'youtube', 'site']

function emptyLink() {
  return { platform: 'instagram', url: '' }
}

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth()

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [links, setLinks] = useState([])
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)

  const [usernameStatus, setUsernameStatus] = useState('idle') // idle | checking | available | taken | invalid
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!profile) return
    setUsername(profile.username ?? '')
    setDisplayName(profile.display_name ?? '')
    setBio(profile.bio ?? '')
    setLinks(profile.social_links?.length ? profile.social_links : [])
    setAvatarUrl(profile.avatar_url ?? null)
  }, [profile])

  useEffect(() => {
    if (!user || username === profile?.username) {
      setUsernameStatus('idle')
      return
    }
    if (!isValidUsername(username)) {
      setUsernameStatus('invalid')
      return
    }
    setUsernameStatus('checking')
    const handle = setTimeout(() => {
      isUsernameAvailable(username, user.id)
        .then((available) => setUsernameStatus(available ? 'available' : 'taken'))
        .catch(() => setUsernameStatus('idle'))
    }, 400)
    return () => clearTimeout(handle)
  }, [username, user, profile])

  function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  function updateLink(index, patch) {
    setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  function removeLink(index) {
    setLinks((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!user) return
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') return

    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      let newAvatarUrl = avatarUrl
      if (avatarFile) newAvatarUrl = await uploadAvatar(user.id, avatarFile)

      await updateProfile(user.id, {
        username,
        displayName,
        bio,
        socialLinks: links.filter((l) => l.url.trim()),
        avatarUrl: newAvatarUrl,
      })
      setAvatarUrl(newAvatarUrl)
      setAvatarFile(null)
      await refreshProfile()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!profile) return <div className="page">Carregando…</div>

  return (
    <div className="page">
      <h2>Seu perfil</h2>
      {error && <div className="notice">{error}</div>}
      {saved && <div className="notice notice-ok">Perfil salvo.</div>}

      <div className="profile-form">
        <div className="avatar-row">
          {avatarPreview || avatarUrl ? (
            <img className="avatar-preview" src={avatarPreview ?? avatarUrl} alt="" />
          ) : (
            <div className="avatar-preview placeholder" />
          )}
          <label className="btn-ghost">
            Trocar foto
            <input type="file" accept="image/*" onChange={handleAvatarChange} hidden />
          </label>
        </div>

        <label className="field-label">
          Username
          <input
            className="search-input"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
          />
          {usernameStatus === 'checking' && <span className="field-hint">checando…</span>}
          {usernameStatus === 'available' && <span className="field-hint ok">disponível</span>}
          {usernameStatus === 'taken' && <span className="field-hint error">já está em uso</span>}
          {usernameStatus === 'invalid' && (
            <span className="field-hint error">use letras minúsculas, números ou _ (3-30)</span>
          )}
        </label>

        <label className="field-label">
          Nome de exibição
          <input className="search-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>

        <label className="field-label">
          Bio
          <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
        </label>

        <div className="field-label">
          Redes sociais
          {links.map((link, i) => (
            <div key={i} className="social-link-row">
              <select value={link.platform} onChange={(e) => updateLink(i, { platform: e.target.value })}>
                {PLATFORM_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input
                className="search-input"
                placeholder="https://…"
                value={link.url}
                onChange={(e) => updateLink(i, { url: e.target.value })}
              />
              <button type="button" className="btn-ghost" onClick={() => removeLink(i)}>
                Remover
              </button>
            </div>
          ))}
          <button type="button" className="btn-ghost" onClick={() => setLinks((prev) => [...prev, emptyLink()])}>
            + adicionar link
          </button>
        </div>

        <button
          className="btn-primary"
          disabled={saving || usernameStatus === 'taken' || usernameStatus === 'invalid'}
          onClick={handleSave}
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}
