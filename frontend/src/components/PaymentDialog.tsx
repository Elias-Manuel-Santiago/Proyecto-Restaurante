import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog } from './Dialog'
import { ErrorMessage } from './ErrorMessage'
import {
  obtenerPago,
  iniciarPago,
  reembolsarPago,
  cancelarPago,
} from '../services/apiAccess'
import { restaurantStore } from '../state/store'
import { money, orderTotal } from '../state/model'
import type { Order } from '../types'
import type { Payment } from '../types/delivery'

const labels: Record<Payment['estado'], string> = {
  pendiente: 'Pendiente de aprobación',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
  cancelando: 'Cancelación pendiente',
  reembolsando: 'Reembolso pendiente',
  reembolsado: 'Reembolsado',
}
export function PaymentDialog({
  order,
  onClose,
}: {
  order: Order
  onClose: () => void
}) {
  const [payment, setPayment] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [confirmRefund, setConfirmRefund] = useState(false)
  const mounted = useRef(false)
  const changing = useRef(false)
  const revision = useRef(0)
  const refresh = useCallback(async () => {
    const current = ++revision.current
    const response = await obtenerPago(order.id)
    if (!mounted.current || current !== revision.current) return
    if (response instanceof Error) setError(response)
    else {
      setPayment(response.data)
      setError(null)
    }
    setLoading(false)
  }, [order.id])
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
      void restaurantStore.refresh(true)
    }
  }, [refresh])
  const run = async (
    action: 'iniciar' | 'cancelar' | 'reembolsar' = 'iniciar',
  ) => {
    if (changing.current) return
    changing.current = true
    revision.current++
    setBusy(true)
    setError(null)
    try {
      const operations = {
        iniciar: iniciarPago,
        cancelar: cancelarPago,
        reembolsar: reembolsarPago,
      }
      const response = await operations[action](order.id)
      if (!mounted.current) return
      if (response instanceof Error) setError(response)
      else {
        setPayment(response.data)
        setConfirmRefund(false)
        await restaurantStore.refresh(true)
      }
    } finally {
      changing.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const refundable =
    payment &&
    ['aprobado', 'reembolsando'].includes(payment.estado) &&
    order.status !== 'entregado' &&
    order.deliveryStatus !== 'en_camino'
  const cancelling =
    payment && ['pendiente', 'rechazado', 'cancelando'].includes(payment.estado)
  return (
    <Dialog
      title={`Pago del pedido #${order.id}`}
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <p className="eyebrow">MercadoPago · Cuenta de prueba</p>
      <p>
        Total:{' '}
        <strong>
          {money(
            payment
              ? Number(payment.importe)
              : orderTotal(order) + (order.shippingCost || 0),
          )}
        </strong>
      </p>
      <p role="status">
        {loading
          ? 'Consultando pago…'
          : payment
            ? labels[payment.estado]
            : 'Todavía no se inició el cobro.'}
      </p>
      {payment?.metodo && <p className="muted">Medio: {payment.metodo}</p>}
      <p className="muted">
        El pago se realiza en MercadoPago con los medios que tenga habilitados
        la cuenta de prueba. Cocina y despacho esperan la aprobación del
        servidor.
      </p>
      {error && <ErrorMessage error={error} />}
      <div className="actions">
        {!payment?.checkout_url &&
          ![
            'aprobado',
            'cancelado',
            'cancelando',
            'reembolsando',
            'reembolsado',
          ].includes(payment?.estado || '') && (
            <button
              className="primary-button"
              disabled={busy || loading}
              onClick={() => void run()}
            >
              Iniciar cobro
            </button>
          )}
        {payment?.checkout_url &&
          ['pendiente', 'rechazado'].includes(payment.estado) && (
            <a
              className="primary-button"
              href={payment.checkout_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir pago en MercadoPago
            </a>
          )}
        <button
          className="secondary-button"
          disabled={busy || loading}
          onClick={() => void refresh()}
        >
          Consultar estado
        </button>
        {refundable && !confirmRefund && (
          <button
            className="text-button danger-text"
            disabled={busy}
            onClick={() => setConfirmRefund(true)}
          >
            {payment.estado === 'reembolsando'
              ? 'Reintentar reembolso'
              : 'Cancelar y reembolsar'}
          </button>
        )}
      </div>
      {payment &&
        ['pendiente', 'rechazado', 'cancelando'].includes(payment.estado) && (
          <button
            className="text-button danger-text"
            disabled={busy}
            onClick={() => setConfirmRefund(true)}
          >
            {payment.estado === 'cancelando'
              ? 'Reintentar cancelación'
              : 'Cancelar cobro pendiente'}
          </button>
        )}
      {confirmRefund && (
        <section className="panel">
          <p>
            Se cancelará el pedido y{' '}
            {cancelling
              ? 'se cerrará el cobro pendiente'
              : 'se solicitará el reembolso total'}
            . Si la pasarela demora, quedará pendiente y podrás reintentarlo sin
            duplicar la devolución.
          </p>
          <div className="actions">
            <button
              className="danger-button"
              disabled={busy}
              onClick={() =>
                void run(
                  payment &&
                    ['pendiente', 'rechazado', 'cancelando'].includes(
                      payment.estado,
                    )
                    ? 'cancelar'
                    : 'reembolsar',
                )
              }
            >
              {cancelling
                ? 'Confirmar cancelación del cobro'
                : 'Confirmar cancelación y reembolso'}
            </button>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setConfirmRefund(false)}
            >
              Volver
            </button>
          </div>
        </section>
      )}
    </Dialog>
  )
}
