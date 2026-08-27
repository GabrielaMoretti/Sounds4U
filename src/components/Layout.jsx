import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/feed', label: 'Feed' },
  { to: '/history', label: 'Histórico' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/friends', label: 'Amigos' },
  { to: '/messages', label: 'Mensagens' },
]

export default function Layout() {
  const { connected, profile, logout } = useAuth()

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          Sounds4U
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
              <NavLink to="/profile" className="account-name">
                {profile?.display_name ?? profile?.username ?? 'Conectado'}
              </NavLink>
              <button className="btn-ghost" onClick={logout}>
                Sair
              </button>
            </>
          ) : (
            <NavLink to="/" className="btn-ghost">
              Entrar
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
