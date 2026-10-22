import QRCode from 'qrcode'

/** El QR comparte solo el checkout público; nunca una sesión de NÁCAR. */
export async function crearQrPago(enlace: string): Promise<string> {
  const url = new URL(enlace)
  if (
    url.protocol !== 'https:' ||
    !['mercadopago.com', 'mercadopago.com.ar'].some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    )
  )
    throw new Error('El enlace no corresponde al checkout de Mercado Pago.')
  return QRCode.toDataURL(url.href, {
    errorCorrectionLevel: 'M',
    margin: 4,
    width: 288,
    color: { dark: '#172033ff', light: '#ffffffff' },
  })
}
