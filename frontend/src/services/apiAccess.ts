import axios from 'axios'
import type { AxiosResponse, Method } from 'axios'
import type {
  OrderStatus,
  TableStatus,
  StatusEvent,
  UserProfile,
} from '../types'
import type {
  DeliveryDraft,
  DeliveryRow,
  ShippingMode,
  Payment,
} from '../types/delivery'

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
  // null = plato sin receta (no descuenta stock).
  porciones_disponibles?: number | null
  insumo_faltante?: string | null
}
// Inventario: las cantidades DECIMAL(12,3) llegan como texto ("2.750").
export interface UnidadApi {
  id_unidad: number
  nombre: string
}
export interface InsumoApi {
  id_stock: number
  nombre: string
  cantidad: string
  id_unidad: number
  unidad: string
}
export interface RecetaApi {
  id_comida: number
  id_stock: number
  cantidad_requerida: string
}
export interface MovimientoApi {
  id_movimiento: number
  id_stock: number
  insumo: string
  unidad: string
  id_pedido: number | null
  tipo: 'consumo' | 'reposicion' | 'ajuste'
  cantidad: string
  creado_en: string
  usuario: string | null
}
export interface InventarioApi {
  unidades: UnidadApi[]
  insumos: InsumoApi[]
  recetas: RecetaApi[]
  movimientos: MovimientoApi[]
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
  id_mesa: number | null
  estado: OrderStatus
  numero_mesa: number | null
  envio_estado?: string | null
  repartidor_nombre?: string | null
  pago_requerido?: number
  pago_estado?: string | null
  costo_envio?: string | number | null
  modalidad_codigo?: string | null
  modalidad_nombre?: string | null
  requiere_direccion?: number | null
  requiere_repartidor?: number | null
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

const api = axios.create({
  baseURL: import.meta.env.VITE_API_ROUTE || '/api',
  withCredentials: true,
  headers: { 'X-Nacar-Request': '1' },
})
let onUnauthorized: (() => void) | undefined
let sessionEpoch = 0
export const alVencerSesion = (callback: () => void) => {
  onUnauthorized = callback
}
export const ingresar = (username: string, password: string) =>
  consultar<UserProfile>('POST', '/auth/login', { username, password })
export const consultarSesion = () =>
  consultar<UserProfile>('GET', '/auth/session')
export const cerrarSesion = () =>
  consultar<MensajeApi>('POST', '/auth/logout', {})
export const obtenerUsuarios = (catalogo = false) =>
  consultar<UserProfile[]>('GET', catalogo ? '/usuarios/catalogo' : '/usuarios')
export const guardarUsuario = (
  profile: UserProfile,
  password?: string,
  nuevo = false,
) =>
  consultar<UserProfile>(
    nuevo ? 'POST' : 'PUT',
    nuevo ? '/usuarios' : `/usuarios/${profile.id}`,
    { ...profile, ...(password === undefined ? {} : { password }) },
  )

export const obtenerModalidades = () =>
  consultar<ShippingMode[]>('GET', '/modalidades-envio')
export const guardarModalidad = (mode: ShippingMode) =>
  consultar<MensajeApi>('PUT', `/modalidades-envio/${mode.codigo}`, {
    ...mode,
    requiere_direccion: Boolean(mode.requiere_direccion),
    requiere_repartidor: Boolean(mode.requiere_repartidor),
    activo: Boolean(mode.activo),
  })
export const obtenerInventario = () =>
  consultar<InventarioApi>('GET', '/inventario')
export const crearUnidad = (nombre: string) =>
  consultar<{ id_unidad: number }>('POST', '/inventario/unidades', { nombre })
export const crearInsumo = (insumo: {
  nombre: string
  id_unidad: number
  cantidad: number
}) => consultar<{ id_stock: number }>('POST', '/inventario/insumos', insumo)
export const ajustarInsumo = (id: number, cantidad: number) =>
  consultar<{ cantidad: string }>('POST', `/inventario/insumos/${id}/ajuste`, {
    cantidad,
  })
export const guardarReceta = (
  id_comida: number,
  insumos: { id_stock: number; cantidad_requerida: number }[],
) =>
  consultar<MensajeApi>('PUT', `/inventario/recetas/${id_comida}`, {
    insumos,
  })

export const obtenerPago = (id: string) =>
  consultar<Payment | null>('GET', `/pagos/${id}`)
export const iniciarPago = (id: string) =>
  consultar<Payment>('POST', `/pagos/${id}`, {})
export const cancelarPago = (id: string) =>
  consultar<Payment>('POST', `/pagos/${id}/cancelar`, {})
export const reembolsarPago = (id: string) =>
  consultar<Payment>('POST', `/pagos/${id}/reembolsar`, {})

export const obtenerEnvios = (repartidor_id: string) =>
  consultar<DeliveryRow[]>('POST', '/envios/obtener', { repartidor_id })
export const cargarEnvio = (
  envio: DeliveryDraft & {
    comidas: ComidaPedido[]
    mozo_id: string
    mozo_nombre: string
  },
) => consultar<{ id_pedido: number }>('POST', '/envios', envio)
export const actualizarEnvio = (
  id: string,
  repartidor_id: string,
  actor: string,
  estado: 'en_camino' | 'entregado',
) =>
  consultar<MensajeApi>('PATCH', `/envios/${id}/estado`, {
    repartidor_id,
    actor,
    estado,
  })

/** EventSource reconecta solo; al abrir también recuperamos cambios perdidos. */
export function suscribirPrioridadPedidos(onChange: () => void) {
  const events = new EventSource(api.getUri({ url: '/pedidos/eventos' }), {
    withCredentials: true,
  })
  events.addEventListener('open', onChange)
  events.addEventListener('prioridad', onChange)
  const expired = () => {
    events.close()
    onUnauthorized?.()
  }
  events.addEventListener('sesion-expirada', expired)
  return () => {
    events.removeEventListener('open', onChange)
    events.removeEventListener('prioridad', onChange)
    events.removeEventListener('sesion-expirada', expired)
    events.close()
  }
}

/** Conserva el mensaje de negocio sin exponer SQL, credenciales ni stack al usuario. */
async function consultar<T>(
  method: Method,
  url: string,
  data?: unknown,
): Promise<AxiosResponse<T> | Error> {
  const epoch = sessionEpoch
  try {
    const response = await api.request<T>({ method, url, data })
    if (url === '/auth/login' || url === '/auth/logout') sessionEpoch++
    return response
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (
        error.response?.status === 401 &&
        url !== '/auth/login' &&
        url !== '/auth/session' &&
        epoch === sessionEpoch
      )
        onUnauthorized?.()
      return Object.assign(
        new Error(
          error.response?.data?.message ||
            'No se pudo conectar con el servidor.',
        ),
        { status: error.response?.status },
      )
    }
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
