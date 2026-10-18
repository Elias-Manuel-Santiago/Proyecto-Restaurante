import type { RestaurantTable } from '../types'

interface Props {
  table: RestaurantTable
  onSelect: (table: RestaurantTable) => void
}
export function TableCard({ table, onSelect }: Props) {
  const occupied = table.status === 'ocupada'
  return (
    <button
      className={`table-card ${occupied ? 'is-occupied' : 'is-free'}`}
      onClick={() => onSelect(table)}
    >
      <span className="table-card-label">Mesa</span>
      <strong>{table.number}</strong>
      <span>
        {occupied ? `Ocupada · ${table.diners} comensales` : 'Disponible'}
      </span>
    </button>
  )
}
