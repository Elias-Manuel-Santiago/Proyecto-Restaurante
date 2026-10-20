import axios from 'axios'
import type { AxiosResponse, Method } from 'axios'
import type { OrderStatus, TableStatus, StatusEvent } from '../types'

// Contratos del backend Express. MySQL puede devolver DECIMAL como string.
export interface MesaApi {
  id_mesa: number
  cantidad_personas: number
  numero: number
  estado: TableStatus
  comensales: number
  servicio_id: string | null
}
export interface ComidaParametros {
  tipo: string
  nombre: string
  descripcion: string
  precio: number
  imagen?: string
  disponible?: boolean
}
export interface ComidaApi extends Omit<
  ComidaParametros,
  'precio' | 'disponible'
> {
  id_comida: number
  precio: number | string
  disponible: boolean | number
  eliminado?: number
}
export interface ComidaPedido {
  id_comida: number
  cantidad: number
  notas?: string
}
export interface CrearPedidoParametros {
  id_mesa: number
  comidas: ComidaPedido[]
  mozo_id: string
  mozo_nombre: string
}
export interface PedidoCreado extends CrearPedidoParametros {
  id_pedido: number
}
// El listado es un JOIN: cada fila representa un ítem, no un pedido completo.
export interface PedidoFilaApi {
  id_pedidos: number
  prioridad?: number | null
  id_mesa: number
  estado: OrderStatus
  numero_mesa: number
  servicio_id: string
  mozo_id: string | null
  mozo_nombre: string | null
  creado_en: string | null
  historial: string | StatusEvent[] | null
  id_comida: number | null
  cantidad: number | null
  notas: string | null
  comida_nombre: string | null
  precio: number | string | null
}
export interface ResumenParametros {
  tipo: string
  ganancias: number
  pedidos: number
  pedidos_cancelados: number
  comidas_posiciones?: { id_comida: number; posicion: number }[]
}
export interface ResumenApi extends Omit<
  ResumenParametros,
  'ganancias' | 'comidas_posiciones'
> {
  id_resumen: number
  ganancias: number | string
  fecha: string
}
export interface ResumenDetalle extends ResumenApi {
  comidas: (ComidaApi & { posicion: number })[]
}
interface MensajeApi {
  message: string
}

const api = axios.create({ baseURL: import.meta.env.VITE_API_ROUTE || '/api' })

/** EventSource reconecta solo; al abrir también recuperamos cambios perdidos. */
export function suscribirPrioridadPedidos(onChange: () => void) {
  const events = new EventSource(api.getUri({ url: '/pedidos/eventos' }))
  events.addEventListener('open', onChange)
  events.addEventListener('prioridad', onChange)
  return () => {
    events.removeEventListener('open', onChange)
    events.removeEventListener('prioridad', onChange)
    events.close()
  }
}

/** Devuelve la respuesta Axios o el mismo error completo, sin transformarlo. */
async function consultar<T>(
  method: Method,
  url: string,
  data?: unknown,
): Promise<AxiosResponse<T> | Error> {
  try {
    return await api.request<T>({ method, url, data })
  } catch (error) {
    return error as Error
  }
}

// Mesas: cantidad_personas es la capacidad; el ID lo asigna MySQL.
export const obtenerMesas = () =>
  consultar<MesaApi[]>('POST', '/mesas/obtener', {})
export const cargarMesas = (cantidad_personas: number, numero?: number) =>
  consultar<{ id_mesa: number; cantidad_personas: number; numero?: number }>(
    'POST',
    '/mesas',
    { cantidad_personas, numero },
  )
export const editarMesa = (
  id: number,
  cantidad_personas: number,
  numero?: number,
) => consultar<MensajeApi>('PUT', `/mesas/${id}`, { cantidad_personas, numero })
export const eliminarMesa = (id: number) =>
  consultar<void>('DELETE', `/mesas/${id}`)

export const abrirMesa = (id: number, comensales: number) =>
  consultar<MensajeApi>('PATCH', `/mesas/${id}/abrir`, { comensales })
export const cerrarMesa = (id: number) =>
  consultar<MensajeApi>('PATCH', `/mesas/${id}/cerrar`)

// Comidas: el formulario guarda también imagen y disponibilidad.
export const obtenerComidas = () =>
  consultar<ComidaApi[]>('POST', '/comidas/obtener', {})
export const cargarComida = (comida: ComidaParametros) =>
  consultar<ComidaParametros & { id_comida: number }>(
    'POST',
    '/comidas',
    comida,
  )
export const editarComida = (id: number, comida: ComidaParametros) =>
  consultar<MensajeApi>('PUT', `/comidas/${id}`, comida)
export const cambiarDisponibilidadComida = (id: number, disponible: boolean) =>
  consultar<MensajeApi>('PATCH', `/comidas/${id}/disponibilidad`, {
    disponible,
  })
export const eliminarComida = (id: number) =>
  consultar<void>('DELETE', `/comidas/${id}`)

// Pedidos: el servidor asigna ID y estado inicial pendiente.
export const obtenerPedidos = () =>
  consultar<PedidoFilaApi[]>('POST', '/pedidos/obtener', {})
export const moverPrioridadPedido = (
  id: string,
  targetId: string,
  before: boolean,
) =>
  consultar<MensajeApi>('PATCH', `/pedidos/${id}/prioridad`, {
    destino: Number(targetId),
    antes: before,
  })
export const cargarPedido = (pedido: CrearPedidoParametros) =>
  consultar<PedidoCreado>('POST', '/pedidos', pedido)
export const editarPedido = (id: number, comidas: ComidaPedido[]) =>
  consultar<MensajeApi>('PUT', `/pedidos/${id}`, { comidas })
export const cancelarPedido = (id: number) =>
  consultar<MensajeApi>('PATCH', `/pedidos/${id}/cancelar`)
export const despacharPedido = (id: number) =>
  consultar<MensajeApi>('PATCH', `/pedidos/${id}/despachar`)

export const cambiarEstadoPedido = (
  id: number,
  estado: OrderStatus,
  actor: string,
) => consultar<MensajeApi>('PATCH', `/pedidos/${id}/estado`, { estado, actor })

// Resúmenes: se guardan los importes enviados, sin calcular cobros en el cliente.
export const obtenerResumenes = () =>
  consultar<ResumenApi[]>('POST', '/resumenes/obtener', {})
export const obtenerDetalleResumen = (id_resumen: number) =>
  consultar<ResumenDetalle | null>('POST', '/resumenes/detalle', { id_resumen })
export const cargarResumen = (resumen: ResumenParametros) =>
  consultar<ResumenParametros & { id_resumen: number }>(
    'POST',
    '/resumenes',
    resumen,
  )
export const eliminarResumen = (id: number) =>
  consultar<void>('DELETE', `/resumenes/${id}`)
