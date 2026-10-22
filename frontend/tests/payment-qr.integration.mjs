import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises'
import { PNG } from 'pngjs'
import jsQR from 'jsqr'
import ts from 'typescript'

test('QR del cliente: se escanea al checkout exacto y rechaza dominios ajenos', async () => {
  const output = new URL(
    `../.verification/payment-qr-${process.pid}.mjs`,
    import.meta.url,
  )
  await mkdir(new URL('../.verification/', import.meta.url), {
    recursive: true,
  })
  const source = await readFile(
    new URL('../src/services/pagoQr.ts', import.meta.url),
    'utf8',
  )
  await writeFile(
    output,
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2023,
      },
    }).outputText,
  )
  try {
    const { crearQrPago } = await import(output.href)
    const url =
      'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pedido-prueba-123'
    const data = await crearQrPago(url)
    const png = PNG.sync.read(Buffer.from(data.split(',')[1], 'base64'))
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)
    assert.equal(
      decoded?.data,
      url,
      'El QR dirige al mismo pago que el enlace compartido',
    )
    assert.equal(png.width, 288)
    for (const inseguro of [
      'http://www.mercadopago.com.ar/checkout',
      'https://www.mercadopago.com.ar.ejemplo.com/checkout',
      'https://ejemplo.com/checkout',
      'http://localhost:5173/login',
    ])
      await assert.rejects(crearQrPago(inseguro))
  } finally {
    await unlink(output)
  }
})
