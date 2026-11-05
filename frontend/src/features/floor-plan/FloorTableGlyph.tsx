import type { KeyboardEvent, PointerEvent } from 'react'
import type { PlacedTable } from '../../types'
import type { FloorHandle } from './floorTransforms'
import { ResizeHandles } from './ResizeHandles'

interface FloorTableGlyphProps {
  table: PlacedTable
  occupied: boolean
  active: boolean
  dimmed: boolean
  locked: boolean
  editing: boolean
  onActivate: () => void
  onKeyDown: (event: KeyboardEvent<SVGGElement>) => void
  onPointerStart: (event: PointerEvent<SVGElement>, handle: FloorHandle) => void
  onResize: (handle: Exclude<FloorHandle, 'move'>, delta: number) => void
}

/** Dibuja una mesa; la rotación inversa mantiene legible su etiqueta. */
export function FloorTableGlyph({
  table,
  occupied,
  active,
  dimmed,
  locked,
  editing,
  onActivate,
  onKeyDown,
  onPointerStart,
  onResize,
}: FloorTableGlyphProps) {
  const { layout } = table
  return (
    <g
      role="button"
      tabIndex={locked || dimmed ? -1 : 0}
      aria-label={`Mesa ${table.number}, ${table.capacity} personas, ${occupied ? 'ocupada' : 'disponible'}${active ? ', seleccionada' : ''}`}
      aria-pressed={editing ? active : undefined}
      aria-disabled={locked || dimmed}
      className={`floor-table ${occupied ? 'is-occupied' : 'is-free'}${active ? ' is-selected' : ''}${dimmed ? ' is-dimmed' : ''}`}
      transform={`translate(${layout.x} ${layout.y}) rotate(${layout.rotation})`}
      onPointerDown={(event) => onPointerStart(event, 'move')}
      onFocus={editing ? onActivate : undefined}
      onKeyDown={onKeyDown}
      onClick={onActivate}
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
      {active && (
        <ResizeHandles
          layout={layout}
          locked={locked}
          onPointerStart={onPointerStart}
          onResize={onResize}
        />
      )}
    </g>
  )
}
