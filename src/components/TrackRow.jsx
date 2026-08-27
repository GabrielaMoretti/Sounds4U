import { Link } from 'react-router-dom'

export default function TrackRow({ track, meta, actions, linkTo }) {
  const art = track.albumArtUrl ? (
    <img className="track-art" src={track.albumArtUrl} alt={track.album} />
  ) : (
    <div className="track-art placeholder" />
  )

  const info = (
    <div className="track-info">
      <div className="track-name">{track.name}</div>
      <div className="track-artist">{track.artist}</div>
      {meta && <div className="track-meta">{meta}</div>}
    </div>
  )

  return (
    <div className="track-row">
      {linkTo ? (
        <Link to={linkTo} className="track-row-link">
          {art}
          {info}
        </Link>
      ) : (
        <>
          {art}
          {info}
        </>
      )}
      {actions && <div className="track-actions">{actions}</div>}
    </div>
  )
}
