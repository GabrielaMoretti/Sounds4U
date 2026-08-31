import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { countUnread, subscribeToNotifications } from '../lib/notificationsApi'

const NotificationsContext = createContext(null)

export function NotificationsProvider({ children }) {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  const refresh = useCallback(() => {
    if (!user) {
      setUnreadCount(0)
      return
    }
    countUnread(user.id).then(setUnreadCount).catch(() => {})
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!user) return
    return subscribeToNotifications(user.id, () => setUnreadCount((n) => n + 1))
  }, [user])

  return (
    <NotificationsContext.Provider value={{ unreadCount, refresh }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications precisa estar dentro de <NotificationsProvider>')
  return ctx
}
