import { useState } from 'react'
import { Dialog } from './Dialog'
import { OrderComposer } from './OrderComposer'
import { useRestaurant } from '../state/useRestaurant'
import type { DeliveryDraft } from '../types/delivery'

export function DeliveryEditor({ onClose }: { onClose: () => void }) {
  const { data } = useRestaurant()
  const couriers = data.users.filter(
    (user) => user.role === 'repartidor' && user.active,
  )
  const [draft, setDraft] = useState<DeliveryDraft>({
    destinatario: '',
    direccion: '',
    indicaciones: '',
    repartidor_id: couriers[0]?.id ?? '',
    repartidor_nombre: '',
  })
  const [composing, setComposing] = useState(false)
  if (composing) return <OrderComposer delivery={draft} onClose={onClose} />
  return (
    <Dialog title="Nuevo envío a domicilio" onClose={onClose}>
      <form
        className="editor-form"
        onSubmit={(event) => {
          event.preventDefault()
          const courier = couriers.find(
            (user) => user.id === draft.repartidor_id,
          )
          if (!courier || !draft.destinatario.trim() || !draft.direccion.trim())
            return
          setDraft({
            ...draft,
            destinatario: draft.destinatario.trim(),
            direccion: draft.direccion.trim(),
            repartidor_nombre: courier.name,
          })
          setComposing(true)
        }}
      >
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
        {!couriers.length && (
          <p className="warning">
            Un administrador debe crear un perfil Repartidor desde Equipo.
          </p>
        )}
        <button
          className="primary-button"
          type="submit"
          disabled={!couriers.length}
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
