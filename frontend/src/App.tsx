import { ErrorMessage } from './components/ErrorMessage'
import { useEffect, useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { LoginPage } from './pages/LoginPage'
import { MenuPage } from './pages/MenuPage'
import { OrdersPage } from './pages/OrdersPage'
import { TablesPage } from './pages/TablesPage'
import { KitchenPage } from './pages/KitchenPage'
import { AdminPage } from './pages/AdminPage'
import { UsersPage } from './pages/UsersPage'
import { useRestaurant } from './state/useRestaurant'
import { restaurantStore } from './state/store'
import { suscribirPrioridadPedidos } from './services/apiAccess'
import { roleRoutes } from './state/model'
import type { AppRoute } from './types'
import './App.css'

function App() {
  const { session, warning, loading, busy, error } = useRestaurant()
  const [path, setPath] = useState(() => window.location.pathname)
  const [routeNotice, setRouteNotice] = useState('')
  const home: AppRoute =
    session?.role === 'chef'
      ? '/cocina'
      : session?.role === 'admin'
        ? '/admin'
        : '/mesas'
  const allowed = session ? roleRoutes[session.role].includes(path) : false
  const route = allowed ? (path as AppRoute) : home
  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname)
      setRouteNotice('')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  useEffect(() => {
    const target = session ? route : '/login'
    if (window.location.pathname !== target)
      window.history.replaceState({}, '', target)
  }, [session, route])
  useEffect(() => {
    if (!session) return
    void restaurantStore.refresh()
    const unsubscribe = suscribirPrioridadPedidos(() => {
      void restaurantStore.refreshAfterEvent()
    })
    const timer = window.setInterval(() => {
      const state = restaurantStore.getSnapshot()
      if (!state.busy && !state.loading) void restaurantStore.refresh(true)
    }, 10000)
    return () => {
      unsubscribe()
      window.clearInterval(timer)
    }
  }, [session])
  const navigate = (to: AppRoute) => {
    if (!session || !roleRoutes[session.role].includes(to)) {
      setRouteNotice('Tu rol no tiene acceso a esa vista.')
      return
    }
    window.history.pushState({}, '', to)
    setPath(to)
    setRouteNotice('')
    window.scrollTo({ top: 0, behavior: 'instant' })
    window.requestAnimationFrame(() =>
      document.getElementById('main-content')?.focus({ preventScroll: true }),
    )
  }
  if (!session)
    return (
      <LoginPage
        onLogin={(role) => {
          const message = restaurantStore.login(role)
          if (!message) {
            const user = restaurantStore.getSnapshot().session
            setPath(
              user?.role === 'chef'
                ? '/cocina'
                : user?.role === 'admin'
                  ? '/admin'
                  : '/mesas',
            )
            setRouteNotice('')
          }
          return message
        }}
      />
    )
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Saltar al contenido
      </a>
      <AppHeader
        currentRoute={route}
        onNavigate={navigate}
        onLogout={() => {
          restaurantStore.logout()
          setPath('/login')
          setRouteNotice('')
        }}
      />
      <main
        id="main-content"
        tabIndex={-1}
        className={`app-main${route === '/pedidos' || route === '/historial' ? ' app-main--orders' : route === '/cocina' ? ' app-main--kitchen' : ''}`}
      >
        <div className="workspace-context">
          <span>
            NÁCAR /{' '}
            {session.role === 'chef'
              ? 'Cocina'
              : session.role === 'admin'
                ? 'Administración'
                : 'Salón'}
          </span>
          <span>Datos del servidor · Usuarios locales</span>
        </div>
        {warning && (
          <p className="warning" role="alert">
            {warning}
          </p>
        )}
        {routeNotice && <p role="alert">{routeNotice}</p>}
        <div className="actions">
          <button
            className="secondary-button"
            disabled={busy || loading}
            onClick={() => void restaurantStore.refresh()}
          >
            Actualizar datos
          </button>
          {loading && <span role="status">Cargando datos…</span>}
          {busy && <span role="status">Guardando…</span>}
        </div>
        <ErrorMessage error={error} />
        <fieldset
          className="workspace-fieldset"
          disabled={route !== '/usuarios' && (busy || loading)}
        >
          {route === '/mesas' && <TablesPage />}
          {route === '/menu' && <MenuPage />}
          {route === '/pedidos' && <OrdersPage />}
          {route === '/historial' && <OrdersPage key="history" history />}
          {route === '/cocina' && <KitchenPage />}
          {route === '/admin' && <AdminPage onNavigate={navigate} />}
          {route === '/usuarios' && <UsersPage />}
        </fieldset>
      </main>
      <footer className="app-footer">
        NÁCAR Restaurante <span>Servicio con atención al detalle</span>
      </footer>
    </div>
  )
}
export default App
