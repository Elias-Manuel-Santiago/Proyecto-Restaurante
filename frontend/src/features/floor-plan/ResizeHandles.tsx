import type { PointerEvent } from 'react'
import type { TableLayout } from '../../types'
import type { FloorHandle } from './floorTransforms'

type ResizeHandle = Exclude<FloorHandle, 'move'>
const labels = {
  width: 'Cambiar ancho',
  height: 'Cambiar alto',
  both: 'Cambiar ancho y alto',
}
const keyboardDelta: Record<string, number> = {
  ArrowLeft: -4,
  ArrowUp: -4,
  ArrowRight: 4,
  ArrowDown: 4,
}

interface ResizeHandlesProps {
  layout: TableLayout
  locked: boolean
  onPointerStart: (
    event: PointerEvent<SVGElement>,
    handle: ResizeHandle,
  ) => void
  onResize: (handle: ResizeHandle, delta: number) => void
}

/** Las asas consumen las flechas para que no se mueva también la mesa. */
export function ResizeHandles({
  layout,
  locked,
  onPointerStart,
  onResize,
}: ResizeHandlesProps) {
  const handles: ResizeHandle[] =
    layout.shape === 'circle' ? ['both'] : ['width', 'height', 'both']
  return handles.map((handle) => (
    <rect
      key={handle}
      className={`floor-handle floor-handle--${handle}`}
      x={(handle === 'height' ? 0 : layout.width / 2) - 9}
      y={(handle === 'width' ? 0 : layout.height / 2) - 9}
      width={18}
      height={18}
      rx={3}
      role="button"
      tabIndex={locked ? -1 : 0}
      aria-disabled={locked}
      aria-label={
        layout.shape === 'circle' ? 'Cambiar diámetro' : labels[handle]
      }
      onPointerDown={(event) => onPointerStart(event, handle)}
      onKeyDown={(event) => {
        event.stopPropagation()
        const delta = keyboardDelta[event.key]
        if (locked || !delta) return
        event.preventDefault()
        onResize(handle, delta)
      }}
    />
  ))
}
