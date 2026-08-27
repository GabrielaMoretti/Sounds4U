import { Link } from 'react-router-dom'
import TrackRow from './TrackRow'

function formatTime(iso) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function FeedReviewItem({ review }) {
  return (
    <article className="feed-post">
      <div className="feed-post-header">
        <Link to={review.author ? `/u/${review.author.username}` : '#'}>
          <strong>{review.author?.display_name || review.author?.username || 'alguém'}</strong>
        </Link>
        <span className="track-meta">{formatTime(review.updatedAt ?? review.createdAt)}</span>
      </div>
      <p className="feed-post-body">
        <span className="review-stars">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
        {review.body && ` ${review.body}`}
      </p>
      <Link to={`/track/${review.track.id}`} className="track-row-clickable">
        <TrackRow track={review.track} />
      </Link>
    </article>
  )
}
