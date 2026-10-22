import { useState } from 'react'
import { roleLabels, type AppRoute } from '../types'
import { homeRoute, roleRoutes } from '../state/model'
import { useRestaurant } from '../state/useRestaurant'
import { Icon } from './Icon'

const navigation: {
  route: AppRoute
  label: string
  icon: Parameters<typeof Icon>[0]['name']
}[] = [
  { route: '/admin', label: 'Resumen', icon: 'admin' },
  { route: '/mesas', label: 'Mesas', icon: 'mesas' },
  { route: '/cocina', label: 'Cocina', icon: 'cocina' },
  { route: '/menu', label: 'Menú', icon: 'menu' },
  { route: '/pedidos', label: 'Pedidos', icon: 'pedidos' },
  { route: '/historial', label: 'Historial', icon: 'historial' },
  { route: '/usuarios', label: 'Equipo', icon: 'usuarios' },
  { route: '/reparto', label: 'Mis entregas', icon: 'repartidor' },
]
export function AppHeader({
  currentRoute,
  onNavigate,
  onLogout,
}: {
  currentRoute: AppRoute
  onNavigate: (route: AppRoute) => void
  onLogout: () => void
}) {
  const { session } = useRestaurant()
  const [isOpen, setIsOpen] = useState(false)
  if (!session) return null
  const navigate = (route: AppRoute) => {
    onNavigate(route)
    setIsOpen(false)
  }
  return (
    <header className="app-header">
      <div className="header-inner">
        <button
          className="brand"
          onClick={() => navigate(homeRoute(session.role))}
          aria-label="Ir al inicio"
        >
          <span className="brand-mark">N</span>
          <span>
            NÁCAR <small>RESTAURANTE</small>
          </span>
        </button>
        <button
          className="menu-toggle"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-controls="main-navigation"
          aria-label={isOpen ? 'Cerrar navegación' : 'Abrir navegación'}
        >
          <span />
          <span />
          <span />
        </button>
        <nav
          id="main-navigation"
          aria-label="Navegación principal"
          className={isOpen ? 'main-nav is-open' : 'main-nav'}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setIsOpen(false)
          }}
        >
          {navigation
            .filter((item) => roleRoutes[session.role].includes(item.route))
            .map((item) => (
              <button
                key={item.route}
                className={currentRoute === item.route ? 'active' : ''}
                aria-current={currentRoute === item.route ? 'page' : undefined}
                onClick={() => navigate(item.route)}
              >
                <Icon name={item.icon} />
                {item.label}
              </button>
            ))}
        </nav>
        <div className="header-session">
          <span>
            {session.name}
            <small>{roleLabels[session.role]}</small>
          </span>
          <button className="text-button" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  )
}
