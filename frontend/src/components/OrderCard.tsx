import type { ReactNode } from 'react'
import { statusLabels, type Order, type Waiter } from '../types'
import { isActive, isAwaitingPayment, money, orderTotal } from '../state/model'

interface Props {
  order: Order
  waiter?: Waiter
  compact?: boolean
  summary?: boolean
  kitchen?: boolean
  children?: ReactNode
  now?: number
}
export function OrderCard({
  order,
  waiter,
  compact = false,
  summary = false,
  kitchen = false,
  children,
  now,
}: Props) {
  const date = order.createdAt ? new Date(order.createdAt) : null
  const minutes = Math.max(
    0,
    Math.floor(
      ((now ?? Date.parse(order.createdAt)) - Date.parse(order.createdAt)) /
        60000,
    ),
  )
  const seconds = Math.max(
    0,
    Math.floor(
      ((now ?? Date.parse(order.createdAt)) - Date.parse(order.createdAt)) /
        1000,
    ),
  )
  const elapsed = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
  const items = summary ? order.items.slice(0, 3) : order.items
  return (
    <article
      className={`order-card ${compact ? 'order-card--compact' : ''}${summary ? ' order-card--summary' : ''}${kitchen ? ' order-card--kitchen' : ''}`}
      aria-label={`Pedido #${order.id}, ${order.kind === 'delivery' ? 'envío a domicilio' : `mesa ${order.tableNumber}`}`}
    >
      <div className="order-card-top">
        <div>
          {summary ? (
            <h2 className="order-number">Pedido #{order.id}</h2>
          ) : kitchen ? (
            <h3 className="order-number">Pedido #{order.id}</h3>
          ) : (
            <span className="eyebrow">Pedido #{order.id}</span>
          )}
          <strong>
            {order.kind === 'delivery'
              ? order.shippingName || 'Envío a domicilio'
              : `Mesa ${order.tableNumber}`}
          </strong>
        </div>
        <span className={`status status--${order.status}`}>
          {statusLabels[order.status]}
        </span>
      </div>
      {order.paymentRequired && (
        <p className="muted">
          Pago: {order.paymentStatus || 'sin iniciar'}
          {order.shippingCost ? ` · Envío: ${money(order.shippingCost)}` : ''}
        </p>
      )}
      {order.kind === 'delivery' && order.courierName && (
        <p className="muted">Repartidor: {order.courierName}</p>
      )}
      {order.kind === 'delivery' && isActive(order) && (
        <p className="muted">
          {isAwaitingPayment(order)
            ? 'Esperando pago. El mozo puede iniciar o consultar el cobro desde Pedidos.'
            : order.deliveryStatus === 'en_camino'
              ? order.requiresCourier === false
                ? 'En camino con cadetería. El mozo debe confirmar la entrega.'
                : 'En camino. El repartidor debe confirmar la entrega.'
              : order.status === 'listo'
                ? order.requiresCourier === false
                  ? 'Listo para que el mozo confirme el retiro o la salida.'
                  : 'Listo. El repartidor asignado puede iniciar el viaje desde Mis entregas.'
                : 'En la cola de cocina. El chef debe iniciar la preparación y marcarlo listo.'}
        </p>
      )}
      {(summary || kitchen) && (
        <div className="order-meta">
          <span>
            Mozo: <b>{waiter?.name ?? order.waiterName}</b>
          </span>
          <time dateTime={order.createdAt}>
            {date?.toLocaleString('es-AR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }) ?? 'Fecha sin registro'}
          </time>
        </div>
      )}
      {now !== undefined && date && (
        <p className={minutes >= 15 ? 'elapsed is-late' : 'elapsed'}>
          {minutes >= 15 ? 'Demorado · ' : ''}
          <time
            aria-label={`${Math.floor(seconds / 60)} minutos y ${seconds % 60} segundos desde el envío`}
          >
            {elapsed}
          </time>{' '}
          desde el envío
        </p>
      )}
      <ul className="order-items">
        {items.map((item, index) => (
          <li key={`${item.dishName}-${index}`}>
            <b>{item.quantity}×</b>{' '}
            <span className="order-item-content">
              {item.dishName}
              {(!kitchen || item.notes) && (
                <small>
                  {!kitchen && <>{money(item.unitPrice)} c/u</>}
                  {item.notes && (
                    <em className={summary ? 'order-note-preview' : undefined}>
                      {kitchen ? 'Observación: ' : ' · Observación: '}
                      {item.notes}
                    </em>
                  )}
                </small>
              )}
            </span>
          </li>
        ))}
      </ul>
      {summary && order.items.length > items.length && (
        <p className="order-more">
          +{order.items.length - items.length}{' '}
          {order.items.length - items.length === 1
            ? 'producto más'
            : 'productos más'}{' '}
          en el detalle
        </p>
      )}
      {!kitchen && (
        <div className="order-total">
          <span>Consumo</span>
          <strong>{money(orderTotal(order))}</strong>
        </div>
      )}
      {!compact && !summary && !kitchen && (
        <footer>
          <span>{waiter?.name ?? order.waiterName}</span>
          <time dateTime={order.createdAt}>
            {date?.toLocaleTimeString('es-AR', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }) ?? 'Hora sin registro'}
          </time>
        </footer>
      )}
      {children && <div className="card-actions">{children}</div>}
    </article>
  )
}
