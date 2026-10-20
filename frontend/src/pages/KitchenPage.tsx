import { ErrorMessage } from '../components/ErrorMessage'
import { useEffect, useRef, useState } from 'react'
import { Dialog } from '../components/Dialog'
import { OrderCard } from '../components/OrderCard'
import { PriorityOrder } from '../components/PriorityOrder'
import { compareOrderPriority } from '../state/model'
import { useRestaurant } from '../state/useRestaurant'
import { statusLabels, type Order } from '../types'

const states = ['pendiente', 'preparacion', 'listo'] as const
type KitchenStatus = (typeof states)[number]
const pageSize = 6
const stateDescriptions: Record<KitchenStatus, string> = {
  pendiente: 'Por comenzar',
  preparacion: 'En marcha en cocina',
  listo: 'Esperando retiro del mozo',
}

function KitchenLane({
  status,
  orders,
  now,
  onDetail,
  onAdvance,
  onMove,
  canReorder,
}: {
  status: KitchenStatus
  orders: Order[]
  now: number
  onDetail: (id: string) => void
  onAdvance: (order: Order) => void
  onMove: (id: string, targetId: string, before: boolean) => void
  canReorder: boolean
}) {
  const [page, setPage] = useState(1)
  const [showAll, setShowAll] = useState(false)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const pageCount = Math.max(1, Math.ceil(orders.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageOrders = showAll
    ? orders
    : orders.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const goToPage = (next: number) => {
    setPage(next)
    headingRef.current?.focus({ preventScroll: true })
    headingRef.current?.scrollIntoView({ block: 'start' })
  }

  return (
    <section
      className={`kitchen-lane column--${status}`}
      aria-labelledby={`kitchen-heading-${status}`}
    >
      <header className="kitchen-lane-heading">
        <div>
          <h2 ref={headingRef} id={`kitchen-heading-${status}`} tabIndex={-1}>
            <span
              className={`status-dot status-dot--${status}`}
              aria-hidden="true"
            />
            {statusLabels[status]}
            <span className="kitchen-count">{orders.length}</span>
          </h2>
          <p>{stateDescriptions[status]}</p>
        </div>
        {orders.length > pageSize && !showAll && (
          <nav
            className="kitchen-pagination"
            aria-label={`Páginas de ${statusLabels[status].toLocaleLowerCase()}`}
          >
            <button
              className="secondary-button"
              disabled={currentPage === 1}
              aria-label={`Anteriores: ${statusLabels[status].toLocaleLowerCase()}`}
              onClick={() => goToPage(currentPage - 1)}
            >
              ←
            </button>
            <span>
              Página {currentPage} de {pageCount}
            </span>
            <button
              className="secondary-button"
              disabled={currentPage === pageCount}
              aria-label={`Siguientes: ${statusLabels[status].toLocaleLowerCase()}`}
              onClick={() => goToPage(currentPage + 1)}
            >
              →
            </button>
          </nav>
        )}
        {orders.length > pageSize && (
          <button
            className="secondary-button"
            disabled={!canReorder}
            aria-expanded={showAll}
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Volver a páginas' : 'Ver todos para reordenar'}
          </button>
        )}
      </header>
      <div className="kitchen-orders-grid">
        {pageOrders.map((order) => (
          <PriorityOrder
            key={order.id}
            id={order.id}
            ids={orders.map((item) => item.id)}
            disabled={!canReorder}
            isTarget={dropTarget === order.id}
            onMove={onMove}
            onTargetChange={setDropTarget}
          >
            <OrderCard order={order} kitchen now={now}>
              <button
                className="secondary-button"
                aria-label={`Ver detalle del pedido #${order.id}`}
                onClick={() => onDetail(order.id)}
              >
                Ver detalle
              </button>
              {status !== 'listo' && (
                <button
                  className="primary-button"
                  aria-label={`${status === 'pendiente' ? 'Iniciar preparación' : 'Marcar listo'} del pedido #${order.id}`}
                  onClick={() => onAdvance(order)}
                >
                  {status === 'pendiente'
                    ? 'Iniciar preparación'
                    : 'Marcar listo'}
                </button>
              )}
            </OrderCard>
          </PriorityOrder>
        ))}
        {!orders.length && (
          <p className="empty-state">
            Sin comandas en este estado con los filtros actuales.
          </p>
        )}
      </div>
    </section>
  )
}

export function KitchenPage() {
  const { data, session, busy, loading, act } = useRestaurant()
  const [now, setNow] = useState(() => Date.now())
  const [table, setTable] = useState('')
  const [waiter, setWaiter] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<KitchenStatus | ''>('')
  const [onlyLate, setOnlyLate] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [error, setError] = useState<string | Error>('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const search = query.trim().toLocaleLowerCase()
  const active = data.orders.filter((order) =>
    states.some((status) => status === order.status),
  )
  const visible = active
    .filter(
      (order) =>
        (!table || order.tableNumber === Number(table)) &&
        (!waiter || order.waiterId === waiter) &&
        (!onlyLate || now - Date.parse(order.createdAt) >= 15 * 60000) &&
        (!search ||
          order.id.toLocaleLowerCase().includes(search) ||
          order.items.some((item) =>
            item.dishName.toLocaleLowerCase().includes(search),
          )),
    )
    .sort(compareOrderPriority)
  const waiterOptions = Array.from(
    new Map(
      data.orders.map((order) => [order.waiterId, order.waiterName]),
    ).entries(),
  )
  const detail = data.orders.find((order) => order.id === detailId)
  const move = async (id: string, targetId: string, before: boolean) => {
    const message = await act({ type: 'reorderOrder', id, targetId, before })
    setError(message)
    setNotice(message ? '' : `Prioridad del pedido #${id} actualizada.`)
  }
  const advance = async (order: Order) => {
    const nextStatus = order.status === 'pendiente' ? 'preparacion' : 'listo'
    const message = await act({
      type: 'transition',
      id: order.id,
      status: nextStatus,
    })
    setError(message)
    setNotice(
      message
        ? ''
        : `Pedido #${order.id}: ${statusLabels[nextStatus].toLocaleLowerCase()}.`,
    )
    if (!message)
      window.requestAnimationFrame(() =>
        document
          .getElementById(`kitchen-filter-${nextStatus}`)
          ?.focus({ preventScroll: true }),
      )
  }

  return (
    <div className="kitchen-workspace">
      <section className="page-intro">
        <div>
          <span className="eyebrow">Cocina · Comandas en vivo</span>
          <h1>Al ritmo de la cocina</h1>
          <p>
            Arrastrá desde el asa para priorizar dentro de cada estado. El salón
            verá el mismo orden.
          </p>
        </div>
        <time className="kitchen-clock" aria-label="Hora actual">
          {new Date(now).toLocaleTimeString('es-AR', { hour12: false })}
        </time>
      </section>
      <div
        className="kitchen-status-filters"
        role="group"
        aria-label="Filtrar comandas por estado"
      >
        <button
          className="kitchen-state-filter"
          aria-pressed={!statusFilter}
          onClick={() => setStatusFilter('')}
        >
          <span>Todos los estados</span>
          <strong>{active.length}</strong>
        </button>
        {states.map((status) => (
          <button
            id={`kitchen-filter-${status}`}
            key={status}
            className={`kitchen-state-filter kitchen-state-filter--${status}`}
            aria-pressed={statusFilter === status}
            onClick={() => setStatusFilter(status)}
          >
            <span>
              <i
                className={`status-dot status-dot--${status}`}
                aria-hidden="true"
              />
              {statusLabels[status]}
            </span>
            <strong>
              {active.filter((order) => order.status === status).length}
            </strong>
          </button>
        ))}
      </div>
      <div className="toolbar kitchen-toolbar">
        <label className="kitchen-search">
          Buscar comanda
          <input
            type="search"
            placeholder="N.º de pedido o plato"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          Mesa
          <select
            value={table}
            onChange={(event) => setTable(event.target.value)}
          >
            <option value="">Todas las mesas</option>
            {data.tables.map((item) => (
              <option key={item.id} value={item.number}>
                Mesa {item.number}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mozo
          <select
            value={waiter}
            onChange={(event) => setWaiter(event.target.value)}
          >
            <option value="">Todos</option>
            {waiterOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={onlyLate}
            onChange={(event) => setOnlyLate(event.target.checked)}
          />
          Solo demorados (15 min)
        </label>
        <button
          className="text-button"
          onClick={() => {
            setTable('')
            setWaiter('')
            setQuery('')
            setStatusFilter('')
            setOnlyLate(false)
          }}
        >
          Limpiar filtros
        </button>
      </div>
      <p className="kitchen-results" role="status">
        {
          visible.filter(
            (order) => !statusFilter || order.status === statusFilter,
          ).length
        }{' '}
        comandas coinciden · Prioridad de cocina
      </p>
      {error && <ErrorMessage error={error} />}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <div className="kitchen-board kitchen-board--horizontal">
        {states
          .filter((status) => !statusFilter || status === statusFilter)
          .map((status) => (
            <KitchenLane
              key={JSON.stringify([status, table, waiter, search, onlyLate])}
              status={status}
              orders={visible.filter((order) => order.status === status)}
              now={now}
              onDetail={setDetailId}
              onAdvance={advance}
              onMove={move}
              canReorder={session?.role === 'chef' && !busy && !loading}
            />
          ))}
      </div>
      {detail && (
        <Dialog
          title={`Pedido #${detail.id}`}
          onClose={() => setDetailId(null)}
        >
          <OrderCard order={detail} now={now} />
          <h3 className="spaced">Recorrido de la comanda</h3>
          <ol className="timeline">
            {detail.history.map((event) => (
              <li key={event.status}>
                <strong>{statusLabels[event.status]}</strong>
                <span>
                  {new Date(event.at).toLocaleString('es-AR', {
                    hour12: false,
                  })}{' '}
                  · {event.actor}
                </span>
              </li>
            ))}
          </ol>
        </Dialog>
      )}
    </div>
  )
}
