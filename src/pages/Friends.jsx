import { useState } from 'react'
import { listFriends, addFriend, removeFriend } from '../lib/localStore'
import { isSupabaseConfigured } from '../lib/supabase'

export default function Friends() {
  const [friends, setFriends] = useState(listFriends())
  const [username, setUsername] = useState('')

  function handleAdd(e) {
    e.preventDefault()
    if (!username.trim()) return
    setFriends(addFriend(username.trim()))
    setUsername('')
  }

  function handleRemove(id) {
    removeFriend(id)
    setFriends(listFriends())
  }

  return (
    <div className="page">
      <h2>Amigos</h2>
      {!isSupabaseConfigured && (
        <div className="notice">
          Sem Supabase ainda, isso é só um placeholder local — não existe usuário real do outro
          lado. Quando o projeto novo do Supabase estiver pronto, isso vira busca de perfis reais
          e pedidos de amizade de verdade (tabela <code>friendships</code> já está no schema).
        </div>
      )}

      <form className="add-friend-form" onSubmit={handleAdd}>
        <input
          className="search-input"
          placeholder="username do amigo"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button className="btn-primary" type="submit">
          Adicionar
        </button>
      </form>

      <div className="track-list">
        {friends.length === 0 && <p>Nenhum amigo adicionado ainda.</p>}
        {friends.map((f) => (
          <div key={f.id} className="track-row">
            <div className="track-info">
              <div className="track-name">{f.username}</div>
              <div className="track-meta">{f.status}</div>
            </div>
            <div className="track-actions">
              <button className="btn-ghost" onClick={() => handleRemove(f.id)}>
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
