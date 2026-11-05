import { useState } from 'react'
import { useRestaurant } from '../../state/useRestaurant'
import { isActive, orderTotal, serviceOrders } from '../../state/model'
import type { RestaurantTable } from '../../types'

/** Opera sobre la visita activa; la edición física del plano se controla por separado. */
export function useTableService() {
  const { data, session, act } = useRestaurant()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [diners, setDiners] = useState(2)
  const [error, setError] = useState<string | Error>('')
  const [confirmClose, setConfirmClose] = useState(false)
  const [composing, setComposing] = useState(false)
  const selected = data.tables.find((table) => table.id === selectedId)
  const selectedOrders = selected ? serviceOrders(data, selected) : []
  const select = (table: RestaurantTable) => {
    setSelectedId(table.id)
    setDiners(Math.min(2, table.capacity))
    setError('')
  }
  const hasActiveOrders = selectedOrders.some(isActive)
  const consumption = selectedOrders
    .filter((order) => order.status !== 'cancelado')
    .reduce((sum, order) => sum + orderTotal(order), 0)
  const open = async () => {
    if (selected)
      setError(await act({ type: 'openTable', id: selected.id, diners }))
  }

  async function close() {
    if (!selected) return
    const message = await act({ type: 'closeTable', id: selected.id })
    setError(message)
    if (!message) setConfirmClose(false)
  }

  async function deliver(id: string) {
    setError(await act({ type: 'transition', id, status: 'entregado' }))
  }

  return {
    data,
    session,
    selected,
    selectedOrders,
    diners,
    setDiners,
    error,
    confirmClose,
    setConfirmClose,
    composing,
    setComposing,
    hasActiveOrders,
    consumption,
    select,
    open,
    close,
    deliver,
    clearError: () => setError(''),
    dismiss: () => setSelectedId(null),
  }
}
