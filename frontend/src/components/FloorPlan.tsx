import { useRef, useState, type PointerEvent, type KeyboardEvent } from 'react'
import type {
  FloorTable,
  PlacedTable,
  RestaurantTable,
  TableLayout,
} from '../types'
import { useRestaurant } from '../state/useRestaurant'
import {
  FLOOR,
  axes,
  findSpace,
  floorSnapshot,
  initializeFloor,
  placementError,
  validateFloor,
} from '../state/floorGeometry'
import { ErrorMessage } from './ErrorMessage'
import './FloorPlan.css'

type Handle = 'move' | 'width' | 'height' | 'both'
interface Draft {
  base: FloorTable[]
  tables: FloorTable[]
  selected: string | null
}
interface Gesture {
  id: string
  pointer: number
  x: number
  y: number
  original: TableLayout
  handle: Handle
}

export function FloorPlan({
  filter = '',
  onSelect,
}: {
  filter?: string
  onSelect?: (table: RestaurantTable) => void
}) {
  const { data, session, act, busy, loading } = useRestaurant()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [shape, setShape] = useState<TableLayout['shape']>('rectangle')
  const [capacity, setCapacity] = useState(4)
  const [error, setError] = useState<string | Error>('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const svg = useRef<SVGSVGElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const canEdit = session?.role === 'admin'
  const editing = canEdit && draft !== null
  const locked = busy || loading || saving
  const tables = editing
    ? draft.tables
    : initializeFloor(floorSnapshot(data.tables))
  const selected = editing
    ? tables.find(
        (t): t is PlacedTable => t.id === draft.selected && !!t.layout,
      )
    : undefined
  const selectedLive = data.tables.find((t) => t.id === selected?.id)
  const validation = editing ? validateFloor(tables) : ''
  const unplaced = tables.filter((t) => !t.layout)

  function change(id: string, layout: TableLayout, continuous = false) {
    if (!canEdit || locked) return
    setDraft((current) => {
      if (!current) return current
      const table = current.tables.find((t) => t.id === id)
      if (!table?.layout) return current
      const original = table.layout
      let accepted = original
      // Sample the whole motion, so a fast pointer cannot jump through another table.
      const steps = continuous
        ? Math.ceil(
            Math.max(
              ...(['x', 'y', 'width', 'height'] as const).map((k) =>
                Math.abs(layout[k] - original[k]),
              ),
            ) / 4,
          )
        : 1
      for (let i = 1; i <= Math.max(1, steps); i++) {
        const ratio = i / Math.max(1, steps)
        const next = { ...layout }
        for (const key of ['x', 'y', 'width', 'height'] as const)
          next[key] = original[key] + (layout[key] - original[key]) * ratio
        if (placementError({ ...table, layout: next }, current.tables)) break
        accepted = next
      }
      return {
        ...current,
        tables: current.tables.map((t) =>
          t.id === id ? { ...t, layout: accepted } : t,
        ),
      }
    })
  }
  function rotate(direction: number) {
    if (!selected) return
    const layout = {
      ...selected.layout,
      rotation: (selected.layout.rotation + direction * 45 + 360) % 360,
    }
    const message = placementError({ ...selected, layout }, tables)
    setError(message)
    if (!message) change(selected.id, layout)
  }
  function point(event: PointerEvent<SVGElement>) {
    const matrix = svg.current?.getScreenCTM()
    return matrix
      ? new DOMPoint(event.clientX, event.clientY).matrixTransform(
          matrix.inverse(),
        )
      : null
  }
  function start(
    event: PointerEvent<SVGElement>,
    table: PlacedTable,
    handle: Handle,
  ) {
    if (!editing || locked || event.button !== 0 || gesture.current) return
    const p = point(event)
    if (!p) return
    event.preventDefault()
    event.stopPropagation()
    setError('')
    setDraft((current) =>
      current ? { ...current, selected: table.id } : current,
    )
    gesture.current = {
      id: table.id,
      pointer: event.pointerId,
      x: p.x,
      y: p.y,
      original: { ...table.layout },
      handle,
    }
    svg.current?.setPointerCapture(event.pointerId)
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    const drag = gesture.current
    if (!drag || drag.pointer !== event.pointerId || !editing || locked) return
    const p = point(event)
    if (!p) return
    const dx = p.x - drag.x,
      dy = p.y - drag.y
    const next = { ...drag.original }
    if (drag.handle === 'move') {
      next.x += dx
      next.y += dy
    } else {
      const [u, v] = axes(next)
      const localX = dx * u.x + dy * u.y,
        localY = dx * v.x + dy * v.y
      const clamp = (n: number) =>
        Math.min(FLOOR.maxSize, Math.max(FLOOR.minSize, n))
      if (next.shape === 'circle')
        next.width = next.height = clamp(next.width + localX + localY)
      else {
        if (drag.handle !== 'height')
          next.width = clamp(next.width + 2 * localX)
        if (drag.handle !== 'width')
          next.height = clamp(next.height + 2 * localY)
      }
    }
    change(drag.id, next, true)
  }
  function finish(event: PointerEvent<SVGSVGElement>, cancel = false) {
    const drag = gesture.current
    if (!drag || drag.pointer !== event.pointerId) return
    if (cancel) change(drag.id, drag.original)
    gesture.current = null
    if (svg.current?.hasPointerCapture(event.pointerId))
      svg.current.releasePointerCapture(event.pointerId)
  }
  function keyboard(event: KeyboardEvent<SVGGElement>, table: PlacedTable) {
    if (!editing || locked) return
    if (event.key.toLowerCase() === 'r') {
      event.preventDefault()
      rotate(event.shiftKey ? -1 : 1)
      return
    }
    const offset = (
      {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      } as Record<string, number[]>
    )[event.key]
    if (!offset) return
    event.preventDefault()
    const amount = event.shiftKey ? 10 : 2
    change(
      table.id,
      {
        ...table.layout,
        x: table.layout.x + offset[0] * amount,
        y: table.layout.y + offset[1] * amount,
      },
      true,
    )
  }
  async function save() {
    if (!editing || locked || gesture.current) return
    const message = validateFloor(draft.tables)
    if (message) {
      setError(message)
      return
    }
    setSaving(true)
    try {
      const result = await act({
        type: 'saveFloorPlan',
        base: draft.base,
        tables: draft.tables,
      })
      setError(result)
      if (!result) {
        setDraft(null)
        setNotice('Plano guardado.')
      }
    } finally {
      setSaving(false)
    }
  }
  function add() {
    if (!editing || locked) return
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 30) {
      setError('La capacidad debe estar entre 1 y 30 personas.')
      return
    }
    const number = Math.max(0, ...tables.map((t) => t.number)) + 1
    if (number > 999 || tables.length >= 150) {
      setError('Se alcanzó el límite de mesas.')
      return
    }
    const layout = findSpace(
      {
        shape,
        x: 0,
        y: 0,
        width: 128,
        height: shape === 'circle' ? 128 : 96,
        rotation: 0,
      },
      tables,
    )
    if (!layout) {
      setError(
        'No hay espacio libre para esta mesa. Mové o reducí otras mesas.',
      )
      return
    }
    const table: PlacedTable = {
      id: `new:${crypto.randomUUID()}`,
      number,
      capacity,
      layout,
    }
    setDraft({ ...draft, tables: [...tables, table], selected: table.id })
    setError('')
  }
  function remove() {
    if (!editing || !selected || locked || selectedLive?.status === 'ocupada')
      return
    setDraft({
      ...draft,
      tables: tables.filter((t) => t.id !== selected.id),
      selected: null,
    })
    setError('')
  }

  return (
    <section
      className={`floor-plan${editing ? ' floor-plan--editing' : ''}`}
      aria-label="Plano del salón"
    >
      <div className="floor-toolbar">
        <div>
          <strong>{editing ? 'Modo Edición' : 'Distribución del salón'}</strong>
          <p className="muted helper">
            {editing
              ? 'Arrastrá las mesas. Usá las asas para cambiar su tamaño y los botones para girarlas.'
              : 'Seleccioná una mesa para consultar su servicio.'}
          </p>
        </div>
        {canEdit && (
          <div className="actions">
            {editing ? (
              <>
                <button
                  type="button"
                  className="primary-button"
                  disabled={locked || !!validation}
                  onClick={() => void save()}
                >
                  {saving ? 'Guardando…' : 'Guardar plano'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={locked}
                  onClick={() => {
                    gesture.current = null
                    setDraft(null)
                    setError('')
                    setNotice('Cambios cancelados.')
                  }}
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                type="button"
                className="secondary-button"
                aria-pressed={false}
                disabled={locked}
                onClick={() => {
                  const base = floorSnapshot(data.tables)
                  setDraft({
                    base,
                    tables: initializeFloor(base),
                    selected: null,
                  })
                  setError('')
                  setNotice('')
                }}
              >
                Activar Modo Edición
              </button>
            )}
          </div>
        )}
      </div>
      {editing && (
        <div className="floor-tools">
          <form
            className="floor-create"
            onSubmit={(event) => {
              event.preventDefault()
              add()
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
            <button
              type="submit"
              className="secondary-button"
              disabled={locked}
            >
              Agregar mesa
            </button>
          </form>
          <div className="floor-selection">
            <label>
              Mesa seleccionada
              <select
                value={draft.selected ?? ''}
                onChange={(event) =>
                  setDraft({ ...draft, selected: event.target.value || null })
                }
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
                onClick={() => rotate(-1)}
                aria-label="Girar 45 grados a la izquierda"
              >
                ↶ 45°
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={locked || !selected}
                onClick={() => rotate(1)}
                aria-label="Girar 45 grados a la derecha"
              >
                ↷ 45°
              </button>
              <button
                type="button"
                className="text-button danger-text"
                disabled={
                  locked || !selected || selectedLive?.status === 'ocupada'
                }
                title={
                  selectedLive?.status === 'ocupada'
                    ? 'Cerrá la mesa antes de eliminarla.'
                    : undefined
                }
                onClick={remove}
              >
                Eliminar mesa
              </button>
            </div>
          </div>
        </div>
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
              disabled={editing ? locked : !onSelect}
              onClick={() => {
                if (!editing) {
                  const live = data.tables.find((t) => t.id === table.id)
                  if (live) onSelect?.(live)
                  return
                }
                const layout = findSpace(
                  {
                    shape: 'rectangle',
                    x: 0,
                    y: 0,
                    width: 64,
                    height: 64,
                    rotation: 0,
                  },
                  tables,
                )
                if (!layout) {
                  setError('Todavía no hay espacio libre para esta mesa.')
                  return
                }
                setDraft({
                  ...draft,
                  tables: tables.map((t) =>
                    t.id === table.id ? { ...t, layout } : t,
                  ),
                  selected: table.id,
                })
                setError('')
              }}
            >
              {editing ? 'Ubicar' : 'Consultar'} mesa {table.number}
            </button>
          ))}
        </div>
      )}
      <div className="floor-scroll">
        <svg
          ref={svg}
          viewBox={`0 0 ${FLOOR.width} ${FLOOR.height}`}
          className="floor-canvas"
          role="group"
          aria-label="Mapa del restaurante"
          onPointerMove={move}
          onPointerUp={(event) => finish(event)}
          onPointerCancel={(event) => finish(event, true)}
          onLostPointerCapture={() => {
            gesture.current = null
          }}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget && editing)
              setDraft({ ...draft, selected: null })
          }}
        >
          <title>Plano del salón: mesas en su ubicación física</title>
          {tables.map((table) => {
            const layout = table.layout
            if (!layout) return null
            const placed = { ...table, layout }
            const live = data.tables.find((t) => t.id === table.id)
            const occupied = live?.status === 'ocupada'
            const active = editing && selected?.id === table.id
            const dimmed = !editing && !!filter && live?.status !== filter
            return (
              <g
                key={table.id}
                role="button"
                tabIndex={locked || dimmed ? -1 : 0}
                aria-label={`Mesa ${table.number}, ${table.capacity} personas, ${occupied ? 'ocupada' : 'disponible'}${active ? ', seleccionada' : ''}`}
                aria-pressed={editing ? active : undefined}
                aria-disabled={locked || dimmed}
                className={`floor-table ${occupied ? 'is-occupied' : 'is-free'}${active ? ' is-selected' : ''}${dimmed ? ' is-dimmed' : ''}`}
                transform={`translate(${layout.x} ${layout.y}) rotate(${layout.rotation})`}
                onPointerDown={(event) => start(event, placed, 'move')}
                onFocus={() => {
                  if (editing)
                    setDraft((current) =>
                      current ? { ...current, selected: table.id } : current,
                    )
                }}
                onKeyDown={(event) => {
                  if (
                    !editing &&
                    !locked &&
                    !dimmed &&
                    (event.key === 'Enter' || event.key === ' ')
                  ) {
                    event.preventDefault()
                    if (live) onSelect?.(live)
                  } else keyboard(event, placed)
                }}
                onClick={() => {
                  if (locked || dimmed) return
                  if (editing)
                    setDraft((current) =>
                      current ? { ...current, selected: table.id } : current,
                    )
                  else if (live) onSelect?.(live)
                }}
              >
                {layout.shape === 'circle' ? (
                  <circle className="floor-surface" r={layout.width / 2} />
                ) : (
                  <rect
                    className="floor-surface"
                    x={-layout.width / 2}
                    y={-layout.height / 2}
                    width={layout.width}
                    height={layout.height}
                    rx={8}
                  />
                )}
                <g
                  className="floor-label"
                  transform={`rotate(${-layout.rotation})`}
                  aria-hidden="true"
                >
                  <text y={-10} className="floor-number">
                    {table.number}
                  </text>
                  <text y={13}>{table.capacity} pers.</text>
                  <text y={32} className="floor-status">
                    {occupied ? 'Ocupada' : 'Disponible'}
                  </text>
                </g>
                {active &&
                  (layout.shape === 'circle'
                    ? ['both']
                    : ['width', 'height', 'both']
                  ).map((handle) => {
                    const x = handle === 'height' ? 0 : layout.width / 2
                    const y = handle === 'width' ? 0 : layout.height / 2
                    return (
                      <rect
                        key={handle}
                        className={`floor-handle floor-handle--${handle}`}
                        x={x - 9}
                        y={y - 9}
                        width={18}
                        height={18}
                        rx={3}
                        role="button"
                        tabIndex={0}
                        aria-label={
                          layout.shape === 'circle'
                            ? 'Cambiar diámetro'
                            : `Cambiar ${handle === 'width' ? 'ancho' : handle === 'height' ? 'alto' : 'ancho y alto'}`
                        }
                        onPointerDown={(event) =>
                          start(event, placed, handle as Handle)
                        }
                        onKeyDown={(event) => {
                          event.stopPropagation()
                          const delta = ['ArrowRight', 'ArrowDown'].includes(
                            event.key,
                          )
                            ? 4
                            : ['ArrowLeft', 'ArrowUp'].includes(event.key)
                              ? -4
                              : 0
                          if (!delta) return
                          event.preventDefault()
                          const next = { ...layout }
                          if (layout.shape === 'circle' || handle !== 'height')
                            next.width += delta
                          if (layout.shape === 'circle' || handle !== 'width')
                            next.height += delta
                          change(table.id, next)
                        }}
                      />
                    )
                  })}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="floor-footer">
        <span>
          {tables.length} mesas ·{' '}
          {tables.reduce((sum, t) => sum + t.capacity, 0)} plazas
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
