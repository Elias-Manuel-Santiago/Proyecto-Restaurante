export type TableStatus = 'ocupada' | 'desocupada'
export type OrderStatus = 'pendiente' | 'preparacion' | 'listo' | 'entregado' | 'cancelado'

export interface Waiter { id: string; name: string }
export interface OrderItem { dishName: string; quantity: number }
export interface Order { id: string; tableNumber: number; status: OrderStatus; waiterId: string; items: OrderItem[]; createdAt: string }
export interface RestaurantTable { id: string; number: number; status: TableStatus; diners: number; orderIds: string[] }
export interface MenuDish { id: string; name: string; description: string; price: number; image: string; category: 'Entradas' | 'Principales' | 'Postres' | 'Bebidas' }
