import { useState } from 'react'
import type { RestaurantTable } from '../../types'
import { ErrorMessage } from '../../components/ErrorMessage'
import { FloorCanvas } from './FloorCanvas'
import { FloorToolbar } from './FloorToolbar'
import { FloorTools } from './FloorTools'
import { useFloorEditor } from './useFloorEditor'
import './FloorPlan.css'

/** Entrada del módulo, compartida por Administración y Mesas. */
export function FloorPlan({
  filter = '',
  onSelect,
}: {
  filter?: string
  onSelect?: (table: RestaurantTable) => void
}) {
  const editor = useFloorEditor()
  const [gestureActive, setGestureActive] = useState(false)
  const {
    canEdit,
    editing,
    locked,
    saving,
    validation,
    error,
    notice,
    tables,
    unplaced,
  } = editor
  return (
    <section
      className={`floor-plan${editing ? ' floor-plan--editing' : ''}`}
      aria-label="Plano del salón"
    >
      <FloorToolbar
        canEdit={canEdit}
        editing={editing}
        locked={locked || gestureActive}
        saving={saving}
        invalid={!!validation}
        onBegin={editor.begin}
        onSave={() => void editor.save()}
        onCancel={editor.cancel}
      />
      {editing && (
        <FloorTools
          tables={tables}
          selected={editor.selected}
          selectedId={editor.selectedId}
          selectedOccupied={editor.selectedOccupied}
          locked={locked || gestureActive}
          onSelect={editor.select}
          onAdd={editor.add}
          onRemove={editor.remove}
          onRotate={editor.rotate}
        />
      )}
      <ErrorMessage error={error} />
      {validation && (
        <p className="warning" role="status">
          {validation}
        </p>
      )}
      {unplaced.length > 0 && (
        <div className="floor-unplaced">
          <p className="warning">
            No hay espacio para ubicar {unplaced.length} mesas. Reducí o mové
            las mesas del plano y luego intentá ubicarlas.
          </p>
          {unplaced.map((table) => (
            <button
              key={table.id}
              type="button"
              className="secondary-button"
              disabled={locked || (!editing && !onSelect)}
              onClick={() => {
                if (editing) editor.place(table.id)
                else {
                  const live = editor.liveTables.get(table.id)
                  if (live) onSelect?.(live)
                }
              }}
            >
              {editing ? 'Ubicar' : 'Consultar'} mesa {table.number}
            </button>
          ))}
        </div>
      )}
      <FloorCanvas
        editor={editor}
        onGestureChange={setGestureActive}
        filter={filter}
        onSelect={onSelect}
      />
      <div className="floor-footer">
        <span>
          {tables.length} mesas ·{' '}
          {tables.reduce((sum, table) => sum + table.capacity, 0)} plazas
        </span>
        <span>
          {editing
            ? 'Teclado: flechas para mover · Mayús para acelerar · R / Mayús+R para girar.'
            : '● Disponible   ● Ocupada'}
        </span>
      </div>
      <p className="sr-only" role="status">
        {notice}
      </p>
      {!tables.length && (
        <p className="empty-state">
          El salón todavía no tiene mesas.
          {canEdit && ' Activá el Modo Edición para agregar la primera.'}
        </p>
      )}
    </section>
  )
}
