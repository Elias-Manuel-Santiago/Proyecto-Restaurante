/**
 * Geometría del salón compartida por editor y servidor: límites, colisiones y distribución inicial.
 * Después de modificar este archivo ejecutar npm run sync:floor-geometry para generar el equivalente JS.
 * La validación local da respuesta inmediata; el backend repite la validación antes de persistir.
 */
import type { FloorTable, PlacedTable, TableLayout } from '../types'

export const FLOOR = { width: 1200, height: 800, minSize: 64, maxSize: 400 }
const EPS = 0.000001
const radians = (angle: number) => (angle * Math.PI) / 180
export const axes = (layout: TableLayout) => {
  const angle = radians(layout.rotation)
  return [
    { x: Math.cos(angle), y: Math.sin(angle) },
    { x: -Math.sin(angle), y: Math.cos(angle) },
  ]
}
export function corners(layout: TableLayout) {
  const [u, v] = axes(layout)
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sy]) => ({
    x:
      layout.x + (sx * u.x * layout.width) / 2 + (sy * v.x * layout.height) / 2,
    y:
      layout.y + (sx * u.y * layout.width) / 2 + (sy * v.y * layout.height) / 2,
  }))
}
export function validLayout(layout: TableLayout) {
  return (
    !!layout &&
    ['rectangle', 'circle'].includes(layout.shape) &&
    [layout.x, layout.y, layout.width, layout.height, layout.rotation].every(
      Number.isFinite,
    ) &&
    layout.width >= FLOOR.minSize &&
    layout.height >= FLOOR.minSize &&
    layout.width <= FLOOR.maxSize &&
    layout.height <= FLOOR.maxSize &&
    layout.rotation >= 0 &&
    layout.rotation < 360 &&
    layout.rotation % 45 === 0 &&
    (layout.shape !== 'circle' || layout.width === layout.height)
  )
}
export function inBounds(layout: TableLayout) {
  const points =
    layout.shape === 'circle'
      ? [
          { x: layout.x - layout.width / 2, y: layout.y - layout.height / 2 },
          { x: layout.x + layout.width / 2, y: layout.y + layout.height / 2 },
        ]
      : corners(layout)
  return points.every(
    (p) =>
      p.x >= -EPS &&
      p.y >= -EPS &&
      p.x <= FLOOR.width + EPS &&
      p.y <= FLOOR.height + EPS,
  )
}
export function overlaps(a: TableLayout, b: TableLayout): boolean {
  // Broad phase avoids allocating polygons for distant tables on every pointer move.
  const halfBounds = (layout: TableLayout) => {
    if (layout.shape === 'circle') return [layout.width / 2, layout.height / 2]
    const angle = radians(layout.rotation)
    const c = Math.abs(Math.cos(angle)),
      s = Math.abs(Math.sin(angle))
    return [
      (c * layout.width + s * layout.height) / 2,
      (s * layout.width + c * layout.height) / 2,
    ]
  }
  const [ax, ay] = halfBounds(a),
    [bx, by] = halfBounds(b)
  if (Math.abs(a.x - b.x) > ax + bx || Math.abs(a.y - b.y) > ay + by)
    return false
  if (a.shape === 'circle' && b.shape === 'circle')
    return Math.hypot(a.x - b.x, a.y - b.y) < (a.width + b.width) / 2 - EPS
  if (a.shape === 'circle' || b.shape === 'circle') {
    const circle = a.shape === 'circle' ? a : b
    const rect = a.shape === 'rectangle' ? a : b
    const [u, v] = axes(rect)
    const dx = circle.x - rect.x,
      dy = circle.y - rect.y
    const x = Math.abs(dx * u.x + dy * u.y) - rect.width / 2
    const y = Math.abs(dx * v.x + dy * v.y) - rect.height / 2
    return Math.hypot(Math.max(0, x), Math.max(0, y)) < circle.width / 2 - EPS
  }
  const ca = corners(a),
    cb = corners(b)
  return [...axes(a), ...axes(b)].every((axis) => {
    const pa = ca.map((p) => p.x * axis.x + p.y * axis.y)
    const pb = cb.map((p) => p.x * axis.x + p.y * axis.y)
    return (
      Math.max(...pa) > Math.min(...pb) + EPS &&
      Math.max(...pb) > Math.min(...pa) + EPS
    )
  })
}
export function placementError(table: PlacedTable, others: FloorTable[]) {
  if (!validLayout(table.layout))
    return 'Revisá la forma, el tamaño y la rotación de la mesa.'
  if (!inBounds(table.layout))
    return 'La mesa debe quedar completamente dentro del plano.'
  if (
    others.some(
      (other) =>
        other.id !== table.id &&
        other.layout &&
        overlaps(table.layout, other.layout),
    )
  )
    return 'Las mesas no pueden superponerse.'
  return ''
}
/** Valida el conjunto completo antes del envío: dimensiones, números de mesa, límites y superposiciones. */
export function validateFloor(tables: FloorTable[]) {
  if (tables.length > 150) return 'El plano admite hasta 150 mesas.'
  if (tables.some((table) => !table || typeof table !== 'object'))
    return 'Mesa inválida.'
  const ids = new Set(),
    numbers = new Set()
  for (const table of tables) {
    if (
      typeof table.id !== 'string' ||
      !table.id ||
      ids.has(table.id) ||
      numbers.has(table.number)
    )
      return 'Los identificadores y números de mesa deben ser únicos.'
    ids.add(table.id)
    numbers.add(table.number)
    if (
      !Number.isInteger(table.number) ||
      table.number < 1 ||
      table.number > 999 ||
      !Number.isInteger(table.capacity) ||
      table.capacity < 1 ||
      table.capacity > 30
    )
      return 'Revisá el número y la capacidad (1 a 30 personas).'
    if (!table.layout) return `La mesa ${table.number} necesita una ubicación.`
    const error = placementError(table as PlacedTable, tables)
    if (error) return `Mesa ${table.number}: ${error}`
  }
  return ''
}
export function findSpace(
  layout: TableLayout,
  tables: FloorTable[],
): TableLayout | null {
  for (let y = 16 + layout.height / 2; y <= FLOOR.height; y += 16)
    for (let x = 16 + layout.width / 2; x <= FLOOR.width; x += 16) {
      const candidate = { ...layout, x, y }
      if (
        !placementError(
          { id: '__placement__', number: 1, capacity: 1, layout: candidate },
          tables,
        )
      )
        return candidate
    }
  return null
}
/** Conserva ubicaciones válidas y busca espacio para mesas sin plano; no persiste esa distribución. */
export function initializeFloor(tables: FloorTable[]): FloorTable[] {
  let result: FloorTable[] = []
  // Try compact tables when an older salon has too many tables for the default size.
  for (const [width, height] of [
    [128, 96],
    [64, 64],
  ]) {
    result = tables
      .filter((t) => t.layout)
      .map((t) => ({ ...t, layout: { ...t.layout! } }))
    for (const table of tables.filter((t) => !t.layout)) {
      const layout: TableLayout = {
        shape: 'rectangle',
        x: 0,
        y: 0,
        width,
        height,
        rotation: 0,
      }
      result.push({ ...table, layout: findSpace(layout, result) })
    }
    if (result.every((t) => t.layout)) break
  }
  return result.sort((a, b) => a.number - b.number)
}
/** Extrae solo los campos del plano para comparar cambios sin mezclar estados de ocupación. */
export const floorSnapshot = (
  tables: {
    id: string
    number: number
    capacity: number
    layout?: TableLayout | null
  }[],
): FloorTable[] =>
  tables.map((t) => ({
    id: t.id,
    number: t.number,
    capacity: t.capacity,
    layout: t.layout ? { ...t.layout } : null,
  }))

/** Fixed field order, used for optimistic concurrency in the API as well. */
export const floorSignature = (tables: FloorTable[]) =>
  JSON.stringify(
    [...tables]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((t) => [
        t.id,
        t.number,
        t.capacity,
        t.layout
          ? [
              t.layout.shape,
              t.layout.x,
              t.layout.y,
              t.layout.width,
              t.layout.height,
              t.layout.rotation,
            ]
          : null,
      ]),
  )
