import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'

const navItems = [
  { to: '/feed', label: 'Feed' },
  { to: '/history', label: 'Histórico' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/map', label: 'Mapa' },
  { to: '/search', label: 'Buscar' },
  { to: '/friends', label: 'Amigos' },
  { to: '/messages', label: 'Mensagens' },
  { to: '/ospnm', label: 'OSPNM' },
]

export default function Layout() {
  const { connected, profile, logout } = useAuth()
  const { unreadCount } = useNotifications()

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
              <NavLink to="/notifications" className="bell" aria-label="Notificações">
                🔔
                {unreadCount > 0 && <span className="bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </NavLink>
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
      <footer className="footer">
        <NavLink to="/privacy">Política de Privacidade</NavLink>
      </footer>
    </div>
  )
}
