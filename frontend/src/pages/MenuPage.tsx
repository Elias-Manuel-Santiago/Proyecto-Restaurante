import { MenuDishCard } from '../components/MenuDishCard'
import { menuDishes } from '../mocks/restaurant'
const categories = ['Entradas', 'Principales', 'Postres', 'Bebidas'] as const
export function MenuPage() { return <><section className="page-intro"><div><span className="eyebrow">Carta de hoy</span><h1>Menú</h1><p>Una selección de temporada, pensada para compartir.</p></div><p className="item-count">{menuDishes.length} platos disponibles</p></section><div className="menu-sections">{categories.map((category) => { const dishes = menuDishes.filter((dish) => dish.category === category); return <section key={category} className="menu-category"><h2>{category}</h2><div className="dish-grid">{dishes.map((dish) => <MenuDishCard key={dish.id} dish={dish} />)}</div></section> })}</div></> }
