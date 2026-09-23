import type { ChangeEvent } from 'react'
import { waiters } from '../mocks/restaurant'
import type { OrderStatus } from '../types'

export interface OrderFilterValues { status: OrderStatus | ''; table: string; waiterId: string }
interface Props { values: OrderFilterValues; onChange: (values: OrderFilterValues) => void }
const statuses: Array<{ value: OrderStatus; label: string }> = [{ value: 'pendiente', label: 'Pendiente' }, { value: 'preparacion', label: 'En preparación' }, { value: 'listo', label: 'Listo' }, { value: 'entregado', label: 'Entregado' }, { value: 'cancelado', label: 'Cancelado' }]
export function OrderFilters({ values, onChange }: Props) {
  const update = (event: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => onChange({ ...values, [event.target.name]: event.target.value })
  return <section className="filters" aria-label="Filtros de pedidos"><div className="filter-heading"><span className="eyebrow">Búsqueda</span><h2>Filtrar pedidos</h2></div><label>Estado<select name="status" value={values.status} onChange={update}><option value="">Todos los estados</option>{statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label><label>Mesa<input name="table" value={values.table} onChange={update} type="number" min="1" placeholder="Todas" /></label><label>Camarero<select name="waiterId" value={values.waiterId} onChange={update}><option value="">Todos los camareros</option>{waiters.map((waiter) => <option key={waiter.id} value={waiter.id}>{waiter.name}</option>)}</select></label><button className="clear-button" onClick={() => onChange({ status: '', table: '', waiterId: '' })}>Limpiar</button></section>
}
