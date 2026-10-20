import * as api from '../services/apiAccess'
import {
  adaptarComidas,
  adaptarMesas,
  adaptarPedidos,
} from '../services/adapters'
import type { DemoUser, RestaurantData, Role, UserProfile } from '../types'
import {
  applyAction,
  createInitialData,
  STORAGE_KEY,
  validUsers,
  type Action,
} from './model'
import {
  createCredential,
  DEMO_PASSWORD,
  normalizeUsername,
  validUsername,
} from './credentials'

const USERS_KEY = 'nacar.users.v1'
let warning = ''
// Solo los perfiles continúan en localStorage. Nunca se restauran pedidos de la demo.
function loadData(): RestaurantData {
  const data = createInitialData()
  try {
    const saved =
      localStorage.getItem(USERS_KEY) ?? localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      const candidate = { ...data, users: parsed.users }
      if (validUsers(candidate.users)) return candidate
    }
  } catch {
    warning = 'No se pudieron leer los perfiles locales.'
  }
  return data
}

let snapshot = {
  data: loadData(),
  session: null as DemoUser | null,
  warning,
  loading: false,
  busy: false,
  error: null as Error | null,
  resumenes: [] as api.ResumenApi[],
}
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())
let sessionVersion = 0

function persist(data: RestaurantData): string {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify({ users: data.users }))
    return ''
  } catch {
    return 'El cambio se aplicó en memoria, pero no pudo guardarse. No cierres esta pestaña si necesitás conservarlo.'
  }
}

type RemoteAction =
  | Exclude<Action, { type: 'saveUser' | 'deleteUser' }>
  | { type: 'editOrder'; id: string; items: import('../types').DraftItem[] }
  | { type: 'createSummary'; summary: api.ResumenParametros }
  | { type: 'deleteSummary'; id: number }
  | { type: 'reorderOrder'; id: string; targetId: string; before: boolean }
const allowed: Record<RemoteAction['type'], Role[]> = {
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
    if (refreshing) return refreshing
    refreshing = (async () => {
      snapshot = { ...snapshot, loading: !background }
      emit()
      try {
        const [mesas, comidas, pedidos, resumenes] = await Promise.all([
          api.obtenerMesas(),
          api.obtenerComidas(),
          api.obtenerPedidos(),
          api.obtenerResumenes(),
        ])
        if (mesas instanceof Error) throw mesas
        if (comidas instanceof Error) throw comidas
        if (pedidos instanceof Error) throw pedidos
        if (resumenes instanceof Error) throw resumenes
        const orders = adaptarPedidos(pedidos.data)
        snapshot = {
          ...snapshot,
          data: {
            ...snapshot.data,
            tables: adaptarMesas(mesas.data, orders),
            dishes: adaptarComidas(comidas.data),
            orders,
          },
          resumenes: resumenes.data,
          error: null,
        }
        return null
      } catch (error) {
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
  login(role: Role): string {
    const user = snapshot.data.users.find(
      (candidate) => candidate.role === role && candidate.active,
    )
    if (!user) return 'No hay perfiles demo habilitados para este rol.'
    sessionVersion++
    snapshot = { ...snapshot, session: user }
    emit()
    return ''
  },
  logout() {
    sessionVersion++
    snapshot = { ...snapshot, session: null }
    emit()
  },
  async saveUser(profile: UserProfile, password?: string): Promise<string> {
    const actor = snapshot.session
    const version = sessionVersion
    if (!actor || actor.role !== 'admin')
      return 'Solo el administrador puede gestionar usuarios.'
    const previous = snapshot.data.users.find((user) => user.id === profile.id)
    const username = normalizeUsername(profile.username ?? '')
    if (
      !profile.name.trim() ||
      profile.name.trim().length > 80 ||
      !validUsername(username)
    )
      return 'Completá el nombre y un usuario de 3 a 40 caracteres: a–z, 0–9, punto, guion o guion bajo.'
    if (
      snapshot.data.users.some(
        (user) => user.id !== profile.id && user.username === username,
      )
    )
      return 'Ya existe un usuario con ese nombre de acceso.'
    if (!previous && !password) return 'Asigná una contraseña al usuario nuevo.'
    try {
      const credential =
        password === undefined
          ? (previous?.credential ?? (await createCredential(DEMO_PASSWORD)))
          : await createCredential(password)
      if (version !== sessionVersion || snapshot.session?.id !== actor.id)
        return 'La sesión cambió. Ingresá nuevamente para continuar.'
      if (
        snapshot.data.users.find((user) => user.id === profile.id) !== previous
      )
        return 'El perfil cambió mientras se guardaba. Abrilo nuevamente.'
      return restaurantStore.actUser({
        type: 'saveUser',
        user: {
          id: profile.id,
          name: profile.name.trim(),
          username,
          role: profile.role,
          active: profile.active,
          credential,
        },
      })
    } catch (error) {
      return error instanceof Error
        ? error.message
        : 'No se pudo guardar el usuario.'
    }
  },
  actUser(
    action: Extract<Action, { type: 'saveUser' | 'deleteUser' }>,
  ): string {
    try {
      const data = applyAction(snapshot.data, snapshot.session, action)
      snapshot = {
        ...snapshot,
        data,
        session:
          data.users.find(
            (user) => user.id === snapshot.session?.id && user.active,
          ) ?? null,
        warning: persist(data),
      }
      emit()
      return ''
    } catch (error) {
      return error instanceof Error
        ? error.message
        : 'No se pudo completar la acción.'
    }
  },
}

window.addEventListener('storage', (event) => {
  if (event.key !== USERS_KEY || !event.newValue) return
  try {
    const parsed = {
      ...snapshot.data,
      users: JSON.parse(event.newValue).users,
    }
    if (!validUsers(parsed.users)) return
    const session =
      parsed.users.find(
        (user) =>
          user.id === snapshot.session?.id &&
          user.active &&
          user.role === snapshot.session.role,
      ) ?? null
    if (!session && snapshot.session) sessionVersion++
    snapshot = {
      ...snapshot,
      data: { ...snapshot.data, users: parsed.users },
      session,
      warning: '',
    }
    emit()
  } catch {
    return
  }
})
