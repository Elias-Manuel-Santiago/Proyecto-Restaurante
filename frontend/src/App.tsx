import { useEffect, useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { LoginPage } from './pages/LoginPage'
import { MenuPage } from './pages/MenuPage'
import { OrdersPage } from './pages/OrdersPage'
import { TablesPage } from './pages/TablesPage'
import './App.css'

type AppRoute = '/' | '/login' | '/mesas' | '/menu' | '/pedidos'
const validRoutes: AppRoute[] = ['/', '/login', '/mesas', '/menu', '/pedidos']
const getRoute = (): AppRoute => validRoutes.includes(window.location.pathname as AppRoute) ? window.location.pathname as AppRoute : '/'

function App() {
  const [route, setRoute] = useState<AppRoute>(getRoute)
  useEffect(() => {
    const onPopState = () => setRoute(getRoute())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  const navigate = (to: AppRoute) => {
    if (to === route) return
    window.history.pushState({}, '', to)
    setRoute(to)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  if (route === '/' || route === '/login') return <LoginPage onLogin={() => navigate('/mesas')} />
  return <div className="app-shell">
    <AppHeader currentRoute={route} onNavigate={navigate} />
    <main className="app-main">
      {route === '/mesas' && <TablesPage />}
      {route === '/menu' && <MenuPage />}
      {route === '/pedidos' && <OrdersPage />}
    </main>
  </div>
}
export default App
