import { NavLink, Outlet } from 'react-router-dom'
import { useSpotify } from '../context/SpotifyContext'

const navItems = [
  { to: '/history', label: 'Histórico' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/friends', label: 'Amigos' },
]

export default function Layout() {
  const { connected, profile, disconnect } = useSpotify()

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          musics2u
        </NavLink>
        <nav className="nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="account">
          {connected ? (
            <>
              <span className="account-name">{profile?.display_name ?? 'Conectado'}</span>
              <button className="btn-ghost" onClick={disconnect}>
                Desconectar
              </button>
            </>
          ) : (
            <NavLink to="/" className="btn-ghost">
              Conectar Spotify
            </NavLink>
          )}
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
