export default function TrackRow({ track, meta, actions }) {
  return (
    <div className="track-row">
      {track.albumArtUrl ? (
        <img className="track-art" src={track.albumArtUrl} alt={track.album} />
      ) : (
        <div className="track-art placeholder" />
      )}
      <div className="track-info">
        <div className="track-name">{track.name}</div>
        <div className="track-artist">{track.artist}</div>
        {meta && <div className="track-meta">{meta}</div>}
      </div>
      {actions && <div className="track-actions">{actions}</div>}
    </div>
  )
}
