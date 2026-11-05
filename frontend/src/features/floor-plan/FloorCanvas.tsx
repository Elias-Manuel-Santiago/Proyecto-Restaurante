import type { KeyboardEvent } from 'react'
import type { PlacedTable, RestaurantTable } from '../../types'
import { FLOOR } from '../../state/floorGeometry'
import { resizeLayout } from './floorTransforms'
import { FloorTableGlyph } from './FloorTableGlyph'
import type { useFloorEditor } from './useFloorEditor'
import { useFloorPointer } from './useFloorPointer'

interface FloorCanvasProps {
  editor: ReturnType<typeof useFloorEditor>
  onGestureChange: (active: boolean) => void
  filter: string
  onSelect?: (table: RestaurantTable) => void
}

const keyboardOffsets: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

/** Conecta la escena SVG con las acciones del editor; no escribe en la API. */
export function FloorCanvas({
  editor,
  onGestureChange,
  filter,
  onSelect,
}: FloorCanvasProps) {
  const {
    editing,
    locked,
    tables,
    liveTables,
    selected,
    select,
    change,
    rotate,
  } = editor
  const { bindSvg, move, finish, clear, start } = useFloorPointer(
    editor,
    onGestureChange,
  )

  function onTableKey(
    event: KeyboardEvent<SVGGElement>,
    table: PlacedTable,
    activate: () => void,
  ) {
    if (locked) return
    if (!editing) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        activate()
      }
      return
    }
    if (event.key.toLowerCase() === 'r') {
      event.preventDefault()
      rotate(event.shiftKey ? -1 : 1, table)
      return
    }
    const offset = keyboardOffsets[event.key]
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

  return (
    <div className="floor-scroll">
      <svg
        ref={bindSvg}
        viewBox={`0 0 ${FLOOR.width} ${FLOOR.height}`}
        className="floor-canvas"
        role="group"
        aria-label="Mapa del restaurante"
        onPointerMove={move}
        onPointerUp={(event) => finish(event)}
        onPointerCancel={(event) => finish(event, true)}
        onLostPointerCapture={clear}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) select(null)
        }}
      >
        <title>Plano del salón: mesas en su ubicación física</title>
        {tables.map((table) => {
          if (!table.layout) return null
          const placed = { ...table, layout: table.layout }
          const live = liveTables.get(table.id)
          const dimmed = !editing && !!filter && live?.status !== filter
          const activate = () => {
            if (locked || dimmed) return
            if (editing) select(table.id)
            else if (live) onSelect?.(live)
          }
          return (
            <FloorTableGlyph
              key={table.id}
              table={placed}
              occupied={live?.status === 'ocupada'}
              active={editing && selected?.id === table.id}
              dimmed={dimmed}
              locked={locked}
              editing={editing}
              onActivate={activate}
              onKeyDown={(event) => onTableKey(event, placed, activate)}
              onPointerStart={(event, handle) => start(event, placed, handle)}
              onResize={(handle, delta) =>
                change(
                  table.id,
                  resizeLayout(placed.layout, handle, delta, delta),
                )
              }
            />
          )
        })}
      </svg>
    </div>
  )
}
