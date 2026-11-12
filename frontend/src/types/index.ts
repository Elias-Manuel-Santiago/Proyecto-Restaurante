/**
 * Contratos del estado y de las acciones de la interfaz.
 * apiAccess.ts describe el transporte SQL/HTTP; adapters.ts lo transforma a estas entidades.
 */
export type TableStatus = 'ocupada' | 'desocupada'
export type OrderStatus =
  'pendiente' | 'preparacion' | 'listo' | 'entregado' | 'cancelado'

export type Role = 'mozo' | 'chef' | 'admin' | 'repartidor'
export type AppRoute =
  | '/mesas'
  | '/menu'
  | '/pedidos'
  | '/cocina'
  | '/admin'
  | '/historial'
  | '/usuarios'
  | '/reparto'
export const categories = [
  'Entradas',
  'Principales',
  'Postres',
  'Bebidas',
] as const
export const statusLabels: Record<OrderStatus, string> = {
  pendiente: 'Pendiente',
  preparacion: 'En preparación',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}
export const roleLabels: Record<Role, string> = {
  mozo: 'Mozo',
  chef: 'Chef',
  admin: 'Administrador',
  repartidor: 'Repartidor',
}
export interface UserProfile {
  id: string
  name: string
  role: Role
  active: boolean
  username?: string
}
export interface OrderItem {
  dishId: string
  dishName: string
  quantity: number
  unitPrice: number
  notes: string
}
export interface StatusEvent {
  status: OrderStatus
  at: string
  actor: string
}
export interface Order {
  id: string
  kind?: 'mesa' | 'delivery'
  paymentRequired?: boolean
  paymentStatus?: string
  shippingCost?: number
  shippingMode?: string
  shippingName?: string
  requiresAddress?: boolean
  requiresCourier?: boolean
  deliveryStatus?: string
  courierName?: string
  priority?: number | null
  tableId: string
  tableNumber: number
  serviceId: string
  status: OrderStatus
  waiterId: string
  waiterName: string
  items: OrderItem[]
  createdAt: string
  history: StatusEvent[]
}
export interface RestaurantTable {
  id: string
  number: number
  status: TableStatus
  capacity: number
  diners: number
  serviceId: string | null
  orderIds: string[]
  layout?: TableLayout | null
}
export interface TableLayout {
  shape: 'rectangle' | 'circle'
  x: number
  y: number
  width: number
  height: number
  rotation: number
}
export interface FloorTable {
  id: string
  number: number
  capacity: number
  layout: TableLayout | null
}
export interface PlacedTable extends FloorTable {
  layout: TableLayout
}
export interface MenuDish {
  id: string
  name: string
  description: string
  price: number
  category: (typeof categories)[number]
  available: boolean
  // Porciones que permite el insumo más escaso; null = sin receta.
  portions?: number | null
  missingIngredient?: string
}
export interface RestaurantData {
  tables: RestaurantTable[]
  dishes: MenuDish[]
  orders: Order[]
  users: UserProfile[]
}
export interface DraftItem {
  dishId: string
  quantity: number
  notes: string
}
