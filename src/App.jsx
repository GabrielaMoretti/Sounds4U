import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import SpotifyCallback from './pages/SpotifyCallback'
import History from './pages/History'
import Reviews from './pages/Reviews'
import Friends from './pages/Friends'

export default function App() {
  return (
    <Routes>
      <Route path="/callback/spotify" element={<SpotifyCallback />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Login />} />
        <Route path="/history" element={<History />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/friends" element={<Friends />} />
      </Route>
    </Routes>
  )
}
