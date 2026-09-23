import { useMemo, useState } from 'react'
import { OrderCard } from '../components/OrderCard'
import { OrderFilters, type OrderFilterValues } from '../components/OrderFilters'
import { orders, waiters } from '../mocks/restaurant'
export function OrdersPage() {
  const [filters, setFilters] = useState<OrderFilterValues>({ status: '', table: '', waiterId: '' })
  const visibleOrders = useMemo(() => orders.filter((order) => (!filters.status || order.status === filters.status) && (!filters.table || order.tableNumber === Number(filters.table)) && (!filters.waiterId || order.waiterId === filters.waiterId)), [filters])
  return <><section className="page-intro"><div><span className="eyebrow">Servicio</span><h1>Pedidos</h1><p>Consultá el estado de las comandas de todo el salón.</p></div></section><OrderFilters values={filters} onChange={setFilters} /><div className="result-summary"><p><b>{visibleOrders.length}</b> {visibleOrders.length === 1 ? 'pedido encontrado' : 'pedidos encontrados'}</p></div>{visibleOrders.length ? <section className="orders-grid">{visibleOrders.map((order) => <OrderCard key={order.id} order={order} waiter={waiters.find((waiter) => waiter.id === order.waiterId)} />)}</section> : <div className="empty-state large">No hay pedidos que coincidan con los filtros elegidos.</div>}</>
}
