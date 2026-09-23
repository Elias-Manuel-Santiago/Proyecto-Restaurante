import { useState } from 'react'

type Route = '/mesas' | '/menu' | '/pedidos'
interface Props { currentRoute: string; onNavigate: (route: Route) => void }
const navigation: Array<{ route: Route; label: string }> = [
  { route: '/mesas', label: 'Mapa de mesas' }, { route: '/menu', label: 'Menú' }, { route: '/pedidos', label: 'Pedidos' },
]

export function AppHeader({ currentRoute, onNavigate }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = (route: Route) => { onNavigate(route); setIsOpen(false) }
  return <header className="app-header">
    <div className="header-inner">
      <button className="brand" onClick={() => navigate('/mesas')} aria-label="Ir al mapa de mesas">
        <span className="brand-mark">N</span><span>NÁCAR <small>RESTAURANTE</small></span>
      </button>
      <button className="menu-toggle" onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen} aria-label="Abrir navegación"><span></span><span></span><span></span></button>
      <nav className={isOpen ? 'main-nav is-open' : 'main-nav'}>{navigation.map((item) => <button key={item.route} className={currentRoute === item.route ? 'active' : ''} onClick={() => navigate(item.route)}>{item.label}</button>)}</nav>
    </div>
  </header>
}
