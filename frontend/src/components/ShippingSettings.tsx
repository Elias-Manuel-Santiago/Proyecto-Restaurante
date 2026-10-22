import { useEffect, useState } from 'react'
import { Dialog } from './Dialog'
import { ErrorMessage } from './ErrorMessage'
import { obtenerModalidades, guardarModalidad } from '../services/apiAccess'
import type { ShippingMode } from '../types/delivery'

export function ShippingSettings({ onClose }: { onClose: () => void }) {
  const [modes, setModes] = useState<ShippingMode[]>([])
  const [error, setError] = useState<Error | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [savedRows, setSavedRows] = useState<number[]>([])
  useEffect(() => {
    let mounted = true
    void obtenerModalidades().then((response) => {
      if (!mounted) return
      if (response instanceof Error) setError(response)
      else {
        setModes(response.data)
        setSavedRows(response.data.map((_, index) => index))
      }
    })
    return () => {
      mounted = false
    }
  }, [])
  const update = (index: number, change: Partial<ShippingMode>) =>
    setModes((current) =>
      current.map((mode, i) => (i === index ? { ...mode, ...change } : mode)),
    )
  return (
    <Dialog
      title="Modalidades y tarifas de entrega"
      onClose={() => {
        if (!busy) onClose()
      }}
      wide
    >
      <p>
        El precio se fija al registrar el pedido. Cambiar una tarifa afecta solo
        pedidos nuevos. Una modalidad sin tarifa no se puede seleccionar.
      </p>
      {error && <ErrorMessage error={error} />}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {modes.map((mode, index) => (
        <form
          key={index}
          className="panel editor-form"
          onSubmit={async (event) => {
            event.preventDefault()
            if (busy) return
            if (
              modes.some(
                (other, i) => i !== index && other.codigo === mode.codigo,
              )
            ) {
              setError(
                new Error(
                  'Ese código ya está en la lista. Elegí otro para la modalidad nueva.',
                ),
              )
              return
            }
            setBusy(true)
            setError(null)
            const response = await guardarModalidad(mode)
            if (response instanceof Error) setError(response)
            else {
              setNotice(`${mode.nombre}: guardada.`)
              setSavedRows((rows) => [...rows, index])
            }
            setBusy(false)
          }}
        >
          <fieldset className="form-fieldset" disabled={busy}>
            <label>
              Código
              <input
                required
                pattern="[a-z0-9_]{3,40}"
                maxLength={40}
                value={mode.codigo}
                readOnly={savedRows.includes(index)}
                onChange={(e) => update(index, { codigo: e.target.value })}
              />
            </label>
            <label>
              Nombre
              <input
                required
                maxLength={80}
                value={mode.nombre}
                onChange={(e) => update(index, { nombre: e.target.value })}
              />
            </label>
            <label>
              Costo de envío ($)
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Sin configurar"
                value={mode.costo ?? ''}
                onChange={(e) =>
                  update(index, {
                    costo: e.target.value === '' ? null : e.target.value,
                  })
                }
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={Boolean(mode.requiere_direccion)}
                onChange={(e) =>
                  update(index, { requiere_direccion: e.target.checked })
                }
              />
              Requiere dirección
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={Boolean(mode.requiere_repartidor)}
                onChange={(e) =>
                  update(index, { requiere_repartidor: e.target.checked })
                }
              />
              Usa repartidor del restaurante
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={Boolean(mode.activo)}
                onChange={(e) => update(index, { activo: e.target.checked })}
              />
              Disponible
            </label>
            <button className="primary-button" type="submit">
              Guardar modalidad
            </button>
          </fieldset>
        </form>
      ))}
      <button
        className="secondary-button"
        disabled={busy}
        onClick={() =>
          setModes((current) => [
            ...current,
            {
              codigo: '',
              nombre: '',
              costo: null,
              requiere_direccion: true,
              requiere_repartidor: false,
              activo: true,
            },
          ])
        }
      >
        Agregar modalidad
      </button>
    </Dialog>
  )
}
