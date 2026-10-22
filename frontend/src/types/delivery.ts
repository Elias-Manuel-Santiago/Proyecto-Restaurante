export type DeliveryStatus = 'en_cocina' | 'listo' | 'en_camino' | 'entregado'

export interface ShippingMode {
  codigo: string
  nombre: string
  costo: string | number | null
  requiere_direccion: boolean | number
  requiere_repartidor: boolean | number
  activo: boolean | number
}
export interface Payment {
  id_pago: string
  id_pedido: number
  estado:
    | 'pendiente'
    | 'aprobado'
    | 'rechazado'
    | 'cancelado'
    | 'cancelando'
    | 'reembolsando'
    | 'reembolsado'
  importe: string | number
  checkout_url?: string | null
  metodo?: string | null
}
export interface DeliveryDraft {
  modalidad: string
  modalidad_nombre?: string
  costo_confirmado?: string
  destinatario: string
  direccion: string
  indicaciones: string
  repartidor_id: string
  repartidor_nombre: string
}

export interface DeliveryRow {
  id_pedido: number
  destinatario: string
  direccion: string
  indicaciones: string
  estado: 'pendiente' | 'en_camino' | 'entregado'
  estado_pedido: string
  id_comida: number
  nombre_comida: string
  cantidad: number
  notas: string
}

export interface Delivery {
  id: string
  customerName: string
  address: string
  addressNotes: string
  items: { name: string; quantity: number; notes: string }[]
  status: DeliveryStatus
}

export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  en_cocina: 'En cocina',
  listo: 'Listo para retirar',
  en_camino: 'En camino',
  entregado: 'Entregado',
}
