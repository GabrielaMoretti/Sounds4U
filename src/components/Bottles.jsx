export default function Bottles({ value, onChange }) {
  return (
    <div className="stars bottles">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`bottle${n <= value ? ' filled' : ''}`}
          onClick={() => onChange(n)}
          aria-label={`${n} garrafas`}
          aria-pressed={n <= value}
        >
          🍾
        </button>
      ))}
    </div>
  )
}
