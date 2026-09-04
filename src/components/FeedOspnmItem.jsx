import { Link } from 'react-router-dom'
import TrackRow from './TrackRow'

function formatTime(iso) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function FeedOspnmItem({ entry }) {
  return (
    <article className="feed-post">
      <div className="feed-post-header">
        <Link to={entry.author ? `/u/${entry.author.username}` : '#'}>
          <strong>{entry.author?.display_name || entry.author?.username || 'alguém'}</strong>
        </Link>
        <span className="track-meta">{formatTime(entry.updatedAt ?? entry.createdAt)}</span>
      </div>
      <p className="ospnm-presented-by">OSPNM — avaliação de rolê</p>
      <p className="feed-post-body">
        {'★'.repeat(entry.stars)}
        {'☆'.repeat(5 - entry.stars)} {'🍾'.repeat(entry.bottles)}
      </p>
      <p className="taste-review-quote">"{entry.justification}"</p>
      <p className="dsp-note">Nível de loucura: {entry.crazinessNote}</p>
      <Link to={`/track/${entry.track.id}`} className="track-row-clickable">
        <TrackRow track={entry.track} />
      </Link>
    </article>
  )
}
