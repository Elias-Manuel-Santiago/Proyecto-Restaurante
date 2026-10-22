import { deliveryStatusLabels, type Delivery } from '../types/delivery'
import { Icon } from './Icon'

export function DeliveryCard({
  delivery,
  onDetail,
  onAdvance,
}: {
  delivery: Delivery
  onDetail: () => void
  onAdvance: () => void
}) {
  return (
    <article
      className="panel delivery-card"
      aria-label={`Entrega ${delivery.id}`}
    >
      <div className="delivery-card-top">
        <span className="eyebrow">{delivery.id}</span>
        <span className={`status delivery-status--${delivery.status}`}>
          {deliveryStatusLabels[delivery.status]}
        </span>
      </div>
      <h2>{delivery.customerName}</h2>
      <p className="delivery-address">
        <Icon name="ubicacion" />
        <span>{delivery.address}</span>
      </p>
      <ul className="delivery-items">
        {delivery.items.map((item, index) => (
          <li key={index}>
            <b>{item.quantity}×</b> {item.name}
          </li>
        ))}
      </ul>
      <div className="card-actions">
        <button
          className="secondary-button"
          onClick={onDetail}
          aria-label={`Ver detalle de ${delivery.id}`}
        >
          Ver detalle
        </button>
        {delivery.status !== 'entregado' && (
          <button
            className="primary-button"
            onClick={onAdvance}
            aria-label={`${delivery.status === 'listo' ? 'Retirar' : 'Confirmar entrega de'} ${delivery.id}`}
          >
            {delivery.status === 'listo'
              ? 'Retirar pedido'
              : 'Confirmar entrega'}
          </button>
        )}
      </div>
    </article>
  )
}
