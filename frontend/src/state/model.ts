import type {
  AppRoute,
  MenuDish,
  Order,
  RestaurantData,
  RestaurantTable,
  Role,
  DraftItem,
  OrderStatus,
} from '../types'
export const money = (value: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(value)
export const orderTotal = (order: Order) =>
  order.items.reduce((total, item) => total + item.quantity * item.unitPrice, 0)
export const isActive = (order: Order) =>
  !['entregado', 'cancelado'].includes(order.status)
export const isAwaitingPayment = (order: Order) =>
  Boolean(order.paymentRequired && order.paymentStatus !== 'aprobado')
// Los activos comparten la cola del servidor; los finalizados quedan al final.
export const compareOrderPriority = (first: Order, second: Order) =>
  Number(!isActive(first)) - Number(!isActive(second)) ||
  (isActive(first) && isActive(second)
    ? (first.priority ?? Number.MAX_SAFE_INTEGER) -
        (second.priority ?? Number.MAX_SAFE_INTEGER) ||
      (Date.parse(first.createdAt) || 0) - (Date.parse(second.createdAt) || 0)
    : (Date.parse(second.createdAt) || 0) -
      (Date.parse(first.createdAt) || 0)) ||
  first.id.localeCompare(second.id, undefined, { numeric: true })
export const serviceOrders = (data: RestaurantData, table: RestaurantTable) =>
  data.orders.filter(
    (order) =>
      order.tableId === table.id && order.serviceId === table.serviceId,
  )
export const roleRoutes: Record<Role, string[]> = {
  mozo: ['/mesas', '/menu', '/pedidos'],
  chef: ['/cocina', '/menu'],
  admin: ['/admin', '/mesas', '/menu', '/pedidos', '/historial', '/usuarios'],
  repartidor: ['/reparto'],
}

export const homeRoute = (role?: Role): AppRoute =>
  role === 'repartidor'
    ? '/reparto'
    : role === 'chef'
      ? '/cocina'
      : role === 'admin'
        ? '/admin'
        : '/mesas'

export function createInitialData(): RestaurantData {
  return { version: 1, tables: [], dishes: [], orders: [], users: [] }
}
export type Action =
  | { type: 'openTable'; id: string; diners: number }
  | { type: 'closeTable'; id: string }
  | { type: 'createOrder'; tableId: string; items: DraftItem[] }
  | { type: 'transition'; id: string; status: OrderStatus }
  | { type: 'availability'; id: string; available: boolean }
  | { type: 'saveDish'; dish: MenuDish }
  | { type: 'deleteDish'; id: string }
  | { type: 'saveTable'; id: string; number: number; capacity: number }
  | { type: 'deleteTable'; id: string }
