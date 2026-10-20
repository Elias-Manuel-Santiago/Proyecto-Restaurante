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
            className={`status status--${dish.available ? 'listo' : 'cancelado'}`}
          >
            {dish.available ? 'Disponible' : 'Agotado'}
          </span>
        </div>
        <h3>{dish.name}</h3>
        <p>{dish.description}</p>
        <strong>{money(dish.price)}</strong>
        {children && <div className="card-actions">{children}</div>}
      </div>
    </article>
  )
}
