interface FloorToolbarProps {
  canEdit: boolean
  editing: boolean
  locked: boolean
  saving: boolean
  invalid: boolean
  onSave: () => void
  onCancel: () => void
  onBegin: () => void
}

/** Barra de comandos; no modifica el borrador por su cuenta. */
export function FloorToolbar({
  canEdit,
  editing,
  locked,
  saving,
  invalid,
  onSave,
  onCancel,
  onBegin,
}: FloorToolbarProps) {
  return (
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
                disabled={locked || invalid}
                onClick={onSave}
              >
                {saving ? 'Guardando…' : 'Guardar plano'}
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={locked}
                onClick={onCancel}
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
              onClick={onBegin}
            >
              Activar Modo Edición
            </button>
          )}
        </div>
      )}
    </div>
  )
}
