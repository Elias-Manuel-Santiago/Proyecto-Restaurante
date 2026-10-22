// Contrato propuesto para la vista. Todavía no representa una respuesta de la API.
export type DeliveryStatus = 'listo' | 'en_camino' | 'entregado'

export interface Delivery {
  id: string
  customerName: string
  address: string
  addressNotes: string
  items: { name: string; quantity: number; notes: string }[]
  status: DeliveryStatus
}

export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  listo: 'Listo para retirar',
  en_camino: 'En camino',
  entregado: 'Entregado',
}
