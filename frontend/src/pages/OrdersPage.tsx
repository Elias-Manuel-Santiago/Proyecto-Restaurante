import { OrderComposer } from '../components/OrderComposer'
import { ErrorMessage } from '../components/ErrorMessage'
import { useEffect, useRef, useState } from 'react'
import { OrderCard } from '../components/OrderCard'
import {
  OrderFilters,
  type OrderFilterValues,
} from '../components/OrderFilters'
import { ConfirmDialog, Dialog } from '../components/Dialog'
import { useRestaurant } from '../state/useRestaurant'
import { compareOrderPriority, isActive } from '../state/model'
import { restaurantStore } from '../state/store'
import { statusLabels } from '../types'

const pageSize = 12

export function OrdersPage({ history = false }: { history?: boolean }) {
  const { data, session, act } = useRestaurant()
  const [filters, setFilters] = useState<OrderFilterValues>({
    status: '',
    table: '',
    waiterId: '',
  })
  const [date, setDate] = useState('')
  const [query, setQuery] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [error, setError] = useState<string | Error>('')
  const [notice, setNotice] = useState('')
  const [page, setPage] = useState(1)
  const resultsRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    void restaurantStore.refresh(true)
  }, [])
  const search = query.trim().toLocaleLowerCase()
  const visibleOrders = data.orders
    .filter(
      (order) =>
        (!filters.status || order.status === filters.status) &&
        (!filters.table || order.tableNumber === Number(filters.table)) &&
        (!filters.waiterId || order.waiterId === filters.waiterId) &&
        (!date ||
          new Date(order.createdAt).toLocaleDateString('sv-SE') === date) &&
        (!search ||
          order.id.includes(search) ||
          order.items.some((item) =>
            item.dishName.toLocaleLowerCase().includes(search),
          )),
    )
    .sort(
      history
        ? (first, second) =>
            (Date.parse(second.createdAt) || 0) -
            (Date.parse(first.createdAt) || 0)
        : compareOrderPriority,
    )
  const pageCount = Math.max(1, Math.ceil(visibleOrders.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageOrders = visibleOrders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )
  const firstPage = Math.max(1, Math.min(currentPage - 2, pageCount - 4))
  const pages = Array.from(
    { length: Math.min(5, pageCount) },
    (_, index) => firstPage + index,
  )
  const goToPage = (next: number) => {
    setPage(next)
    resultsRef.current?.focus({ preventScroll: true })
    resultsRef.current?.scrollIntoView({ block: 'start' })
  }
  const detail = data.orders.find((order) => order.id === detailId)
  const editing = data.orders.find((order) => order.id === editId)
  const editTable = data.tables.find((table) => table.id === editing?.tableId)
  return (
    <div className="orders-workspace">
      <section className="page-intro">
        <div>
          <span className="eyebrow">
            {history ? 'Archivo del servicio' : 'Seguimiento en vivo'}
          </span>
          <h1>{history ? 'Historial de pedidos' : 'Pedidos del salón'}</h1>
          <p>
            De la primera comanda a la entrega. Cada paso, en un mismo lugar.
          </p>
        </div>
        <span className="service-label">{visibleOrders.length} comandas</span>
      </section>
      <OrderFilters
        values={filters}
        onChange={(values) => {
          setFilters(values)
          setPage(1)
        }}
        query={query}
        onQueryChange={(value) => {
          setQuery(value)
          setPage(1)
        }}
        date={date}
        onDateChange={(value) => {
          setDate(value)
          setPage(1)
        }}
        onReset={() => {
          setDate('')
          setQuery('')
          setFilters({ status: '', table: '', waiterId: '' })
          setPage(1)
        }}
      />
      <div className="orders-results-bar">
        <p
          ref={resultsRef}
          id="orders-results"
          className="result-summary"
          tabIndex={-1}
          role="status"
        >
          {visibleOrders.length}{' '}
          {visibleOrders.length === 1
            ? 'pedido encontrado'
            : 'pedidos encontrados'}
          {visibleOrders.length > 0 && (
            <>
              {' '}
              · Mostrando {(currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, visibleOrders.length)}
            </>
          )}
        </p>
        <span>
          {history ? '' : 'Prioridad de cocina · '}Hasta {pageSize} por página
        </span>
      </div>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {error && !cancelId && <ErrorMessage error={error} />}
      <section
        className="orders-grid orders-overview-grid"
        aria-label="Pedidos del servicio"
      >
        {pageOrders.map((order) => (
          <OrderCard key={order.id} order={order} summary>
            <button
              className="secondary-button"
              aria-label={`Ver detalle del pedido #${order.id}`}
              onClick={() => setDetailId(order.id)}
            >
              Ver detalle
            </button>
            {session?.role === 'mozo' && order.status === 'listo' && (
              <button
                className="primary-button"
                aria-label={`Marcar entregado el pedido #${order.id}`}
                onClick={async () => {
                  const message = await act({
                    type: 'transition',
                    id: order.id,
                    status: 'entregado',
                  })
                  setError(message)
                  if (!message) setNotice(`Pedido #${order.id} entregado.`)
                }}
              >
                Marcar entregado
              </button>
            )}
            {order.status === 'pendiente' &&
              (session?.role === 'mozo' || session?.role === 'admin') && (
                <button
                  className="secondary-button"
                  onClick={() => setEditId(order.id)}
                >
                  Editar pedido
                </button>
              )}
            {isActive(order) &&
              (session?.role === 'mozo' || session?.role === 'admin') && (
                <button
                  className="text-button danger-text"
                  aria-label={`Cancelar pedido #${order.id}`}
                  onClick={() => {
                    setError('')
                    setCancelId(order.id)
                  }}
                >
                  Cancelar pedido
                </button>
              )}
          </OrderCard>
        ))}
      </section>
      {!visibleOrders.length && (
        <p className="empty-state large">
          No hay pedidos que coincidan con los filtros.
        </p>
      )}
      {pageCount > 1 && (
        <nav className="orders-pagination" aria-label="Páginas de pedidos">
          <button
            className="secondary-button"
            disabled={currentPage === 1}
            onClick={() => goToPage(currentPage - 1)}
          >
            Anterior
          </button>
          <div className="pagination-numbers">
            {pages.map((number) => (
              <button
                className="secondary-button"
                key={number}
                aria-label={`Página ${number}`}
                aria-current={number === currentPage ? 'page' : undefined}
                onClick={() => goToPage(number)}
              >
                {number}
              </button>
            ))}
          </div>
          <span>
            Página {currentPage} de {pageCount}
          </span>
          <button
            className="secondary-button"
            disabled={currentPage === pageCount}
            onClick={() => goToPage(currentPage + 1)}
          >
            Siguiente
          </button>
        </nav>
      )}
      {detail && (
        <Dialog
          title={`Pedido #${detail.id}`}
          onClose={() => setDetailId(null)}
        >
          <OrderCard order={detail} />
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
      {editing && editTable && (
        <OrderComposer
          table={editTable}
          order={editing}
          onClose={() => setEditId(null)}
        />
      )}
      {cancelId && (
        <ConfirmDialog
          title={`Cancelar pedido #${cancelId}`}
          description="La comanda se retirará del circuito activo y de los indicadores de consumo. Se conservará en el historial."
          onClose={() => setCancelId(null)}
          error={error}
          onConfirm={async () => {
            const message = await act({
              type: 'transition',
              id: cancelId,
              status: 'cancelado',
            })
            setError(message)
            if (!message) {
              setNotice(`Pedido #${cancelId} cancelado.`)
              setCancelId(null)
            }
          }}
        />
      )}
    </div>
  )
}
