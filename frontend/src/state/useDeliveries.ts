import { useState } from 'react'
import { createDemoDeliveries } from '../mocks/delivery'
import type { Delivery } from '../types/delivery'

/** La demo vive solo en memoria. Nunca consulta ni modifica pedidos reales. */
export function useDeliveries() {
  const [demo, setDemo] = useState(false)
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const startDemo = () => {
    setDeliveries(createDemoDeliveries())
    setDemo(true)
  }
  const stopDemo = () => {
    setDemo(false)
    setDeliveries([])
  }
  const advance = (id: string) => {
    if (!demo) return
    setDeliveries((current) =>
      current.map((delivery) =>
        delivery.id !== id || delivery.status === 'entregado'
          ? delivery
          : {
              ...delivery,
              status: delivery.status === 'listo' ? 'en_camino' : 'entregado',
            },
      ),
    )
  }
  return { demo, deliveries, startDemo, stopDemo, advance }
}
