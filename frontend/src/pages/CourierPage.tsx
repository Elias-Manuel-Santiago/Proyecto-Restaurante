import { useState } from 'react'
import { ConfirmDialog } from '../components/Dialog'
import { DeliveryCard } from '../components/DeliveryCard'
import { DeliveryDetail } from '../components/DeliveryDetail'
import { Icon } from '../components/Icon'
import { Stats } from '../components/Stats'
import { useDeliveries } from '../state/useDeliveries'
import { deliveryStatusLabels, type DeliveryStatus } from '../types/delivery'

const statuses: DeliveryStatus[] = ['listo', 'en_camino', 'entregado']

export function CourierPage() {
  const { demo, deliveries, startDemo, stopDemo, advance } = useDeliveries()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<DeliveryStatus | ''>('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const search = query.trim().toLocaleLowerCase()
  const visible = deliveries.filter(
    (delivery) =>
      (!status || delivery.status === status) &&
      (!search ||
        [delivery.id, delivery.customerName, delivery.address].some((value) =>
          value.toLocaleLowerCase().includes(search),
        )),
  )
  const detail = deliveries.find((delivery) => delivery.id === detailId)
  const confirming = deliveries.find((delivery) => delivery.id === confirmId)
  const resetView = () => {
    setQuery('')
    setStatus('')
    setDetailId(null)
    setConfirmId(null)
    setNotice('')
  }
  return (
    <div className="courier-workspace">
      <section className="page-intro">
        <div>
          <span className="eyebrow">Reparto · Tus entregas</span>
          <h1>Del restó a la puerta</h1>
          <p>La dirección, el pedido y el próximo paso, siempre a mano.</p>
        </div>
        <span className="delivery-mode">
          <Icon name="repartidor" />
          {demo ? 'Demostración' : 'Conexión pendiente'}
        </span>
      </section>
      {demo ? (
        <section className="delivery-banner" aria-label="Modo demostración">
          <div>
            <strong>Estás viendo entregas de ejemplo</strong>
            <p>
              Los clientes y las direcciones son ficticios. Los cambios solo
              duran mientras esta vista está abierta.
            </p>
          </div>
          <div className="actions">
            <button
              className="secondary-button"
              onClick={() => {
                resetView()
                startDemo()
              }}
            >
              Reiniciar demo
            </button>
            <button
              className="text-button"
              onClick={() => {
                resetView()
                stopDemo()
              }}
            >
              Salir de la demo
            </button>
          </div>
        </section>
      ) : (
        <section className="panel delivery-welcome">
          <span className="delivery-empty-icon">
            <Icon name="repartidor" />
          </span>
          <h2>Tu espacio de reparto está preparado</h2>
          <p>
            La conexión de envíos todavía no está disponible. Cuando se
            habilite, acá vas a poder consultar tus entregas.
          </p>
          <button
            className="primary-button"
            onClick={() => {
              resetView()
              startDemo()
            }}
          >
            Ver demostración
          </button>
          <small>
            Recorré la vista con pedidos ficticios, sin afectar el servicio.
          </small>
        </section>
      )}
      {demo && (
        <>
          <Stats
            items={statuses.map((value) => ({
              label: deliveryStatusLabels[value],
              value: deliveries.filter((delivery) => delivery.status === value)
                .length,
            }))}
          />
          <div className="toolbar">
            <label>
              Buscar entrega
              <input
                type="search"
                placeholder="Pedido, cliente o dirección"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label>
              Estado
              <select
                value={status}
                onChange={(event) => {
                  const next = event.target.value
                  if (!next || statuses.some((value) => value === next))
                    setStatus(next as DeliveryStatus | '')
                }}
              >
                <option value="">Todos los estados</option>
                {statuses.map((value) => (
                  <option key={value} value={value}>
                    {deliveryStatusLabels[value]}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="text-button"
              onClick={() => {
                setQuery('')
                setStatus('')
              }}
            >
              Limpiar filtros
            </button>
          </div>
          <p
            className="muted"
            role="status"
            id="delivery-results"
            tabIndex={-1}
          >
            {visible.length}{' '}
            {visible.length === 1
              ? 'entrega de ejemplo'
              : 'entregas de ejemplo'}
          </p>
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          <section
            className="delivery-grid"
            aria-label="Entregas de demostración"
          >
            {visible.map((delivery) => (
              <DeliveryCard
                key={delivery.id}
                delivery={delivery}
                onDetail={() => setDetailId(delivery.id)}
                onAdvance={() => setConfirmId(delivery.id)}
              />
            ))}
          </section>
          {!visible.length && (
            <p className="empty-state large">
              No hay entregas que coincidan con los filtros.
            </p>
          )}
        </>
      )}
      {detail && (
        <DeliveryDetail delivery={detail} onClose={() => setDetailId(null)} />
      )}
      {confirming && confirming.status !== 'entregado' && (
        <ConfirmDialog
          title={
            confirming.status === 'listo'
              ? 'Retirar pedido de ejemplo'
              : 'Confirmar entrega de ejemplo'
          }
          description={`${confirming.id} pasará a ${confirming.status === 'listo' ? 'En camino' : 'Entregado'}. Este cambio es solo una demostración.`}
          onClose={() => setConfirmId(null)}
          onConfirm={() => {
            advance(confirming.id)
            setNotice(
              `${confirming.id}: ${confirming.status === 'listo' ? 'en camino' : 'entregado'}. Cambio de demostración.`,
            )
            setConfirmId(null)
            window.requestAnimationFrame(() =>
              document
                .getElementById('delivery-results')
                ?.focus({ preventScroll: true }),
            )
          }}
        />
      )}
    </div>
  )
}
