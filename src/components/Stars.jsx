export default function Stars({ value, onChange }) {
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star${n <= value ? ' filled' : ''}`}
          onClick={() => onChange(n)}
          aria-label={`${n} estrelas`}
        >
          ★
        </button>
      ))}
    </div>
  )
}
