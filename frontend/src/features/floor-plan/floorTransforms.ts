import type { FloorTable, PlacedTable, TableLayout } from '../../types'
import { FLOOR, axes, placementError } from '../../state/floorGeometry'

export type FloorHandle = 'move' | 'width' | 'height' | 'both'
const dimensions = ['x', 'y', 'width', 'height'] as const
const clamp = (size: number) =>
  Math.min(FLOOR.maxSize, Math.max(FLOOR.minSize, size))

/** Aplica desplazamientos en los ejes locales de una mesa rotada, sin mover el centro al redimensionar. */
export function transformLayout(
  layout: TableLayout,
  handle: FloorHandle,
  dx: number,
  dy: number,
): TableLayout {
  if (handle === 'move')
    return { ...layout, x: layout.x + dx, y: layout.y + dy }
  const [u, v] = axes(layout)
  const localX = dx * u.x + dy * u.y
  const localY = dx * v.x + dy * v.y
  return resizeLayout(layout, handle, 2 * localX, 2 * localY)
}

export function resizeLayout(
  layout: TableLayout,
  handle: Exclude<FloorHandle, 'move'>,
  dw: number,
  dh: number,
): TableLayout {
  if (layout.shape === 'circle') {
    const diameter = clamp(layout.width + (dw + dh) / 2)
    return { ...layout, width: diameter, height: diameter }
  }
  return {
    ...layout,
    width: handle === 'height' ? layout.width : clamp(layout.width + dw),
    height: handle === 'width' ? layout.height : clamp(layout.height + dh),
  }
}

/** Muestrea el recorrido y se queda en la última posición válida ante un obstáculo. */
export function constrainMotion(
  table: PlacedTable,
  target: TableLayout,
  tables: FloorTable[],
  continuous: boolean,
): TableLayout {
  const original = table.layout
  const distance = Math.max(
    ...dimensions.map((key) => Math.abs(target[key] - original[key])),
  )
  if (!Number.isFinite(distance)) return original
  // No hace falta recorrer más que la diagonal del salón más el tamaño máximo.
  const steps = continuous ? Math.max(1, Math.ceil(distance / 4)) : 1
  const limit = continuous
    ? Math.min(
        steps,
        Math.ceil((Math.hypot(FLOOR.width, FLOOR.height) + FLOOR.maxSize) / 4),
      )
    : 1
  let accepted = original
  for (let step = 1; step <= limit; step++) {
    const next = { ...target }
    for (const key of dimensions)
      next[key] = original[key] + (target[key] - original[key]) * (step / steps)
    if (placementError({ ...table, layout: next }, tables)) break
    accepted = next
  }
  return accepted
}
