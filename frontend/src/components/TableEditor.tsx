import { ErrorMessage } from './ErrorMessage'
import { useState } from 'react'
import type { RestaurantTable } from '../types'
import { useRestaurant } from '../state/useRestaurant'
import { Dialog } from './Dialog'

export function TableEditor({
  table,
  onClose,
}: {
  table?: RestaurantTable
  onClose: () => void
}) {
  const { data, act } = useRestaurant()
  const [number, setNumber] = useState(
    table?.number ?? Math.max(0, ...data.tables.map((item) => item.number)) + 1,
  )
  const [capacity, setCapacity] = useState(table?.capacity ?? 4)
  const [error, setError] = useState<string | Error>('')
  return (
    <Dialog
      title={table ? `Editar mesa ${table.number}` : 'Agregar mesa'}
      onClose={onClose}
    >
      <form
        className="editor-form"
        onSubmit={async (event) => {
          event.preventDefault()
          const message = await act({
            type: 'saveTable',
            id: table?.id ?? crypto.randomUUID(),
            number,
            capacity,
          })
          setError(message)
          if (!message) onClose()
        }}
      >
        <label>
          Número
          <input
            autoFocus
            type="number"
            min={1}
            max={999}
            required
            disabled={table?.status === 'ocupada'}
            value={number}
            onChange={(event) => setNumber(Number(event.target.value))}
          />
        </label>
        <label>
          Capacidad
          <input
            type="number"
            min={table?.diners || 1}
            max={30}
            required
            value={capacity}
            onChange={(event) => setCapacity(Number(event.target.value))}
          />
        </label>
        {table?.status === 'ocupada' && (
          <p className="muted">
            Una mesa ocupada conserva su número hasta cerrar la visita.
          </p>
        )}
        {error && <ErrorMessage error={error} />}
        <div className="actions">
          <button className="primary-button" type="submit">
            Guardar mesa
          </button>
          <button className="secondary-button" type="button" onClick={onClose}>
            Volver
          </button>
        </div>
      </form>
    </Dialog>
  )
}
