import { useState } from 'react'
import { ConfirmDialog } from '../components/Dialog'
import { DeliveryCard } from '../components/DeliveryCard'
import { DeliveryDetail } from '../components/DeliveryDetail'
import { ErrorMessage } from '../components/ErrorMessage'
import { Stats } from '../components/Stats'
import { useDeliveries } from '../state/useDeliveries'
import { deliveryStatusLabels, type DeliveryStatus } from '../types/delivery'

const statuses: DeliveryStatus[] = [
  'esperando_pago',
  'en_cocina',
  'listo',
  'en_camino',
  'entregado',
]

export function CourierPage() {
  const { deliveries, loading, busy, error, refresh, advance } = useDeliveries()
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
  return (
    <div className="courier-workspace" aria-busy={loading || busy}>
      <section className="page-intro">
        <div>
          <span className="eyebrow">Reparto · Tus entregas</span>
        </div>
        <button
          className="secondary-button"
          disabled={loading || busy}
          onClick={() => void refresh()}
        >
          Actualizar entregas
        </button>
      </section>
      {error && <ErrorMessage error={error} />}
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
            onChange={(event) =>
              setStatus(event.target.value as DeliveryStatus | '')
            }
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
      <p className="muted" role="status" id="delivery-results" tabIndex={-1}>
        {loading
          ? 'Cargando entregas…'
          : `${visible.length} ${visible.length === 1 ? 'entrega' : 'entregas'}`}
      </p>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <section className="delivery-grid" aria-label="Entregas asignadas">
        {visible.map((delivery) => (
          <DeliveryCard
            key={delivery.id}
            delivery={delivery}
            onDetail={() => setDetailId(delivery.id)}
            onAdvance={() => {
              if (!busy) setConfirmId(delivery.id)
            }}
          />
        ))}
      </section>
      {!loading && !error && !visible.length && (
        <p className="empty-state large">
          {deliveries.length
            ? 'No hay entregas que coincidan con los filtros.'
            : 'No tenés envíos asignados. Aparecerán cuando se registren desde Pedidos.'}
        </p>
      )}
      {detail && (
        <DeliveryDetail delivery={detail} onClose={() => setDetailId(null)} />
      )}
      {confirming && ['listo', 'en_camino'].includes(confirming.status) && (
        <ConfirmDialog
          title={
            confirming.status === 'listo'
              ? 'Retirar pedido'
              : 'Confirmar entrega'
          }
          description={`Pedido ${confirming.id}: ${confirming.status === 'listo' ? 'confirmá que lo retiraste de cocina' : 'confirmá que llegó a destino'}.`}
          error={error || undefined}
          onClose={() => {
            if (!busy) setConfirmId(null)
          }}
          onConfirm={async () => {
            if (await advance(confirming)) {
              setNotice(
                `Pedido ${confirming.id}: ${confirming.status === 'listo' ? 'en camino' : 'entregado'}.`,
              )
              setConfirmId(null)
              window.requestAnimationFrame(() =>
                document
                  .getElementById('delivery-results')
                  ?.focus({ preventScroll: true }),
              )
            }
          }}
        />
      )}
    </div>
  )
}
