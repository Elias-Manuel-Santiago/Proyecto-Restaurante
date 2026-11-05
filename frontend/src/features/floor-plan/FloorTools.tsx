import { useState } from 'react'
import type { FloorTable, PlacedTable, TableLayout } from '../../types'

interface FloorToolsProps {
  tables: FloorTable[]
  selected?: PlacedTable
  selectedId: string
  selectedOccupied: boolean
  locked: boolean
  onSelect: (id: string | null) => void
  onAdd: (shape: TableLayout['shape'], capacity: number) => void
  onRotate: (direction: number) => void
  onRemove: () => void
}

/** Los campos locales son de presentación; las acciones pertenecen al editor. */
export function FloorTools({
  tables,
  selected,
  selectedId,
  selectedOccupied,
  locked,
  onSelect,
  onAdd,
  onRotate,
  onRemove,
}: FloorToolsProps) {
  const [shape, setShape] = useState<TableLayout['shape']>('rectangle')
  const [capacity, setCapacity] = useState(4)
  return (
    <div className="floor-tools">
      <form
        className="floor-create"
        onSubmit={(event) => {
          event.preventDefault()
          onAdd(shape, capacity)
        }}
      >
        <label>
          Forma
          <select
            value={shape}
            onChange={(event) =>
              setShape(event.target.value as TableLayout['shape'])
            }
          >
            <option value="rectangle">Rectangular / cuadrada</option>
            <option value="circle">Redonda</option>
          </select>
        </label>
        <label>
          Capacidad
          <input
            type="number"
            min={1}
            max={30}
            required
            value={capacity}
            onChange={(event) => setCapacity(Number(event.target.value))}
          />
        </label>
        <button type="submit" className="secondary-button" disabled={locked}>
          Agregar mesa
        </button>
      </form>
      <div className="floor-selection">
        <label>
          Mesa seleccionada
          <select
            value={selectedId}
            onChange={(event) => onSelect(event.target.value || null)}
          >
            <option value="">Seleccionar mesa</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                Mesa {t.number} · {t.capacity} personas
              </option>
            ))}
          </select>
        </label>
        <div
          className="floor-selection-actions"
          aria-hidden={!selected}
          style={{ visibility: selected ? 'visible' : 'hidden' }}
        >
          <span className="muted floor-size">
            {Math.round(selected?.layout.width ?? 0)} ×{' '}
            {Math.round(selected?.layout.height ?? 0)} ·{' '}
            {selected?.layout.rotation ?? 0}°
          </span>
          <button
            type="button"
            className="secondary-button"
            disabled={locked || !selected}
            onClick={() => onRotate(-1)}
            aria-label="Girar 45 grados a la izquierda"
          >
            ↶ 45°
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={locked || !selected}
            onClick={() => onRotate(1)}
            aria-label="Girar 45 grados a la derecha"
          >
            ↷ 45°
          </button>
          <button
            type="button"
            className="text-button danger-text"
            disabled={locked || !selected || selectedOccupied}
            title={
              selectedOccupied
                ? 'Cerrá la mesa antes de eliminarla.'
                : undefined
            }
            onClick={onRemove}
          >
            Eliminar mesa
          </button>
        </div>
      </div>
    </div>
  )
}
