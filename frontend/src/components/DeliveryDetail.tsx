import { deliveryStatusLabels, type Delivery } from '../types/delivery'
import { Dialog } from './Dialog'

export function DeliveryDetail({
  delivery,
  onClose,
}: {
  delivery: Delivery
  onClose: () => void
}) {
  return (
    <Dialog title={`Entrega ${delivery.id}`} onClose={onClose}>
      <dl className="delivery-detail">
        <div>
          <dt>Cliente</dt>
          <dd>{delivery.customerName}</dd>
        </div>
        <div>
          <dt>Dirección</dt>
          <dd>{delivery.address}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>{deliveryStatusLabels[delivery.status]}</dd>
        </div>
        {delivery.addressNotes && (
          <div>
            <dt>Indicaciones de entrega</dt>
            <dd>{delivery.addressNotes}</dd>
          </div>
        )}
      </dl>
      <h3>Contenido del pedido</h3>
      <ul className="delivery-detail-items">
        {delivery.items.map((item, index) => (
          <li key={index}>
            <strong>
              {item.quantity} × {item.name}
            </strong>
            {item.notes && <p className="muted">{item.notes}</p>}
          </li>
        ))}
      </ul>
      <button className="secondary-button" onClick={onClose}>
        Volver a entregas
      </button>
    </Dialog>
  )
}
