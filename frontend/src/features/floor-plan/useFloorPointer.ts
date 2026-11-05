import { useCallback, useRef, type PointerEvent } from 'react'
import type { PlacedTable, TableLayout } from '../../types'
import type { useFloorEditor } from './useFloorEditor'
import { transformLayout, type FloorHandle } from './floorTransforms'

interface Gesture {
  id: string
  pointer: number
  x: number
  y: number
  original: TableLayout
  handle: FloorHandle
}

/** Traduce los eventos del navegador a coordenadas lógicas del SVG. */
export function useFloorPointer({
  editing,
  locked,
  change,
  select,
  clearError,
}: Pick<
  ReturnType<typeof useFloorEditor>,
  'editing' | 'locked' | 'change' | 'select' | 'clearError'
>) {
  const svg = useRef<SVGSVGElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const bindSvg = useCallback((element: SVGSVGElement | null) => {
    svg.current = element
  }, [])
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
    handle: FloorHandle,
  ) {
    if (!editing || locked || event.button !== 0 || gesture.current) return
    const p = point(event)
    if (!p) return
    event.preventDefault()
    event.stopPropagation()
    clearError()
    select(table.id)
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
    change(
      drag.id,
      transformLayout(drag.original, drag.handle, p.x - drag.x, p.y - drag.y),
      true,
    )
  }

  function finish(event: PointerEvent<SVGSVGElement>, cancel = false) {
    const drag = gesture.current
    if (!drag || drag.pointer !== event.pointerId) return
    clear()
    if (cancel) change(drag.id, drag.original)
  }
  function clear() {
    const drag = gesture.current
    if (!drag) return
    gesture.current = null
    if (svg.current?.hasPointerCapture(drag.pointer))
      svg.current.releasePointerCapture(drag.pointer)
  }

  return {
    bindSvg,
    start,
    move,
    finish,
    clear,
    isActive: () => gesture.current !== null,
  }
}
