import { useEffect, useState } from 'react'
import { crearQrPago } from '../services/pagoQr'

export function PaymentShare({
  url,
  orderId,
}: {
  url: string
  orderId: string
}) {
  const [qr, setQr] = useState({ url: '', image: '', error: '' })
  const [copiedUrl, setCopiedUrl] = useState('')
  const [copyError, setCopyError] = useState('')
  useEffect(() => {
    let active = true
    void crearQrPago(url).then(
      (image) => {
        if (active) setQr({ url, image, error: '' })
      },
      () => {
        if (active)
          setQr({
            url,
            image: '',
            error: 'No se pudo generar el QR. Podés compartir el enlace.',
          })
      },
    )
    return () => {
      active = false
    }
  }, [url])
  return (
    <section
      className="payment-share"
      aria-label={`Pago desde el celular del cliente, pedido ${orderId}`}
    >
      <h3>Escaneá y pagá con tu celular</h3>
      <p>
        El cliente escanea este QR con la cámara y paga en Mercado Pago, sin
        ingresar a NÁCAR.
      </p>
      {qr.url === url && qr.image ? (
        <img
          className="payment-share-qr"
          src={qr.image}
          width={288}
          height={288}
          alt={`QR de Mercado Pago para pagar el pedido ${orderId}`}
        />
      ) : (
        <p role="status">
          {qr.url === url && qr.error ? qr.error : 'Generando QR…'}
        </p>
      )}
      <button
        className="primary-button"
        type="button"
        onClick={async () => {
          setCopyError('')
          try {
            if (!navigator.clipboard)
              throw new Error('Portapapeles no disponible')
            await navigator.clipboard.writeText(url)
            setCopiedUrl(url)
          } catch {
            setCopiedUrl('')
            setCopyError('Seleccioná y copiá el enlace del campo de abajo.')
          }
        }}
      >
        Copiar enlace de pago
      </button>
      <p className="muted">
        Para delivery, compartí este enlace con el cliente.
      </p>
      <label className="payment-share-link">
        Enlace para el cliente
        <input
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
        />
      </label>
      <p role="status">
        {copyError ||
          (copiedUrl === url
            ? 'Enlace copiado. Ya podés compartirlo con el cliente.'
            : '')}
      </p>
      <a
        className="text-button"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Abrir pago en este dispositivo
      </a>
    </section>
  )
}
