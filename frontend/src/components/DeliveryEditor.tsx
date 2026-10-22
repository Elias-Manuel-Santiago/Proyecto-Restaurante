import { useState, useEffect } from 'react'
import { obtenerModalidades } from '../services/apiAccess'
import { money } from '../state/model'
import { ErrorMessage } from './ErrorMessage'
import { Dialog } from './Dialog'
import { OrderComposer } from './OrderComposer'
import { useRestaurant } from '../state/useRestaurant'
import type { DeliveryDraft, ShippingMode } from '../types/delivery'

export function DeliveryEditor({ onClose }: { onClose: () => void }) {
  const { data } = useRestaurant()
  const couriers = data.users.filter(
    (user) => user.role === 'repartidor' && user.active,
  )
  const [draft, setDraft] = useState<DeliveryDraft>({
    modalidad: '',
    destinatario: '',
    direccion: '',
    indicaciones: '',
    repartidor_id: '',
    repartidor_nombre: '',
  })
  const [modes, setModes] = useState<ShippingMode[]>([])
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let mounted = true
    void obtenerModalidades().then((response) => {
      if (!mounted) return
      if (response instanceof Error) setError(response)
      else setModes(response.data)
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [])
  const mode = modes.find((item) => item.codigo === draft.modalidad)
  const [composing, setComposing] = useState(false)
  if (composing) return <OrderComposer delivery={draft} onClose={onClose} />
  return (
    <Dialog title="Nuevo pedido para entrega o retiro" onClose={onClose}>
      <form
        className="editor-form"
        onSubmit={(event) => {
          event.preventDefault()
          const courier = couriers.find(
            (user) => user.id === draft.repartidor_id,
          )
          if (
            !mode ||
            mode.costo === null ||
            !draft.destinatario.trim() ||
            (mode.requiere_direccion && !draft.direccion.trim()) ||
            (mode.requiere_repartidor && !courier)
          )
            return
          setDraft({
            ...draft,
            destinatario: draft.destinatario.trim(),
            direccion: draft.direccion.trim(),
            repartidor_nombre: courier?.name || '',
            modalidad_nombre: mode.nombre,
            costo_confirmado: String(mode.costo),
          })
          setComposing(true)
        }}
      >
        {error && <ErrorMessage error={error} />}
        <label>
          Modalidad
          <select
            required
            value={draft.modalidad}
            disabled={loading}
            onChange={(event) =>
              setDraft({ ...draft, modalidad: event.target.value })
            }
          >
            <option value="">
              {loading ? 'Cargando modalidades…' : 'Elegí una modalidad'}
            </option>
            {modes
              .filter((item) => item.activo)
              .map((item) => (
                <option
                  key={item.codigo}
                  value={item.codigo}
                  disabled={item.costo === null}
                >
                  {item.nombre} ·{' '}
                  {item.costo === null
                    ? 'Tarifa sin configurar'
                    : money(Number(item.costo))}
                </option>
              ))}
          </select>
        </label>
        <label>
          Destinatario
          <input
            autoFocus
            required
            maxLength={100}
            value={draft.destinatario}
            onChange={(event) =>
              setDraft({ ...draft, destinatario: event.target.value })
            }
          />
        </label>
        {Boolean(mode?.requiere_direccion) && (
          <label>
            Dirección de entrega
            <input
              required
              maxLength={300}
              value={draft.direccion}
              onChange={(event) =>
                setDraft({ ...draft, direccion: event.target.value })
              }
            />
          </label>
        )}
        <label>
          Indicaciones
          <textarea
            maxLength={300}
            value={draft.indicaciones}
            onChange={(event) =>
              setDraft({ ...draft, indicaciones: event.target.value })
            }
          />
        </label>
        {Boolean(mode?.requiere_repartidor) && (
          <label>
            Repartidor
            <select
              required
              value={draft.repartidor_id}
              onChange={(event) =>
                setDraft({ ...draft, repartidor_id: event.target.value })
              }
            >
              <option value="" disabled>
                Elegí un repartidor
              </option>
              {couriers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {Boolean(mode?.requiere_repartidor) && !couriers.length && (
          <p className="warning">
            Un administrador debe crear un perfil Repartidor desde Equipo.
          </p>
        )}
        <button
          className="primary-button"
          type="submit"
          disabled={
            loading ||
            !mode ||
            mode.costo === null ||
            (Boolean(mode?.requiere_repartidor) && !couriers.length)
          }
        >
          Elegir platos
        </button>
        <button className="text-button" type="button" onClick={onClose}>
          Volver
        </button>
      </form>
    </Dialog>
  )
}
