import type { MenuDish } from '../types'
const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
export function MenuDishCard({ dish }: { dish: MenuDish }) {
  return <article className="dish-card"><img src={dish.image} alt={dish.name} /><div className="dish-card-content"><span className="eyebrow">{dish.category}</span><h3>{dish.name}</h3><p>{dish.description}</p><strong>{money.format(dish.price)}</strong></div></article>
}
