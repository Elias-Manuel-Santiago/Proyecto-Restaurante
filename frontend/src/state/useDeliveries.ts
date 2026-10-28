import { useCallback, useEffect, useRef, useState } from 'react'
import { actualizarEnvio, obtenerEnvios } from '../services/apiAccess'
import { useRestaurant } from './useRestaurant'
import type { Delivery, DeliveryRow } from '../types/delivery'

export function adaptarEnvios(rows: DeliveryRow[]): Delivery[] {
  const result = new Map<string, Delivery>()
  for (const row of rows) {
    const id = String(row.id_pedido)
    if (!result.has(id))
      result.set(id, {
        id,
        customerName: row.destinatario,
        address: row.direccion,
        addressNotes: row.indicaciones,
        items: [],
        status:
          row.estado !== 'pendiente'
            ? row.estado
            : row.pago_requerido && row.pago_estado !== 'aprobado'
              ? 'esperando_pago'
              : row.estado_pedido === 'listo'
                ? 'listo'
                : 'en_cocina',
      })
    result.get(id)!.items.push({
      name: row.nombre_comida,
      quantity: Number(row.cantidad),
      notes: row.notas || '',
    })
  }
  return [...result.values()]
}

export function useDeliveries() {
  const { session } = useRestaurant()
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const mounted = useRef(false)
  const changing = useRef(false)
  const sequence = useRef(0)
  const refresh = useCallback(async () => {
    if (!session) return
    const request = ++sequence.current
    const result = await obtenerEnvios(session.id)
    if (!mounted.current || request !== sequence.current) return
    if (result instanceof Error) setError(result)
    else {
      setDeliveries(adaptarEnvios(result.data))
      setError(null)
    }
    setLoading(false)
  }, [session])
  useEffect(() => {
    mounted.current = true
    const initial = window.setTimeout(() => void refresh(), 0)
    const timer = window.setInterval(() => {
      if (!changing.current) void refresh()
    }, 10000)
    return () => {
      mounted.current = false
      window.clearTimeout(initial)
      window.clearInterval(timer)
    }
  }, [refresh])
  const advance = async (delivery: Delivery) => {
    if (
      !session ||
      changing.current ||
      !['listo', 'en_camino'].includes(delivery.status)
    )
      return false
    changing.current = true
    sequence.current++
    setBusy(true)
    try {
      const result = await actualizarEnvio(
        delivery.id,
        session.id,
        session.name,
        delivery.status === 'listo' ? 'en_camino' : 'entregado',
      )
      if (result instanceof Error) {
        if (mounted.current) setError(result)
        return false
      }
      await refresh()
      return true
    } finally {
      changing.current = false
      if (mounted.current) setBusy(false)
    }
  }
  return { deliveries, loading, busy, error, refresh, advance }
}
