import { ErrorMessage } from './ErrorMessage'
import { useState } from 'react'
import {
  categories,
  type DraftItem,
  type RestaurantTable,
  type Order,
} from '../types'
import { money } from '../state/model'
import { useRestaurant } from '../state/useRestaurant'
import { Dialog } from './Dialog'

export function OrderComposer({
  table,
  order,
  delivery,
  onClose,
}: {
  table?: RestaurantTable
  order?: Order
  delivery?: import('../types/delivery').DeliveryDraft
  onClose: () => void
}) {
  const { data, act } = useRestaurant()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [items, setItems] = useState<DraftItem[]>(
    () =>
      order?.items.map(({ dishId, quantity, notes }) => ({
        dishId,
        quantity,
        notes,
      })) ?? [],
  )
  const [error, setError] = useState<string | Error>('')
  const visible = data.dishes.filter(
    (dish) =>
      (!category || dish.category === category) &&
      dish.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  )
  const total = items.reduce(
    (sum, item) =>
      sum +
      item.quantity *
        (data.dishes.find((dish) => dish.id === item.dishId)?.price ?? 0),
    0,
  )
  const update = (dishId: string, quantity: number) => {
    if (quantity < 0 || quantity > 99 || !Number.isInteger(quantity)) return
    setItems((current) =>
      quantity === 0
        ? current.filter((item) => item.dishId !== dishId)
        : current.some((item) => item.dishId === dishId)
          ? current.map((item) =>
              item.dishId === dishId ? { ...item, quantity } : item,
            )
          : [...current, { dishId, quantity, notes: '' }],
    )
  }
  const submit = async () => {
    const message = await act(
      order
        ? { type: 'editOrder', id: order.id, items }
        : delivery
          ? { type: 'createDelivery', delivery, items }
          : { type: 'createOrder', tableId: table!.id, items },
    )
    setError(message)
    if (!message) onClose()
  }
  return (
    <Dialog
      title={
        order
          ? `Editar pedido #${order.id}`
          : delivery
            ? 'Nuevo envío a domicilio'
            : `Nuevo pedido · Mesa ${table?.number}`
      }
      onClose={onClose}
      wide
    >
      <p className="muted">
        {table
          ? `${table.diners} comensales · `
          : delivery
            ? `${delivery.destinatario} · ${delivery.direccion}. `
            : 'Envío a domicilio · '}
        Los precios se fijan al enviar a cocina.
      </p>
      <div className="composer-layout">
        <section>
          <div className="toolbar">
            <label>
              Buscar plato
              <input
                autoFocus
                type="search"
                placeholder="Nombre del plato"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label>
              Categoría
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="">Todas</option>
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="composer-menu">
            {visible.length ? (
              visible.map((dish) => {
                const quantity =
                  items.find((item) => item.dishId === dish.id)?.quantity ?? 0
                return (
                  <article key={dish.id} className="composer-dish">
                    <div>
                      <h3>{dish.name}</h3>
                      <p>{dish.description}</p>
                      <strong>{money(dish.price)}</strong>
                      {!dish.available && (
                        <span className="status status--cancelado">
                          No disponible
                        </span>
                      )}
                    </div>
                    <div className="quantity">
                      <button
                        className="icon-button"
                        disabled={!quantity}
                        aria-label={`Quitar uno de ${dish.name}`}
                        onClick={() => update(dish.id, quantity - 1)}
                      >
                        −
                      </button>
                      <output aria-label={`Cantidad de ${dish.name}`}>
                        {quantity}
                      </output>
                      <button
                        className="icon-button"
                        disabled={!dish.available || quantity >= 99}
                        aria-label={`Agregar ${dish.name}`}
                        onClick={() => update(dish.id, quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                  </article>
                )
              })
            ) : (
              <p className="empty-state">
                No encontramos platos con esa búsqueda.
              </p>
            )}
          </div>
        </section>
        <section className="order-summary">
          <span className="eyebrow">Comanda</span>
          <h3>Tu pedido</h3>
          {items.length ? (
            items.map((item) => {
              const dish = data.dishes.find(
                (candidate) => candidate.id === item.dishId,
              )
              return (
                <div className="summary-item" key={item.dishId}>
                  <strong>
                    {item.quantity} × {dish?.name ?? 'Plato eliminado'}
                  </strong>
                  <span>{money(item.quantity * (dish?.price ?? 0))}</span>
                  {!dish?.available && (
                    <p className="form-error">
                      Quitá este plato: ya no está disponible.
                    </p>
                  )}
                  <label>
                    Observaciones para {dish?.name ?? 'el plato'}
                    <textarea
                      maxLength={300}
                      rows={2}
                      value={item.notes}
                      placeholder="Punto de cocción, sin sal…"
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((candidate) =>
                            candidate.dishId === item.dishId
                              ? { ...candidate, notes: event.target.value }
                              : candidate,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    className="text-button"
                    onClick={() => update(item.dishId, 0)}
                  >
                    Quitar plato
                  </button>
                </div>
              )
            })
          ) : (
            <p className="muted">Agregá platos de la carta para empezar.</p>
          )}
          <div className="total">
            <span>Total de consumo</span>
            <strong>{money(total)}</strong>
          </div>
          {error && <ErrorMessage error={error} />}
          <button
            className="primary-button"
            disabled={!items.length}
            onClick={submit}
          >
            {order ? 'Guardar cambios' : 'Enviar a cocina'}
          </button>
          <button className="text-button" onClick={onClose}>
            Descartar borrador
          </button>
        </section>
      </div>
    </Dialog>
  )
}
