import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import SpotifyCallback from './pages/SpotifyCallback'
import Feed from './pages/Feed'
import History from './pages/History'
import Reviews from './pages/Reviews'
import Friends from './pages/Friends'
import Profile from './pages/Profile'
import PublicProfile from './pages/PublicProfile'
import Messages from './pages/Messages'
import PostDetail from './pages/PostDetail'
import Search from './pages/Search'
import TrackDetail from './pages/TrackDetail'
import PrivacyPolicy from './pages/PrivacyPolicy'

export default function App() {
  return (
    <Routes>
      <Route path="/callback/spotify" element={<SpotifyCallback />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Login />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/history" element={<History />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/search" element={<Search />} />
        <Route path="/track/:trackId" element={<TrackDetail />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/messages/:username" element={<Messages />} />
        <Route path="/u/:username" element={<PublicProfile />} />
        <Route path="/post/:postId" element={<PostDetail />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
      </Route>
    </Routes>
  )
}
