export function Stats({
  items,
  compact = items.every((item) => !item.detail),
}: {
  items: { label: string; value: string | number; detail?: string }[]
  compact?: boolean
}) {
  return (
    <section
      className={`stats-grid ${compact ? 'stats-grid--compact' : ''}`}
      aria-label="Resumen del servicio"
    >
      {items.map((item) => (
        <article className="stat-card" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.detail && <small>{item.detail}</small>}
        </article>
      ))}
    </section>
  )
}
