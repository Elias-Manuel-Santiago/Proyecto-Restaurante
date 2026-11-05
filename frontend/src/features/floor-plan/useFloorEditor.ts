import { useMemo, useState } from 'react'
import type { FloorTable, PlacedTable, TableLayout } from '../../types'
import { useRestaurant } from '../../state/useRestaurant'
import {
  findSpace,
  floorSnapshot,
  initializeFloor,
  placementError,
  validateFloor,
} from '../../state/floorGeometry'
import { constrainMotion } from './floorTransforms'

interface Draft {
  base: FloorTable[]
  tables: FloorTable[]
  selected: string | null
}

/** Aísla el borrador del plano publicado y coordina una única escritura en la API. */
export function useFloorEditor() {
  const { data, session, act, busy, loading } = useRestaurant()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | Error>('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const canEdit = session?.role === 'admin'
  const editing = canEdit && draft !== null
  const locked = busy || loading || saving
  const liveFloor = useMemo(
    () => initializeFloor(floorSnapshot(data.tables)),
    [data.tables],
  )
  const liveTables = useMemo(
    () => new Map(data.tables.map((table) => [table.id, table])),
    [data.tables],
  )
  const tables = editing ? draft.tables : liveFloor
  const selected = editing
    ? tables.find(
        (t): t is PlacedTable => t.id === draft.selected && !!t.layout,
      )
    : undefined
  const selectedLive = selected ? liveTables.get(selected.id) : undefined
  const validation = useMemo(
    () => (editing ? validateFloor(tables) : ''),
    [editing, tables],
  )
  const unplaced = tables.filter((t) => !t.layout)

  function change(id: string, layout: TableLayout, continuous = false) {
    if (!canEdit || locked) return
    setDraft((current) => {
      if (!current) return current
      const table = current.tables.find((t) => t.id === id)
      if (!table?.layout) return current
      const accepted = constrainMotion(
        { ...table, layout: table.layout },
        layout,
        current.tables,
        continuous,
      )
      if (accepted === table.layout) return current
      return {
        ...current,
        tables: current.tables.map((t) =>
          t.id === id ? { ...t, layout: accepted } : t,
        ),
      }
    })
  }
  function rotate(direction: number, table = selected) {
    if (!table || locked || !editing) return
    const layout = {
      ...table.layout,
      rotation: (table.layout.rotation + direction * 45 + 360) % 360,
    }
    const message = placementError({ ...table, layout }, tables)
    setError(message)
    if (!message) change(table.id, layout)
  }
  async function save() {
    if (!editing || locked) return
    const message = validateFloor(draft.tables)
    if (message) {
      setError(message)
      return
    }
    setSaving(true)
    try {
      const result = await act({
        type: 'saveFloorPlan',
        base: draft.base,
        tables: draft.tables,
      })
      setError(result)
      if (!result) {
        setDraft(null)
        setNotice('Plano guardado.')
      }
    } finally {
      setSaving(false)
    }
  }
  function add(shape: TableLayout['shape'], capacity: number) {
    if (!editing || locked) return
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 30) {
      setError('La capacidad debe estar entre 1 y 30 personas.')
      return
    }
    const number = Math.max(0, ...tables.map((t) => t.number)) + 1
    if (number > 999 || tables.length >= 150) {
      setError('Se alcanzó el límite de mesas.')
      return
    }
    const layout = findSpace(
      {
        shape,
        x: 0,
        y: 0,
        width: 128,
        height: shape === 'circle' ? 128 : 96,
        rotation: 0,
      },
      tables,
    )
    if (!layout) {
      setError(
        'No hay espacio libre para esta mesa. Mové o reducí otras mesas.',
      )
      return
    }
    const table: PlacedTable = {
      id: `new:${crypto.randomUUID()}`,
      number,
      capacity,
      layout,
    }
    setDraft({ ...draft, tables: [...tables, table], selected: table.id })
    setError('')
  }
  function remove() {
    if (!editing || !selected || locked || selectedLive?.status === 'ocupada')
      return
    setDraft({
      ...draft,
      tables: tables.filter((t) => t.id !== selected.id),
      selected: null,
    })
    setError('')
  }

  function begin() {
    if (!canEdit || locked) return
    // La firma de la base se conserva aunque se refresquen las mesas del salón.
    const base = floorSnapshot(data.tables)
    setDraft({ base, tables: initializeFloor(base), selected: null })
    setError('')
    setNotice('')
  }

  function cancel() {
    if (locked) return
    setDraft(null)
    setError('')
    setNotice('Cambios cancelados.')
  }

  function select(id: string | null) {
    if (!editing || locked) return
    setDraft((current) => current && { ...current, selected: id })
  }

  function place(id: string) {
    if (!editing || locked) return
    const layout = findSpace(
      { shape: 'rectangle', x: 0, y: 0, width: 64, height: 64, rotation: 0 },
      tables,
    )
    if (!layout) {
      setError('Todavía no hay espacio libre para esta mesa.')
      return
    }
    setDraft({
      ...draft,
      tables: tables.map((table) =>
        table.id === id ? { ...table, layout } : table,
      ),
      selected: id,
    })
    setError('')
  }

  return {
    canEdit,
    editing,
    locked,
    tables,
    liveTables,
    selected,
    selectedId: draft?.selected ?? '',
    selectedOccupied: selectedLive?.status === 'ocupada',
    validation,
    unplaced,
    error,
    notice,
    saving,
    change,
    rotate,
    save,
    add,
    remove,
    begin,
    cancel,
    select,
    place,
    clearError: () => setError(''),
  }
}
