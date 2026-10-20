import { useRef, useState, type ReactNode } from 'react'

interface Props {
  id: string
  ids: string[]
  disabled: boolean
  isTarget: boolean
  children: ReactNode
  onMove: (id: string, targetId: string, before: boolean) => void
  onTargetChange: (id: string | null) => void
}

/** El asa usa Pointer Events para admitir mouse, lápiz y pantallas táctiles. */
export function PriorityOrder({
  id,
  ids,
  disabled,
  isTarget,
  children,
  onMove,
  onTargetChange,
}: Props) {
  const gesture = useRef<{
    x: number
    y: number
    target: string | null
  } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [target, setTarget] = useState<string | null>(null)
  const index = ids.indexOf(id)
  const reset = () => {
    gesture.current = null
    setDragging(false)
    setTarget(null)
    onTargetChange(null)
  }

  return (
    <div
      className={`priority-order${dragging ? ' is-dragging' : ''}${isTarget ? ' is-drop-target' : ''}`}
      data-priority-id={id}
    >
      <button
        type="button"
        className="secondary-button priority-handle"
        disabled={disabled || ids.length < 2}
        aria-label={`Reordenar pedido #${id}. Arrastrá o usá las flechas para moverlo.`}
        onPointerDown={(event) => {
          if (disabled || !event.isPrimary || event.button !== 0) return
          event.currentTarget.setPointerCapture(event.pointerId)
          gesture.current = { x: event.clientX, y: event.clientY, target: null }
        }}
        onPointerMove={(event) => {
          const start = gesture.current
          if (!start) return
          if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 6)
            return
          setDragging(true)
          const element = document.elementFromPoint(
            event.clientX,
            event.clientY,
          )
          const candidate =
            element?.closest<HTMLElement>('[data-priority-id]')?.dataset
              .priorityId
          start.target =
            candidate && candidate !== id && ids.includes(candidate)
              ? candidate
              : null
          setTarget(start.target)
          onTargetChange(start.target)
          if (event.clientY < 80) window.scrollBy(0, -18)
          if (event.clientY > window.innerHeight - 80) window.scrollBy(0, 18)
        }}
        onPointerUp={(event) => {
          const destination = gesture.current?.target
          reset()
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId)
          if (!disabled && destination)
            onMove(id, destination, index > ids.indexOf(destination))
        }}
        onPointerCancel={reset}
        onLostPointerCapture={reset}
        onKeyDown={(event) => {
          if (event.key === 'Escape') reset()
          const offset =
            event.key === 'ArrowUp' || event.key === 'ArrowLeft'
              ? -1
              : event.key === 'ArrowDown' || event.key === 'ArrowRight'
                ? 1
                : 0
          if (!offset) return
          event.preventDefault()
          const destination = ids[index + offset]
          if (!disabled && destination) onMove(id, destination, offset < 0)
        }}
      >
        <span aria-hidden="true">⠿</span> Arrastrar para priorizar
      </button>
      {children}
      {dragging && (
        <p className="priority-drag-status" role="status">
          {target
            ? `Soltá para mover ${index > ids.indexOf(target) ? 'antes' : 'después'} del pedido #${target}.`
            : 'Arrastrá hasta otro pedido de este estado.'}
        </p>
      )}
    </div>
  )
}
