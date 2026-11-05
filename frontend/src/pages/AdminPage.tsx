import { ShippingSettings } from '../components/ShippingSettings'
import { InventorySettings } from '../components/InventorySettings'
import { SummaryPanel } from '../components/SummaryPanel'
import { useState } from 'react'
import { Stats } from '../components/Stats'
import { FloorPlan } from '../components/FloorPlan'
import { useRestaurant } from '../state/useRestaurant'
import { isActive, money, orderTotal, serviceOrders } from '../state/model'
import { statusLabels, type AppRoute, type OrderStatus } from '../types'

export function AdminPage({
  onNavigate,
}: {
  onNavigate: (route: AppRoute) => void
}) {
  const { data } = useRestaurant()
  const [shippingSettings, setShippingSettings] = useState(false)
  const [inventory, setInventory] = useState(false)
  const today = new Date().toLocaleDateString('sv-SE')
  const todayOrders = data.orders.filter(
    (order) => new Date(order.createdAt).toLocaleDateString('sv-SE') === today,
  )
  const statuses: OrderStatus[] = [
    'pendiente',
    'preparacion',
    'listo',
    'entregado',
    'cancelado',
  ]
  const recent = [...data.orders]
    .sort(
      (first, second) =>
        (Date.parse(second.createdAt) || 0) -
        (Date.parse(first.createdAt) || 0),
    )
    .slice(0, 5)
  return (
    <>
      {shippingSettings && (
        <ShippingSettings onClose={() => setShippingSettings(false)} />
      )}
      {inventory && <InventorySettings onClose={() => setInventory(false)} />}
      <div className="actions">
        <button
          className="secondary-button"
          onClick={() => setShippingSettings(true)}
        >
          Modalidades y tarifas de entrega
        </button>
        <button className="secondary-button" onClick={() => setInventory(true)}>
          Inventario y recetas
        </button>
      </div>
      <section className="page-intro">
        <div>
          <span className="eyebrow">Administración · Vista general</span>
          <p>
            Actividad del salón y consumo de hoy.{' '}
            {new Date().toLocaleDateString('es-AR', {
              day: 'numeric',
              month: 'long',
            })}
            .
          </p>
        </div>
        <button
          className="secondary-button"
          onClick={() => onNavigate('/historial')}
        >
          Ver historial
        </button>
      </section>
      <Stats
        items={[
          {
            label: 'Consumo de hoy',
            value: money(
              todayOrders
                .filter((order) => order.status !== 'cancelado')
                .reduce((total, order) => total + orderTotal(order), 0),
            ),
            detail: 'Pedidos enviados, sin cancelados. No son cobros.',
          },
          {
            label: 'Pedidos de hoy',
            value: todayOrders.length,
            detail: `${todayOrders.filter((order) => order.status === 'entregado').length} entregados`,
          },
          {
            label: 'Ocupación del salón',
            value: `${data.tables.filter((table) => table.status === 'ocupada').length} / ${data.tables.length}`,
            detail: `${data.orders.filter(isActive).length} pedidos activos`,
          },
        ]}
      />
      <div className="dashboard-panels">
        <section className="panel">
          <div className="section-heading">
            <h2>Estado del servicio</h2>
            <span className="eyebrow">Hoy</span>
          </div>
          <div className="status-bars">
            {statuses.map((status) => {
              const count = todayOrders.filter(
                (order) => order.status === status,
              ).length
              return (
                <div key={status}>
                  <span>{statusLabels[status]}</span>
                  <meter
                    min={0}
                    max={Math.max(1, todayOrders.length)}
                    value={count}
                    aria-label={statusLabels[status]}
                  />
                  <b>{count}</b>
                </div>
              )
            })}
          </div>
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Últimas comandas</h2>
            <button
              className="text-button"
              onClick={() => onNavigate('/pedidos')}
            >
              Ver todas
            </button>
          </div>
          {recent.map((order) => (
            <div className="recent-order" key={order.id}>
              <span>
                <strong>#{order.id}</strong> ·{' '}
                {order.kind === 'delivery'
                  ? 'Envío'
                  : `Mesa ${order.tableNumber}`}
                <small>
                  {money(orderTotal(order))} · {order.waiterName}
                </small>
              </span>
              <span className={`status status--${order.status}`}>
                {statusLabels[order.status]}
              </span>
            </div>
          ))}
          {!recent.length && (
            <p className="empty-state">Todavía no se registraron pedidos.</p>
          )}
        </section>
      </div>
      <FloorPlan />
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Organización del salón</span>
            <h2>Mesas y consumo</h2>
          </div>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <caption className="sr-only">
              Mesas, capacidad, estado y consumo de la visita actual
            </caption>
            <thead>
              <tr>
                <th scope="col">Mesa</th>
                <th scope="col">Capacidad</th>
                <th scope="col">Estado</th>
                <th scope="col">Comensales</th>
                <th scope="col">Consumo actual</th>
              </tr>
            </thead>
            <tbody>
              {data.tables.map((table) => (
                <tr key={table.id}>
                  <th scope="row">Mesa {table.number}</th>
                  <td>{table.capacity}</td>
                  <td>
                    <span
                      className={`status status--${table.status === 'ocupada' ? 'preparacion' : 'entregado'}`}
                    >
                      {table.status === 'ocupada' ? 'Ocupada' : 'Disponible'}
                    </span>
                  </td>
                  <td>{table.diners}</td>
                  <td>
                    {money(
                      serviceOrders(data, table)
                        .filter((order) => order.status !== 'cancelado')
                        .reduce((sum, order) => sum + orderTotal(order), 0),
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.tables.length && (
          <p className="empty-state">Agregá la primera mesa del salón.</p>
        )}
        <p className="muted helper">
          El consumo corresponde a la visita actual y excluye cancelados. El
          borrado requiere una mesa cerrada, sin pedidos activos.
        </p>
      </section>
      <SummaryPanel />
    </>
  )
}
