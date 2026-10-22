import * as api from '../services/apiAccess'
import {
  adaptarComidas,
  adaptarMesas,
  adaptarPedidos,
} from '../services/adapters'
import type { Role, UserProfile } from '../types'
import { createInitialData, type Action } from './model'
let snapshot = {
  data: createInitialData(),
  session: null as UserProfile | null,
  warning: '',
  authChecking: true,
  loading: false,
  busy: false,
  error: null as Error | null,
  resumenes: [] as api.ResumenApi[],
}
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())
let sessionVersion = 0
const clearSession = (message = '') => {
  sessionVersion++
  snapshot = {
    ...snapshot,
    session: null,
    data: createInitialData(),
    resumenes: [],
    authChecking: false,
    warning: message,
    error: null,
  }
  emit()
}
api.alVencerSesion(() =>
  clearSession('Tu sesión venció o fue cerrada. Ingresá nuevamente.'),
)

type RemoteAction =
  | { type: 'advanceDelivery'; id: string; status: 'en_camino' | 'entregado' }
  | {
      type: 'createDelivery'
      delivery: import('../types/delivery').DeliveryDraft
      items: import('../types').DraftItem[]
    }
  | Exclude<Action, { type: 'saveUser' | 'deleteUser' }>
  | { type: 'editOrder'; id: string; items: import('../types').DraftItem[] }
  | { type: 'createSummary'; summary: api.ResumenParametros }
  | { type: 'deleteSummary'; id: number }
  | { type: 'reorderOrder'; id: string; targetId: string; before: boolean }
const allowed: Record<RemoteAction['type'], Role[]> = {
  createDelivery: ['mozo', 'admin'],
  advanceDelivery: ['mozo', 'admin'],
  openTable: ['mozo', 'admin'],
  closeTable: ['mozo', 'admin'],
  createOrder: ['mozo'],
  editOrder: ['mozo', 'admin'],
  transition: ['mozo', 'chef', 'admin'],
  availability: ['chef', 'admin'],
  saveDish: ['admin'],
  deleteDish: ['admin'],
  saveTable: ['admin'],
  deleteTable: ['admin'],
  createSummary: ['admin'],
  deleteSummary: ['admin'],
  reorderOrder: ['chef'],
}
let refreshing: Promise<Error | null> | null = null

export const restaurantStore = {
  /** No pierde avisos recibidos mientras otra consulta aún devuelve el orden anterior. */
  async refreshAfterEvent(): Promise<void> {
    const version = sessionVersion
    if (refreshing) await refreshing
    if (snapshot.session && version === sessionVersion)
      await restaurantStore.refresh(true)
  },
  /** Recarga datos reales; no hay fallback a mocks si la API falla. */
  async refresh(background = false): Promise<Error | null> {
    // El repartidor consulta sus envíos a través del hook específico.
    if (!snapshot.session || snapshot.session.role === 'repartidor') return null
    const version = sessionVersion
    const role = snapshot.session.role
    if (refreshing) return refreshing
    refreshing = (async () => {
      snapshot = { ...snapshot, loading: !background }
      emit()
      try {
        const [mesas, comidas, pedidos, resumenes, usuarios] =
          await Promise.all([
            api.obtenerMesas(),
            api.obtenerComidas(),
            api.obtenerPedidos(),
            role === 'admin'
              ? api.obtenerResumenes()
              : Promise.resolve({ data: [] as api.ResumenApi[] }),
            api.obtenerUsuarios(role !== 'admin'),
          ])
        if (mesas instanceof Error) throw mesas
        if (comidas instanceof Error) throw comidas
        if (pedidos instanceof Error) throw pedidos
        if (resumenes instanceof Error) throw resumenes
        if (usuarios instanceof Error) throw usuarios
        if (version !== sessionVersion) return null
        const orders = adaptarPedidos(pedidos.data)
        snapshot = {
          ...snapshot,
          data: {
            ...snapshot.data,
            tables: adaptarMesas(mesas.data, orders),
            dishes: adaptarComidas(comidas.data),
            orders,
            users: usuarios.data,
          },
          resumenes: resumenes.data,
          error: null,
        }
        return null
      } catch (error) {
        if (version === sessionVersion)
          snapshot = { ...snapshot, error: error as Error }
        return error as Error
      } finally {
        snapshot = { ...snapshot, loading: false }
        emit()
      }
    })()
    try {
      return await refreshing
    } finally {
      refreshing = null
    }
  },
  /** Espera la escritura y después vuelve a consultar al servidor. */
  async act(action: RemoteAction): Promise<Error | string> {
    if (refreshing) await refreshing
    if (snapshot.busy)
      return new Error('Esperá a que termine el cambio actual.')
    snapshot = { ...snapshot, busy: true, error: null }
    emit()
    try {
      const actor = snapshot.session
      if (!actor) throw new Error('Ingresá nuevamente para continuar.')
      if (!allowed[action.type].includes(actor.role))
        throw new Error('Tu rol no puede realizar esta acción.')
      if (
        action.type === 'transition' &&
        (action.status === 'cancelado'
          ? actor.role === 'chef'
          : action.status === 'entregado'
            ? actor.role !== 'mozo'
            : actor.role !== 'chef')
      )
        throw new Error('Este cambio corresponde a otro rol.')
      let result
      switch (action.type) {
        case 'advanceDelivery':
          result = await api.actualizarEnvio(
            action.id,
            actor.id,
            actor.name,
            action.status,
          )
          break
        case 'createDelivery':
          result = await api.cargarEnvio({
            ...action.delivery,
            mozo_id: actor.id,
            mozo_nombre: actor.name,
            comidas: action.items.map((item) => ({
              id_comida: Number(item.dishId),
              cantidad: item.quantity,
              notas: item.notes,
            })),
          })
          break
        case 'reorderOrder':
          result = await api.moverPrioridadPedido(
            action.id,
            action.targetId,
            action.before,
          )
          break
        case 'openTable':
          result = await api.abrirMesa(Number(action.id), action.diners)
          break
        case 'closeTable':
          result = await api.cerrarMesa(Number(action.id))
          break
        case 'createOrder':
          result = await api.cargarPedido({
            id_mesa: Number(action.tableId),
            mozo_id: actor.id,
            mozo_nombre: actor.name,
            comidas: action.items.map((item) => ({
              id_comida: Number(item.dishId),
              cantidad: item.quantity,
              notas: item.notes,
            })),
          })
          break
        case 'editOrder':
          result = await api.editarPedido(
            Number(action.id),
            action.items.map((item) => ({
              id_comida: Number(item.dishId),
              cantidad: item.quantity,
              notas: item.notes,
            })),
          )
          break
        case 'transition':
          result = await api.cambiarEstadoPedido(
            Number(action.id),
            action.status,
            actor.name,
          )
          break
        case 'availability':
          result = await api.cambiarDisponibilidadComida(
            Number(action.id),
            action.available,
          )
          break
        case 'saveDish': {
          const dish = action.dish
          const body = {
            nombre: dish.name,
            descripcion: dish.description,
            tipo: dish.category,
            precio: dish.price,
            imagen: '',
            disponible: dish.available,
          }
          result = snapshot.data.dishes.some((item) => item.id === dish.id)
            ? await api.editarComida(Number(dish.id), body)
            : await api.cargarComida(body)
          break
        }
        case 'deleteDish':
          result = await api.eliminarComida(Number(action.id))
          break
        case 'saveTable':
          result = snapshot.data.tables.some((item) => item.id === action.id)
            ? await api.editarMesa(
                Number(action.id),
                action.capacity,
                action.number,
              )
            : await api.cargarMesas(action.capacity, action.number)
          break
        case 'deleteTable':
          result = await api.eliminarMesa(Number(action.id))
          break
        case 'createSummary':
          result = await api.cargarResumen(action.summary)
          break
        case 'deleteSummary':
          result = await api.eliminarResumen(action.id)
          break
      }
      if (result instanceof Error) throw result
      // La escritura ya se confirmó: si falla la recarga, se muestra el error global
      // y se cierra el formulario para evitar repetir una creación exitosa.
      await restaurantStore.refresh()
      return ''
    } catch (error) {
      snapshot = { ...snapshot, error: error as Error }
      return error as Error
    } finally {
      snapshot = { ...snapshot, busy: false }
      emit()
    }
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot: () => snapshot,
  async restoreSession() {
    const version = sessionVersion
    const response = await api.consultarSesion()
    if (version !== sessionVersion) return
    if (response instanceof Error) {
      clearSession(
        (response as Error & { status?: number }).status === 401
          ? snapshot.session
            ? 'Tu sesión venció o fue cerrada. Ingresá nuevamente.'
            : ''
          : response.message,
      )
      return
    }
    snapshot = {
      ...snapshot,
      session: response.data,
      authChecking: false,
      warning: '',
    }
    emit()
  },
  async login(username: string, password: string): Promise<string> {
    // Un intento nuevo reemplaza cualquier identidad anterior, incluso si falla.
    // También invalida restauraciones de sesión que todavía estén en vuelo.
    const version = ++sessionVersion
    snapshot = {
      ...snapshot,
      session: null,
      data: createInitialData(),
      resumenes: [],
      warning: '',
      error: null,
    }
    emit()
    const response = await api.ingresar(username, password)
    if (version !== sessionVersion) return ''
    if (response instanceof Error) {
      snapshot = { ...snapshot, authChecking: false }
      emit()
      return response.message
    }
    snapshot = {
      ...snapshot,
      data: createInitialData(),
      session: response.data,
      authChecking: false,
      warning: '',
      error: null,
    }
    emit()
    return ''
  },
  async logout() {
    const response = await api.cerrarSesion()
    if (response instanceof Error) {
      snapshot = { ...snapshot, error: response }
      emit()
      return
    }
    clearSession()
  },
  async saveUser(profile: UserProfile, password?: string): Promise<string> {
    if (snapshot.session?.role !== 'admin')
      return 'Solo el administrador puede gestionar usuarios.'
    const nuevo = !snapshot.data.users.some((user) => user.id === profile.id)
    const response = await api.guardarUsuario(profile, password, nuevo)
    if (response instanceof Error) return response.message
    await restaurantStore.refresh()
    // Cambiar la propia contraseña cierra también esta sesión.
    if (password && profile.id === snapshot.session?.id)
      await restaurantStore.restoreSession()
    return ''
  },
  async actUser(action: { type: 'deleteUser'; id: string }): Promise<string> {
    const user = snapshot.data.users.find((user) => user.id === action.id)
    if (!user) return 'Usuario no encontrado.'
    return restaurantStore.saveUser({ ...user, active: false })
  },
}
