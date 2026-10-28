import { fallo } from "./autenticacion.js";
import { centavos } from "./importes.js";

const proveedores = new Map();
export function registrarPasarela(codigo, adaptador) {
  proveedores.set(codigo, adaptador);
}
export function obtenerPasarela(codigo) {
  const proveedor = proveedores.get(codigo);
  if (!proveedor) throw fallo(400, "Pasarela no disponible.");
  return proveedor;
}
async function api(path, { method = "GET", body, key } = {}) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token)
    throw fallo(
      503,
      "Falta configurar MP_ACCESS_TOKEN del vendedor de prueba en el backend.",
    );
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    method,
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(key ? { "X-Idempotency-Key": key } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw fallo(
      502,
      `MercadoPago no pudo completar la operación (${response.status}). Revisá la cuenta de prueba o reintentá.`,
    );
  return data;
}
async function vendedorPrueba() {
  const vendedor = await api("/users/me");
  if (!vendedor.tags?.includes("test_user"))
    throw fallo(
      503,
      "Configurá las credenciales de una cuenta vendedora de prueba. Esta integración no habilita cobros reales.",
    );
  return vendedor;
}

async function entornoPrueba(pago, vendedor) {
  if (pago.live_mode === false) return true;
  if (pago.live_mode !== true) return false;
  // Checkout Pro entre test users puede devolver live_mode=true (verificación real).
  // Se admite solo el comprador que el equipo copió desde Cuentas de prueba.
  const id = String(pago.payer?.id || "");
  const permitidos = (process.env.MP_TEST_BUYER_IDS || "")
    .split(",")
    .map((v) => v.trim());
  if (
    !/^\d+$/.test(id) ||
    id === String(vendedor.id) ||
    !permitidos.includes(id)
  )
    return false;
  const comprador = await api(`/users/${encodeURIComponent(id)}`);
  return (
    String(comprador.id) === id &&
    /^TESTUSER\d+$/.test(comprador.nickname || "") &&
    comprador.site_id === vendedor.site_id
  );
}
const urlValida = (valor) => {
  const url = new URL(valor);
  if (
    url.protocol !== "https:" ||
    !["mercadopago.com", "mercadopago.com.ar"].some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    )
  )
    throw fallo(502, "La pasarela devolvió una dirección de pago inválida.");
  return url.href;
};

async function expirarPreferencia(pago) {
  if (!pago.preferencia_id) return;
  await api(
    `/checkout/preferences/${encodeURIComponent(pago.preferencia_id)}`,
    {
      method: "PUT",
      body: {
        expires: true,
        expiration_date_from: new Date(Date.now() - 86400000).toISOString(),
        expiration_date_to: new Date().toISOString(),
      },
    },
  );
}

registrarPasarela("mercadopago", {
  nombre: "MercadoPago · entorno de prueba",
  preparar: vendedorPrueba,
  async crear(pago) {
    await vendedorPrueba();
    // Render define RENDER_EXTERNAL_URL (https://…onrender.com) en cada servicio.
    const origin =
      process.env.FRONTEND_ORIGIN ||
      process.env.RENDER_EXTERNAL_URL ||
      "http://localhost:5173";
    const body = {
      external_reference: pago.id_pago,
      items: [
        {
          id: String(pago.id_pedido),
          title: `NÁCAR · Pedido ${pago.id_pedido}`,
          quantity: 1,
          currency_id: "ARS",
          unit_price: Number(pago.importe),
        },
      ],
      ...(origin.startsWith("https://")
        ? {
            back_urls: {
              success: `${origin}/pedidos`,
              failure: `${origin}/pedidos`,
              pending: `${origin}/pedidos`,
            },
          }
        : {}),
    };
    const result = await api("/checkout/preferences", {
      method: "POST",
      key: pago.id_pago,
      body,
    });
    return {
      preferencia_id: String(result.id),
      checkout_url: urlValida(result.init_point || result.sandbox_init_point),
    };
  },
  async consultar(pago) {
    const vendedor = await vendedorPrueba();
    const data = await api(
      `/v1/payments/search?external_reference=${encodeURIComponent(pago.id_pago)}&sort=date_created&criteria=desc&limit=100`,
    );
    const resultados = data.results || [];
    const relevantes = resultados.filter(
      (r) => r.external_reference === pago.id_pago,
    );
    // Una aprobación anterior prevalece sobre un reintento posterior rechazado.
    const result =
      relevantes.find((r) =>
        ["approved", "refunded", "charged_back"].includes(r.status),
      ) || relevantes[0];
    if (!result) return { estado: "pendiente" };
    if (
      String(result.collector_id) !== String(vendedor.id) ||
      result.currency_id !== "ARS" ||
      centavos(result.transaction_amount) !== centavos(pago.importe) ||
      !(await entornoPrueba(result, vendedor))
    )
      throw fallo(
        502,
        "El pago recibido no coincide con el vendedor, importe, moneda o entorno de prueba del pedido.",
      );
    const estados = {
      approved: "aprobado",
      rejected: "rechazado",
      cancelled: "cancelado",
      refunded: "reembolsado",
      charged_back: "cancelado",
    };
    return {
      estado: estados[result.status] || "pendiente",
      referencia_pasarela: String(result.id),
      metodo: result.payment_method_id || result.payment_type_id || null,
    };
  },
  async reembolsar(pago) {
    await vendedorPrueba();
    await expirarPreferencia(pago);
    const result = await api(
      `/v1/payments/${encodeURIComponent(pago.referencia_pasarela)}/refunds`,
      {
        method: "POST",
        key: `refund-${pago.id_pago}`,
        body: { amount: Number(pago.importe) },
      },
    );
    if (
      result.status !== "approved" ||
      centavos(result.amount) !== centavos(pago.importe)
    )
      throw fallo(
        502,
        "El reembolso aún no fue aprobado. El pedido quedó cancelado; podés reintentar la consulta sin duplicarlo.",
      );
    return { reembolso_id: String(result.id) };
  },
  async cancelar(pago) {
    if (!pago.preferencia_id) return { estado: "cancelado" };
    const consultar = () => obtenerPasarela("mercadopago").consultar(pago);
    const remoto = await consultar();
    // Expira el enlace para impedir nuevos intentos de pago tras cancelar el pedido.
    await expirarPreferencia(pago);
    if (remoto.estado === "aprobado") return remoto;
    if (remoto.estado === "pendiente" && remoto.referencia_pasarela) {
      await api(
        `/v1/payments/${encodeURIComponent(remoto.referencia_pasarela)}`,
        { method: "PUT", body: { status: "cancelled" } },
      );
      const final = await consultar();
      if (final.estado === "aprobado") return final;
      if (final.estado === "pendiente")
        throw fallo(
          502,
          "La pasarela aún no confirmó la cancelación. Reintentá consultar el cobro.",
        );
    }
    return { estado: "cancelado" };
  },
});
