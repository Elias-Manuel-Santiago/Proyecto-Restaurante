import type { Order, Waiter } from '../types'

interface Props { order: Order; waiter?: Waiter; compact?: boolean }
const statusLabels = { pendiente: 'Pendiente', preparacion: 'En preparación', listo: 'Listo', entregado: 'Entregado', cancelado: 'Cancelado' }
export function OrderCard({ order, waiter, compact = false }: Props) {
  return <article className={`order-card ${compact ? 'order-card--compact' : ''}`}>
    <div className="order-card-top"><div><span className="eyebrow">Pedido #{order.id}</span><strong>Mesa {order.tableNumber}</strong></div><span className={`status status--${order.status}`}>{statusLabels[order.status]}</span></div>
    <ul className="order-items">{order.items.map((item, index) => <li key={`${item.dishName}-${index}`}><b>{item.quantity}×</b> {item.dishName}</li>)}</ul>
    {!compact && <footer><span>{waiter?.name ?? 'Sin asignar'}</span><time>{order.createdAt}</time></footer>}
  </article>
}
