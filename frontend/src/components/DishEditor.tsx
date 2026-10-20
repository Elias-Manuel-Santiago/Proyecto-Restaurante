import { ErrorMessage } from './ErrorMessage'
import { useState } from 'react'
import { categories, type MenuDish } from '../types'
import { useRestaurant } from '../state/useRestaurant'
import { Dialog } from './Dialog'

export function DishEditor({
  dish,
  onClose,
}: {
  dish?: MenuDish
  onClose: () => void
}) {
  const { act } = useRestaurant()
  const [draft, setDraft] = useState<MenuDish>(
    () =>
      dish ?? {
        id: crypto.randomUUID(),
        name: '',
        description: '',
        price: 0,
        category: 'Entradas',
        image: '',
        available: true,
      },
  )
  const [error, setError] = useState<string | Error>('')
  return (
    <Dialog title={dish ? 'Editar plato' : 'Agregar plato'} onClose={onClose}>
      <form
        className="editor-form"
        onSubmit={async (event) => {
          event.preventDefault()
          const message = await act({
            type: 'saveDish',
            dish: {
              ...draft,
              name: draft.name.trim(),
              description: draft.description.trim(),
            },
          })
          setError(message)
          if (!message) onClose()
        }}
      >
        <label>
          Nombre
          <input
            autoFocus
            required
            maxLength={100}
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
          />
        </label>
        <label>
          Descripción
          <textarea
            rows={3}
            maxLength={500}
            value={draft.description}
            onChange={(event) =>
              setDraft({ ...draft, description: event.target.value })
            }
          />
        </label>
        <div className="form-columns">
          <label>
            Precio (ARS)
            <input
              type="number"
              min="0.01"
              max={10000000}
              step="0.01"
              required
              value={draft.price || ''}
              onChange={(event) =>
                setDraft({ ...draft, price: Number(event.target.value) })
              }
            />
          </label>
          <label>
            Categoría
            <select
              value={draft.category}
              onChange={(event) => {
                const category = categories.find(
                  (value) => value === event.target.value,
                )
                if (category) setDraft({ ...draft, category })
              }}
            >
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={draft.available}
            onChange={(event) =>
              setDraft({ ...draft, available: event.target.checked })
            }
          />
          Disponible en la carta
        </label>
        {error && <ErrorMessage error={error} />}
        <div className="actions">
          <button className="primary-button" type="submit">
            Guardar plato
          </button>
          <button className="secondary-button" type="button" onClick={onClose}>
            Volver
          </button>
        </div>
      </form>
    </Dialog>
  )
}
