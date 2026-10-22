import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { obtenerPasarela } from "../modules/pasarelas.js";

test("MercadoPago: contrato HTTP, entorno de prueba, vendedor, importe, moneda y reembolso", async (t) => {
  const anterior = process.env.MP_ACCESS_TOKEN;
  process.env.MP_ACCESS_TOKEN = randomUUID();
  t.after(() => {
    if (anterior === undefined) delete process.env.MP_ACCESS_TOKEN;
    else process.env.MP_ACCESS_TOKEN = anterior;
  });
  const pago = {
    id_pago: randomUUID(),
    id_pedido: 99,
    importe: "1200.50",
    preferencia_id: "pref-1",
    referencia_pasarela: "55",
  };
  let resultado = {
    id: 55,
    external_reference: pago.id_pago,
    status: "approved",
    live_mode: false,
    collector_id: 10,
    currency_id: "ARS",
    transaction_amount: 1200.5,
    payment_method_id: "visa",
  };
  let tags = ["test_user"];
  const consultas = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    consultas.push({ url, options });
    assert.ok(options.headers.Authorization.startsWith("Bearer "));
    const data = url.endsWith("/users/me")
      ? { id: 10, tags }
      : url.endsWith("/checkout/preferences")
        ? {
            id: "pref-1",
            init_point:
              "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1",
          }
        : url.endsWith("/refunds")
          ? { id: 33, status: "approved", amount: 1200.5 }
          : options.method === "PUT"
            ? { status: "cancelled" }
            : { results: [resultado] };
    if (options.method === "PUT" && url.endsWith("/v1/payments/55"))
      resultado = { ...resultado, status: "cancelled" };
    return { ok: true, json: async () => data };
  });
  const proveedor = obtenerPasarela("mercadopago");
  const creado = await proveedor.crear(pago);
  assert.equal(creado.preferencia_id, "pref-1");
  const preferencia = consultas.find((c) =>
    c.url.endsWith("/checkout/preferences"),
  );
  assert.equal(
    JSON.parse(preferencia.options.body).items[0].unit_price,
    1200.5,
  );
  assert.equal(
    JSON.parse(preferencia.options.body).external_reference,
    pago.id_pago,
  );
  assert.equal((await proveedor.consultar(pago)).estado, "aprobado");
  for (const cambio of [
    { live_mode: true },
    { collector_id: 11 },
    { currency_id: "USD" },
    { transaction_amount: 1200.51 },
  ]) {
    const original = resultado;
    resultado = { ...original, ...cambio };
    await assert.rejects(proveedor.consultar(pago), /no coincide/);
    resultado = original;
  }
  resultado = { ...resultado, status: "pending" };
  assert.equal((await proveedor.consultar(pago)).estado, "pendiente");
  assert.equal((await proveedor.reembolsar(pago)).reembolso_id, "33");
  const refund = consultas.find((c) => c.url.endsWith("/refunds"));
  assert.equal(
    refund.options.headers["X-Idempotency-Key"],
    `refund-${pago.id_pago}`,
  );
  assert.equal((await proveedor.cancelar(pago)).estado, "cancelado");
  const expirar = consultas.find((c) =>
    c.url.endsWith("/checkout/preferences/pref-1"),
  );
  assert.equal(expirar.options.method, "PUT");
  assert.equal(JSON.parse(expirar.options.body).expires, true);
  tags = [];
  await assert.rejects(proveedor.crear(pago), /vendedora de prueba/);
});
