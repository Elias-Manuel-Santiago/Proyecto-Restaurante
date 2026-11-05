import { ErrorMessage } from '../components/ErrorMessage'
import { useState } from 'react'
import { OrderCard } from '../components/OrderCard'
import { FloorPlan } from '../features/floor-plan/FloorPlan'
import { ConfirmDialog, Dialog } from '../components/Dialog'
import { OrderComposer } from '../components/OrderComposer'
import { DeliveryEditor } from '../components/DeliveryEditor'
import { Stats } from '../components/Stats'
import { useTableService } from '../features/table-service/useTableService'
import { isActive, money } from '../state/model'

export function TablesPage() {
  const {
    data,
    session,
    selected,
    selectedOrders,
    diners,
    setDiners,
    error,
    confirmClose,
    setConfirmClose,
    composing,
    setComposing,
    hasActiveOrders,
    consumption,
    select,
    open,
    close,
    deliver,
    clearError,
    dismiss,
  } = useTableService()
  const [filter, setFilter] = useState('')
  const [creatingDelivery, setCreatingDelivery] = useState(false)
  return (
    <>
      <section className="page-intro">
        <div>
          <span className="eyebrow">Salón · Servicio en vivo</span>
          <h1>El pulso del salón</h1>
          <p>Una mesa, una experiencia. Todo listo para un servicio atento.</p>
        </div>
        <span className="service-label">
          <i />
          Turno actual
        </span>
        {(session?.role === 'mozo' || session?.role === 'admin') && (
          <button
            className="primary-button"
            onClick={() => setCreatingDelivery(true)}
          >
            Crear envío
          </button>
        )}
      </section>
      <Stats
        items={[
          {
            label: 'Mesas ocupadas',
            value: `${data.tables.filter((table) => table.status === 'ocupada').length} / ${data.tables.length}`,
          },
          {
            label: 'Pedidos activos',
            value: data.orders.filter(isActive).length,
          },
          {
            label: 'Listos para entregar',
            value: data.orders.filter((order) => order.status === 'listo')
              .length,
          },
        ]}
      />
      <div className="section-heading">
        <h2>Mapa de mesas</h2>
        <div className="segmented" aria-label="Disponibilidad">
          {[
            ['', 'Todas'],
            ['desocupada', 'Disponibles'],
            ['ocupada', 'Ocupadas'],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <FloorPlan filter={filter} onSelect={select} />
      {!data.tables.some((table) => !filter || table.status === filter) && (
        <p className="empty-state">No hay mesas con esta disponibilidad.</p>
      )}
      {selected && (
        <Dialog title={`Mesa ${selected.number}`} onClose={dismiss}>
          <div className="detail-title">
            <span
              className={`status status--${selected.status === 'ocupada' ? 'preparacion' : 'entregado'}`}
            >
              {selected.status === 'ocupada' ? 'Ocupada' : 'Disponible'}
            </span>
            <span className="muted">Capacidad: {selected.capacity}</span>
          </div>
          {selected.status === 'desocupada' ? (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                open()
              }}
            >
              <label>
                Comensales
                <input
                  autoFocus
                  type="number"
                  min={1}
                  max={selected.capacity}
                  required
                  value={diners}
                  onChange={(event) => setDiners(Number(event.target.value))}
                />
              </label>
              <button className="primary-button" type="submit">
                Abrir mesa
              </button>
            </form>
          ) : (
            <>
              <div className="detail-stats">
                <div>
                  <span>Comensales</span>
                  <b>{selected.diners}</b>
                </div>
                <div>
                  <span>Consumo de esta visita</span>
                  <b>{money(consumption)}</b>
                </div>
              </div>
              <div className="actions">
                {session?.role === 'mozo' && (
                  <button
                    className="primary-button"
                    onClick={() => setComposing(true)}
                  >
                    Crear pedido
                  </button>
                )}
                <button
                  className="secondary-button"
                  disabled={hasActiveOrders}
                  onClick={() => {
                    clearError()
                    setConfirmClose(true)
                  }}
                >
                  Cerrar mesa
                </button>
              </div>
              {hasActiveOrders && (
                <p className="muted helper">
                  Para cerrar, entregá o cancelá los pedidos activos.
                </p>
              )}
              <h3>Pedidos de esta visita</h3>
              <div className="detail-orders">
                {selectedOrders.map((order) => (
                  <OrderCard key={order.id} order={order} compact>
                    {session?.role === 'mozo' && order.status === 'listo' && (
                      <button
                        className="primary-button"
                        onClick={() => void deliver(order.id)}
                      >
                        Marcar entregado
                      </button>
                    )}
                  </OrderCard>
                ))}
              </div>
              {!selectedOrders.length && (
                <p className="empty-state">
                  La mesa está abierta. Todavía no hay pedidos.
                </p>
              )}
            </>
          )}
          {error && <ErrorMessage error={error} />}
        </Dialog>
      )}
      {selected && composing && (
        <OrderComposer table={selected} onClose={() => setComposing(false)} />
      )}
      {creatingDelivery && (
        <DeliveryEditor onClose={() => setCreatingDelivery(false)} />
      )}
      {selected && confirmClose && (
        <ConfirmDialog
          title={`Cerrar mesa ${selected.number}`}
          description="La mesa quedará disponible para una nueva visita. Sus pedidos se conservan en el historial. Cerrar no registra un cobro."
          onClose={() => setConfirmClose(false)}
          error={error}
          onConfirm={close}
        />
      )}
    </>
  )
}
