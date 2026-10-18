import { ErrorMessage } from '../components/ErrorMessage'
import { useState } from 'react'
import { MenuDishCard } from '../components/MenuDishCard'
import { DishEditor } from '../components/DishEditor'
import { ConfirmDialog } from '../components/Dialog'
import { useRestaurant } from '../state/useRestaurant'
import { categories, type MenuDish } from '../types'
import { isActive } from '../state/model'

export function MenuPage() {
  const { data, session, act } = useRestaurant()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [availability, setAvailability] = useState('')
  const [editing, setEditing] = useState<MenuDish | 'new' | null>(null)
  const [deleting, setDeleting] = useState<MenuDish | null>(null)
  const [error, setError] = useState<string | Error>('')
  const [notice, setNotice] = useState('')
  const visible = data.dishes.filter(
    (dish) =>
      (!category || dish.category === category) &&
      (!availability || dish.available === (availability === 'available')) &&
      dish.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  )
  const canManage = session?.role === 'admin'
  const canToggle = canManage || session?.role === 'chef'
  return (
    <>
      <section className="page-intro">
        <div>
          <span className="eyebrow">Carta de temporada</span>
          <h1>Sabores de NÁCAR</h1>
          <p>
            Una selección pensada para compartir. Disponibilidad actualizada por
            cocina.
          </p>
        </div>
        {canManage ? (
          <button className="primary-button" onClick={() => setEditing('new')}>
            Agregar plato
          </button>
        ) : (
          <p className="item-count">
            {data.dishes.filter((dish) => dish.available).length} platos
            disponibles
          </p>
        )}
      </section>
      <div className="toolbar">
        <label>
          Buscar plato
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre del plato"
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
        <label>
          Disponibilidad
          <select
            value={availability}
            onChange={(event) => setAvailability(event.target.value)}
          >
            <option value="">Todos</option>
            <option value="available">Disponibles</option>
            <option value="unavailable">Agotados</option>
          </select>
        </label>
      </div>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {error && !deleting && <ErrorMessage error={error} />}
      <div className="menu-sections">
        {categories.map((item) => {
          const dishes = visible.filter((dish) => dish.category === item)
          if (!dishes.length) return null
          return (
            <section key={item} className="menu-category">
              <h2>{item}</h2>
              <div className="dish-grid">
                {dishes.map((dish) => {
                  const blocked = data.orders.some(
                    (order) =>
                      isActive(order) &&
                      order.items.some(
                        (orderItem) => orderItem.dishId === dish.id,
                      ),
                  )
                  return (
                    <MenuDishCard key={dish.id} dish={dish}>
                      {canToggle && (
                        <button
                          className="secondary-button"
                          aria-pressed={dish.available}
                          onClick={async () => {
                            const message = await act({
                              type: 'availability',
                              id: dish.id,
                              available: !dish.available,
                            })
                            setError(message)
                            if (!message)
                              setNotice(
                                `${dish.name}: ${dish.available ? 'agotado' : 'disponible'}.`,
                              )
                          }}
                        >
                          {dish.available
                            ? 'Marcar agotado'
                            : 'Habilitar plato'}
                        </button>
                      )}
                      {canManage && (
                        <>
                          <button
                            className="text-button"
                            onClick={() => setEditing(dish)}
                          >
                            Editar
                          </button>
                          <button
                            className="text-button danger-text"
                            disabled={blocked}
                            title={
                              blocked ? 'Tiene pedidos activos' : undefined
                            }
                            onClick={() => {
                              setError('')
                              setDeleting(dish)
                            }}
                          >
                            Eliminar
                          </button>
                          {blocked && (
                            <small className="muted">
                              Borrado bloqueado: pedidos activos.
                            </small>
                          )}
                        </>
                      )}
                    </MenuDishCard>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
      {!visible.length && (
        <p className="empty-state large">
          No hay platos que coincidan con tu búsqueda.
        </p>
      )}
      {editing && (
        <DishEditor
          dish={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Eliminar plato"
          description={`¿Eliminar ${deleting.name} de la carta? Los pedidos históricos conservarán su nombre y precio.`}
          error={error}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const message = await act({ type: 'deleteDish', id: deleting.id })
            setError(message)
            if (!message) setDeleting(null)
          }}
        />
      )}
    </>
  )
}
