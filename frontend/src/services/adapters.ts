import type { ComidaApi, MesaApi, PedidoFilaApi } from './apiAccess'
import type { MenuDish, Order, RestaurantTable, StatusEvent } from '../types'

/** Agrupa el JOIN por pedido y conserva los precios históricos enviados por el servidor. */
export function adaptarPedidos(filas: PedidoFilaApi[]): Order[] {
  const pedidos = new Map<string, Order>()
  for (const fila of filas) {
    const id = String(fila.id_pedidos)
    let pedido = pedidos.get(id)
    if (!pedido) {
      const history: StatusEvent[] =
        typeof fila.historial === 'string'
          ? JSON.parse(fila.historial)
          : (fila.historial ?? [])
      pedido = {
        id,
        kind: fila.id_mesa === null ? 'delivery' : 'mesa',
        deliveryStatus: fila.envio_estado ?? undefined,
        priority: fila.prioridad ?? null,
        tableId: fila.id_mesa === null ? '' : String(fila.id_mesa),
        tableNumber: Number(fila.numero_mesa),
        serviceId: fila.servicio_id,
        status: fila.estado,
        waiterId: fila.mozo_id ?? '',
        waiterName: fila.mozo_nombre ?? 'Sin registro',
        createdAt: fila.creado_en ?? '',
        history,
        items: [],
      }
      pedidos.set(id, pedido)
    }
    if (fila.id_comida !== null)
      pedido.items.push({
        dishId: String(fila.id_comida),
        dishName: fila.comida_nombre ?? `Comida #${fila.id_comida}`,
        quantity: Number(fila.cantidad),
        unitPrice: Number(fila.precio ?? 0),
        notes: fila.notas ?? '',
      })
  }
  return [...pedidos.values()]
}

export function adaptarMesas(
  mesas: MesaApi[],
  pedidos: Order[],
): RestaurantTable[] {
  return mesas.map((mesa) => ({
    id: String(mesa.id_mesa),
    number: Number(mesa.numero),
    capacity: Number(mesa.cantidad_personas),
    status: mesa.estado,
    diners: Number(mesa.comensales),
    serviceId: mesa.servicio_id,
    orderIds: pedidos
      .filter(
        (pedido) =>
          pedido.tableId === String(mesa.id_mesa) &&
          pedido.serviceId === mesa.servicio_id,
      )
      .map((pedido) => pedido.id),
  }))
}

// Compatibilidad con las categorías en singular ya presentes en MySQL.
const categorias: Record<string, MenuDish['category']> = {
  Entrada: 'Entradas',
  Principal: 'Principales',
  Postre: 'Postres',
  Bebida: 'Bebidas',
  Entradas: 'Entradas',
  Principales: 'Principales',
  Postres: 'Postres',
  Bebidas: 'Bebidas',
}
export function adaptarComidas(comidas: ComidaApi[]): MenuDish[] {
  return comidas.map((comida) => ({
    id: String(comida.id_comida),
    name: comida.nombre,
    description: comida.descripcion ?? '',
    category: categorias[comida.tipo] ?? 'Principales',
    price: Number(comida.precio),
    available: Boolean(Number(comida.disponible)),
    image: '',
  }))
}
