import { waiters } from '../mocks/restaurant'
import type {
  DemoUser,
  AppRoute,
  DraftItem,
  MenuDish,
  Order,
  OrderStatus,
  RestaurantData,
  RestaurantTable,
  Role,
} from '../types'
import {
  normalizeUsername,
  validCredential,
  validUsername,
} from './credentials'

// La clave anterior solo se lee para conservar los perfiles existentes.
export const STORAGE_KEY = 'nacar.restaurant.v1'
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
  return {
    version: 1,
    tables: [],
    dishes: [],
    orders: [],
    users: [
      ...waiters.map((waiter) => ({
        ...waiter,
        role: 'mozo' as const,
        active: true,
      })),
      { id: 'chef-1', name: 'Chef demo', role: 'chef', active: true },
      {
        id: 'repartidor-1',
        name: 'Repartidor demo',
        role: 'repartidor',
        active: true,
      },
      {
        id: 'admin-1',
        name: 'Administrador demo',
        role: 'admin',
        active: true,
      },
    ],
  }
}

// Esta validación corresponde solo a los perfiles que siguen siendo locales.
export function validUsers(value: unknown): value is DemoUser[] {
  if (!Array.isArray(value) || value.length > 100) return false
  const valid = value.every(
    (user) =>
      user &&
      typeof user.id === 'string' &&
      typeof user.name === 'string' &&
      user.name.trim() &&
      user.name.length <= 80 &&
      ['mozo', 'chef', 'admin', 'repartidor'].includes(user.role) &&
      typeof user.active === 'boolean' &&
      ((user.username === undefined && user.credential === undefined) ||
        (validUsername(user.username) && validCredential(user.credential))),
  )
  if (!valid) return false
  const usernames = value.flatMap((user) =>
    user.username ? [normalizeUsername(user.username)] : [],
  )
  return (
    new Set(value.map((user) => user.id)).size === value.length &&
    new Set(usernames).size === usernames.length &&
    value.some((user) => user.role === 'admin' && user.active)
  )
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
  | { type: 'saveUser'; user: DemoUser }
  | { type: 'deleteUser'; id: string }

const requireCondition: (
  condition: unknown,
  message: string,
) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message)
}

/** Solo modifica usuarios locales. Todas las operaciones del restaurante van a la API. */
export function applyAction(
  data: RestaurantData,
  actor: DemoUser | null,
  action: Extract<Action, { type: 'saveUser' | 'deleteUser' }>,
): RestaurantData {
  requireCondition(
    actor?.role === 'admin' &&
      data.users.some(
        (user) =>
          user.id === actor.id && user.active && user.role === actor.role,
      ),
    'Solo el administrador puede gestionar usuarios.',
  )
  let next = data
  switch (action.type) {
    case 'saveUser': {
      requireCondition(
        action.user.id !== actor.id ||
          (action.user.active && action.user.role === 'admin'),
        'No podés quitar tu propio acceso de administrador.',
      )
      requireCondition(
        validUsername(action.user.username) &&
          validCredential(action.user.credential),
        'Indicá un usuario válido y asignale una contraseña.',
      )
      requireCondition(
        !data.users.some(
          (user) =>
            user.id !== action.user.id &&
            user.username === action.user.username,
        ),
        'Ya existe un usuario con ese nombre de acceso.',
      )
      next = {
        ...data,
        users: data.users.some((user) => user.id === action.user.id)
          ? data.users.map((user) =>
              user.id === action.user.id ? action.user : user,
            )
          : [...data.users, action.user],
      }
      break
    }
    case 'deleteUser':
      requireCondition(
        action.id !== actor.id,
        'No podés eliminar tu propio usuario.',
      )
      requireCondition(
        !data.orders.some(
          (order) => order.waiterId === action.id && isActive(order),
        ),
        'Este usuario tiene pedidos activos.',
      )
      next = {
        ...data,
        users: data.users.filter((user) => user.id !== action.id),
      }
      break
  }
  requireCondition(
    validUsers(next.users),
    'Revisá los datos y los límites de los perfiles locales.',
  )
  return next
}
