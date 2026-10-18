import { useState } from 'react'
import { useRestaurant } from '../state/useRestaurant'
import { money } from '../state/model'
import {
  obtenerDetalleResumen,
  type ResumenDetalle,
  type ResumenParametros,
} from '../services/apiAccess'
import { ConfirmDialog, Dialog } from './Dialog'
import { ErrorMessage } from './ErrorMessage'

/** Resúmenes guardados en MySQL; sus ganancias se ingresan explícitamente. */
export function SummaryPanel() {
  const { data, resumenes, act } = useRestaurant()
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<ResumenParametros>({
    tipo: '',
    ganancias: 0,
    pedidos: 0,
    pedidos_cancelados: 0,
  })
  const [positions, setPositions] = useState<Record<string, string>>({})
  const [detail, setDetail] = useState<ResumenDetalle | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [error, setError] = useState<string | Error>('')
  const [loading, setLoading] = useState(false)

  const showDetail = async (id: number) => {
    setLoading(true)
    const result = await obtenerDetalleResumen(id)
    if (result instanceof Error) setError(result)
    else {
      setError('')
      setDetail(result.data)
    }
    setLoading(false)
  }

  return (
    <section className="panel spaced">
      <div className="section-heading">
        <h2>Resúmenes guardados</h2>
        <button
          className="primary-button"
          onClick={() => {
            setError('')
            setDraft({
              tipo: '',
              ganancias: 0,
              pedidos: 0,
              pedidos_cancelados: 0,
            })
            setPositions({})
            setCreating(true)
          }}
        >
          Crear resumen
        </button>
      </div>
      <ErrorMessage error={error} />
      {loading && <p role="status">Cargando resumen…</p>}
      {resumenes.map((summary) => (
        <div className="recent-order" key={summary.id_resumen}>
          <span>
            <strong>{summary.tipo}</strong>
            <small>
              {summary.fecha.slice(0, 10)} · {money(Number(summary.ganancias))}
            </small>
          </span>
          <div className="actions">
            <button
              className="text-button"
              disabled={loading}
              onClick={() => void showDetail(summary.id_resumen)}
            >
              Ver detalle
            </button>
            <button
              className="text-button danger-text"
              onClick={() => {
                setError('')
                setDeleting(summary.id_resumen)
              }}
            >
              Eliminar
            </button>
          </div>
        </div>
      ))}
      {!resumenes.length && (
        <p className="empty-state">No hay resúmenes guardados.</p>
      )}
      {creating && (
        <Dialog title="Crear resumen" onClose={() => setCreating(false)}>
          <form
            className="editor-form"
            onSubmit={async (event) => {
              event.preventDefault()
              const comidas_posiciones = Object.entries(positions)
                .filter(([, position]) => position !== '')
                .map(([id, position]) => ({
                  id_comida: Number(id),
                  posicion: Number(position),
                }))
              const result = await act({
                type: 'createSummary',
                summary: { ...draft, comidas_posiciones },
              })
              setError(result)
              if (!result) setCreating(false)
            }}
          >
            <label>
              Tipo de resumen
              <input
                autoFocus
                required
                maxLength={100}
                value={draft.tipo}
                onChange={(event) =>
                  setDraft({ ...draft, tipo: event.target.value })
                }
              />
            </label>
            <label>
              Ganancias (ARS)
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={draft.ganancias}
                onChange={(event) =>
                  setDraft({ ...draft, ganancias: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Pedidos
              <input
                type="number"
                min={0}
                step={1}
                required
                value={draft.pedidos}
                onChange={(event) =>
                  setDraft({ ...draft, pedidos: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Pedidos cancelados
              <input
                type="number"
                min={0}
                step={1}
                required
                value={draft.pedidos_cancelados}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    pedidos_cancelados: Number(event.target.value),
                  })
                }
              />
            </label>
            <p className="muted">
              Posiciones de platos (opcional). Dejá vacío un plato para
              excluirlo.
            </p>
            {data.dishes.map((dish) => (
              <label key={dish.id}>
                Posición de {dish.name}
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={positions[dish.id] ?? ''}
                  onChange={(event) =>
                    setPositions({
                      ...positions,
                      [dish.id]: event.target.value,
                    })
                  }
                />
              </label>
            ))}
            <ErrorMessage error={error} />
            <button className="primary-button" type="submit">
              Guardar resumen
            </button>
          </form>
        </Dialog>
      )}
      {detail && (
        <Dialog title={detail.tipo} onClose={() => setDetail(null)}>
          <p>Ganancias: {money(Number(detail.ganancias))}</p>
          <p>
            {detail.pedidos} pedidos · {detail.pedidos_cancelados} cancelados
          </p>
          <ol>
            {detail.comidas.map((dish) => (
              <li key={dish.id_comida}>
                {dish.posicion}. {dish.nombre}
              </li>
            ))}
          </ol>
        </Dialog>
      )}
      {deleting !== null && (
        <ConfirmDialog
          title="Eliminar resumen"
          description="Se eliminará este resumen y sus posiciones de platos."
          error={error}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const result = await act({ type: 'deleteSummary', id: deleting })
            setError(result)
            if (!result) setDeleting(null)
          }}
        />
      )}
    </section>
  )
}
