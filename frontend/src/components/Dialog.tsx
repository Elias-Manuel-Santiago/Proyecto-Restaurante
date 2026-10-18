import { ErrorMessage } from './ErrorMessage'
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}
export function Dialog({ title, onClose, children, wide = false }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    dialog?.showModal()
    return () => {
      dialog?.close()
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [])
  const keepFocus = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return
    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
      ),
    ).filter((element) => element.getClientRects().length > 0)
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }
  return (
    <dialog
      ref={dialogRef}
      className={`dialog ${wide ? 'dialog--wide' : ''}`}
      aria-labelledby={titleId}
      onKeyDown={keepFocus}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const bounds = event.currentTarget.getBoundingClientRect()
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            onClose()
        }
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Cerrar diálogo"
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  )
}

export function ConfirmDialog({
  title,
  description,
  onClose,
  onConfirm,
  error,
}: {
  title: string
  description: string
  onClose: () => void
  onConfirm: () => void
  error?: string | Error
}) {
  return (
    <Dialog title={title} onClose={onClose}>
      <p>{description}</p>
      {error && <ErrorMessage error={error} />}
      <div className="actions">
        <button className="secondary-button" autoFocus onClick={onClose}>
          Volver
        </button>
        <button className="danger-button" onClick={onConfirm}>
          Confirmar
        </button>
      </div>
    </Dialog>
  )
}
