import type { ReactNode } from 'react'
import type { MenuDish } from '../types'
import { money } from '../state/model'
export function MenuDishCard({
  dish,
  children,
}: {
  dish: MenuDish
  children?: ReactNode
}) {
  return (
    <article className="dish-card">
      <div className="dish-card-content">
        <div className="dish-meta">
          <span className="eyebrow">{dish.category}</span>
          <span
            className={`status status--${dish.available && dish.portions !== 0 ? 'listo' : 'cancelado'}`}
          >
            {!dish.available
              ? 'Agotado'
              : dish.portions === 0
                ? 'Sin stock'
                : 'Disponible'}
          </span>
        </div>
        <h3>{dish.name}</h3>
        <p>{dish.description}</p>
        <strong>{money(dish.price)}</strong>
        {dish.portions !== null && dish.portions !== undefined && (
          <small className="stock-hint">
            {dish.portions
              ? `Stock para ${dish.portions} ${dish.portions === 1 ? 'porción' : 'porciones'}`
              : `Falta ${dish.missingIngredient ?? 'un insumo'}`}
          </small>
        )}
        {children && <div className="card-actions">{children}</div>}
      </div>
    </article>
  )
}
