import type { ChangeEvent } from 'react'
import { useRestaurant } from '../state/useRestaurant'
import type { OrderStatus } from '../types'

export interface OrderFilterValues {
  status: OrderStatus | ''
  table: string
  waiterId: string
}
interface Props {
  values: OrderFilterValues
  onChange: (values: OrderFilterValues) => void
  query: string
  onQueryChange: (query: string) => void
  date: string
  onDateChange: (date: string) => void
  onReset: () => void
}
const statuses: Array<{ value: OrderStatus; label: string }> = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'preparacion', label: 'En preparación' },
  { value: 'listo', label: 'Listo' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'cancelado', label: 'Cancelado' },
]
export function OrderFilters({
  values,
  onChange,
  query,
  onQueryChange,
  date,
  onDateChange,
  onReset,
}: Props) {
  const { data } = useRestaurant()
  const waiters = Array.from(
    new Map(
      [
        ...data.users.filter((user) => user.role === 'mozo'),
        ...data.orders.map((order) => ({
          id: order.waiterId,
          name: order.waiterName,
        })),
      ].map((user) => [user.id, user]),
    ).values(),
  )
  const update = (event: ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
    onChange({ ...values, [event.target.name]: event.target.value })
  return (
    <section className="filters orders-filters" aria-label="Filtros de pedidos">
      <div className="filter-heading">
        <span className="eyebrow">Encontrá tu comanda</span>
        <h2>Visualizar pedidos</h2>
      </div>
      <label className="orders-search">
        Buscar por pedido o plato
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Número o nombre del plato"
        />
      </label>
      <label>
        Estado
        <select name="status" value={values.status} onChange={update}>
          <option value="">Todos los estados</option>
          {statuses.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </label>
      <label className="orders-table-filter">
        Mesa
        <input
          name="table"
          value={values.table}
          onChange={update}
          type="number"
          min="1"
          placeholder="Todas"
        />
      </label>
      <label>
        Mozo
        <select name="waiterId" value={values.waiterId} onChange={update}>
          <option value="">Todos los mozos</option>
          {waiters.map((waiter) => (
            <option key={waiter.id} value={waiter.id}>
              {waiter.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Fecha
        <input
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
        />
      </label>
      <button className="clear-button" type="button" onClick={onReset}>
        Restablecer filtros
      </button>
    </section>
  )
}
