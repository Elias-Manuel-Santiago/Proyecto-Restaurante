import type { MenuDish, Order, RestaurantTable, Waiter } from '../types'

export const waiters: Waiter[] = [
  { id: 'w-1', name: 'Sofía Martínez' }, { id: 'w-2', name: 'Mateo Ríos' },
  { id: 'w-3', name: 'Valentina López' }, { id: 'w-4', name: 'Lucas Fernández' },
]

export const menuDishes: MenuDish[] = [
  { id: 'd-1', name: 'Burrata de estación', description: 'Tomates asados, pesto de albahaca y pan de masa madre.', price: 9800, image: 'https://images.unsplash.com/photo-1625944525533-473f1a3d54e7?auto=format&fit=crop&w=800&q=80', category: 'Entradas' },
  { id: 'd-2', name: 'Croquetas de hongos', description: 'Hongos portobello, provolone y alioli de limón.', price: 7600, image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80', category: 'Entradas' },
  { id: 'd-3', name: 'Ceviche cítrico', description: 'Pesca blanca, leche de tigre, palta y maíz tostado.', price: 11200, image: 'https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?auto=format&fit=crop&w=800&q=80', category: 'Entradas' },
  { id: 'd-4', name: 'Ojo de bife', description: '350 g a las brasas, papines dorados y chimichurri.', price: 18800, image: 'https://images.unsplash.com/photo-1546964124-0cce460f38ef?auto=format&fit=crop&w=800&q=80', category: 'Principales' },
  { id: 'd-5', name: 'Risotto de calabaza', description: 'Arroz carnaroli, calabaza asada, salvia y parmesano.', price: 14200, image: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=800&q=80', category: 'Principales' },
  { id: 'd-6', name: 'Salmón grillado', description: 'Con puré de coliflor, espárragos y salsa de hierbas.', price: 17600, image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=800&q=80', category: 'Principales' },
  { id: 'd-7', name: 'Pasta del día', description: 'Pappardelle casero, ragú de cordero y pecorino.', price: 13600, image: 'https://images.unsplash.com/photo-1556761223-4c4282c73f77?auto=format&fit=crop&w=800&q=80', category: 'Principales' },
  { id: 'd-8', name: 'Tiramisú de la casa', description: 'Café de especialidad, mascarpone y cacao amargo.', price: 6800, image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=800&q=80', category: 'Postres' },
  { id: 'd-9', name: 'Flan de coco', description: 'Dulce de leche, crema de lima y crocante de almendras.', price: 6200, image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=80', category: 'Postres' },
  { id: 'd-10', name: 'Limonada de jengibre', description: 'Lima, limón, jengibre fresco y menta.', price: 4200, image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80', category: 'Bebidas' },
  { id: 'd-11', name: 'Negroni de la casa', description: 'Gin, vermut rosso, bitter y piel de naranja.', price: 6700, image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80', category: 'Bebidas' },
  { id: 'd-12', name: 'Copa de Malbec', description: 'Bodega seleccionada, Valle de Uco.', price: 5900, image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=800&q=80', category: 'Bebidas' },
]

const orderSeed: Array<[number, Order['status'], string, string, number, string]> = [
  [1, 'pendiente', 'w-1', 'Burrata de estación', 1, '12:08'], [2, 'preparacion', 'w-2', 'Ojo de bife', 2, '12:14'],
  [4, 'listo', 'w-3', 'Risotto de calabaza', 1, '12:17'], [5, 'entregado', 'w-1', 'Croquetas de hongos', 2, '12:22'],
  [7, 'preparacion', 'w-4', 'Pasta del día', 3, '12:26'], [8, 'pendiente', 'w-2', 'Ceviche cítrico', 1, '12:29'],
  [10, 'listo', 'w-3', 'Tiramisú de la casa', 2, '12:31'], [11, 'entregado', 'w-4', 'Ojo de bife', 1, '12:35'],
  [12, 'cancelado', 'w-1', 'Pasta del día', 1, '12:38'], [1, 'preparacion', 'w-1', 'Salmón grillado', 1, '12:42'],
  [2, 'pendiente', 'w-2', 'Tiramisú de la casa', 2, '12:44'], [4, 'entregado', 'w-3', 'Risotto de calabaza', 2, '12:48'],
  [5, 'listo', 'w-1', 'Flan de coco', 3, '12:51'], [7, 'preparacion', 'w-4', 'Ojo de bife', 2, '12:55'],
  [8, 'pendiente', 'w-2', 'Limonada de jengibre', 4, '12:57'], [10, 'entregado', 'w-3', 'Ceviche cítrico', 2, '13:02'],
  [11, 'listo', 'w-4', 'Negroni de la casa', 2, '13:04'], [12, 'cancelado', 'w-1', 'Croquetas de hongos', 1, '13:08'],
]
export const orders: Order[] = orderSeed.map(([tableNumber, status, waiterId, dishName, quantity, createdAt], index) => ({
  id: String(1052 + index), tableNumber, status, waiterId, items: [{ dishName, quantity }, { dishName: index % 2 ? 'Limonada de jengibre' : 'Copa de Malbec', quantity: index % 3 + 1 }], createdAt,
}))

const occupied = new Map([[1, 2], [2, 3], [4, 2], [5, 4], [7, 5], [8, 4], [10, 2], [11, 3], [12, 2]])
export const restaurantTables: RestaurantTable[] = Array.from({ length: 12 }, (_, index) => {
  const number = index + 1
  const diners = occupied.get(number) ?? 0
  return { id: `t-${number}`, number, status: diners ? 'ocupada' : 'desocupada', diners, orderIds: orders.filter((order) => order.tableNumber === number).map((order) => order.id) }
})
