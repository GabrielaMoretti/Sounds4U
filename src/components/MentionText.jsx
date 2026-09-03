import { Link } from 'react-router-dom'

const MENTION_SPLIT = /(@[a-z0-9_]{3,30})/gi
const MENTION_MATCH = /^@([a-z0-9_]{3,30})$/i

export default function MentionText({ text }) {
  return text.split(MENTION_SPLIT).map((part, i) => {
    const match = part.match(MENTION_MATCH)
    if (!match) return part
    return (
      <Link key={i} to={`/u/${match[1].toLowerCase()}`}>
        {part}
      </Link>
    )
  })
}
