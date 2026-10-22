import type { Delivery } from '../types/delivery'

/** Datos ficticios exclusivos de la demostración, sin vínculo con pedidos del salón. */
export function createDemoDeliveries(): Delivery[] {
  return [
    {
      id: 'DEMO-101',
      customerName: 'Cliente de ejemplo A',
      address: 'Calle de ejemplo 120, departamento 2',
      addressNotes:
        'Referencia ficticia: puerta verde. Tocar el timbre del departamento.',
      items: [
        {
          name: 'Milanesa con papas',
          quantity: 2,
          notes: 'Una porción sin sal.',
        },
        { name: 'Agua mineral', quantity: 1, notes: '' },
      ],
      status: 'listo',
    },
    {
      id: 'DEMO-102',
      customerName: 'Cliente de ejemplo B',
      address: 'Pasaje de muestra 45, planta baja',
      addressNotes: 'Dirección ficticia para probar la vista.',
      items: [
        { name: 'Ravioles de verdura', quantity: 1, notes: 'Salsa aparte.' },
      ],
      status: 'listo',
    },
    {
      id: 'DEMO-103',
      customerName: 'Cliente de ejemplo C',
      address: 'Avenida ficticia 830, piso 3, departamento C',
      addressNotes: 'Ejemplo: entregar en recepción.',
      items: [{ name: 'Ensalada de estación', quantity: 2, notes: '' }],
      status: 'en_camino',
    },
    {
      id: 'DEMO-104',
      customerName: 'Cliente de ejemplo D',
      address: 'Calle de prueba 260',
      addressNotes: '',
      items: [{ name: 'Flan casero', quantity: 2, notes: '' }],
      status: 'entregado',
    },
  ]
}
