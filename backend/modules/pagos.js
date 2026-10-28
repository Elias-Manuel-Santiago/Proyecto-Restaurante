import { randomUUID } from "node:crypto";
import db from "./db.js";
import { transaccion, comprobar } from "./restaurante.js";
import { centavos, decimal } from "./importes.js";
import { obtenerPasarela } from "./pasarelas.js";
import { reponerStock } from "./inventario.js";

export async function exigirPago(conexion, pedido) {
  if (!pedido.pago_requerido) return; // Históricos: no se inventan pagos anteriores.
  const [[pago]] = await conexion.query(
    "SELECT estado FROM pagos WHERE id_pedido=? FOR UPDATE",
    [pedido.id_pedidos],
  );
  comprobar(
    pago?.estado === "aprobado",
    "El pago debe estar aprobado antes de enviar a cocina o despachar.",
  );
}
export async function asegurarSinCobro(conexion, id) {
  const [[pago]] = await conexion.query(
    "SELECT estado FROM pagos WHERE id_pedido=? FOR UPDATE",
    [id],
  );
  comprobar(
    !pago,
    "El pedido tiene un cobro iniciado y no puede editarse. Cancelá el circuito de pago antes de crear otro pedido.",
  );
}
async function leerPago(id) {
  const [[pago]] = await db.query("SELECT * FROM pagos WHERE id_pedido=?", [
    id,
  ]);
  return pago || null;
}
export async function iniciarPago(id, proveedor = "mercadopago") {
  const adaptador = obtenerPasarela(proveedor);
  await adaptador.preparar?.();
  const pago = await transaccion(async (conexion) => {
    const [[pedido]] = await conexion.query(
      "SELECT * FROM pedidos WHERE id_pedidos=? FOR UPDATE",
      [id],
    );
    comprobar(
      pedido?.estado === "pendiente",
      "Solo se cobran pedidos pendientes.",
    );
    const [[existente]] = await conexion.query(
      "SELECT * FROM pagos WHERE id_pedido=? FOR UPDATE",
      [id],
    );
    if (existente) {
      comprobar(
        existente.proveedor === proveedor,
        "El pedido ya tiene otra pasarela asignada.",
      );
      return existente;
    }
    const [items] = await conexion.query(
      "SELECT cantidad,precio_unitario FROM pedidos_comida WHERE id_pedido=?",
      [id],
    );
    const [[envio]] = await conexion.query(
      "SELECT costo FROM envio_modalidad WHERE id_pedido=?",
      [id],
    );
    const importe = items.reduce(
      (sum, item) => sum + centavos(item.precio_unitario) * item.cantidad,
      envio ? centavos(envio.costo) : 0,
    );
    comprobar(importe > 0, "El pedido no tiene un importe válido.");
    const nuevo = {
      id_pago: randomUUID(),
      id_pedido: Number(id),
      proveedor,
      importe: decimal(importe),
      estado: "pendiente",
    };
    await conexion.query(
      "INSERT INTO pagos (id_pago,id_pedido,proveedor,importe) VALUES (?,?,?,?)",
      [nuevo.id_pago, id, proveedor, nuevo.importe],
    );
    await conexion.query(
      "UPDATE pedidos SET pago_requerido=1 WHERE id_pedidos=?",
      [id],
    );
    return nuevo;
  });
  if (
    pago.checkout_url ||
    ["aprobado", "reembolsado", "reembolsando"].includes(pago.estado)
  )
    return pago;
  // Serializa la creación de enlaces sin mantener bloqueadas las filas del pedido.
  const bloqueo = await db.getConnection();
  try {
    const [[{ ok }]] = await bloqueo.query("SELECT GET_LOCK(?,5) AS ok", [
      `checkout:${pago.id_pago}`,
    ]);
    comprobar(
      ok,
      "El cobro se está iniciando. Volvé a consultar en unos segundos.",
    );
    const actual = await leerPago(id);
    comprobar(
      ["pendiente", "rechazado"].includes(actual.estado),
      "El cobro ya no admite nuevos intentos.",
    );
    if (actual.checkout_url) return actual;
    const checkout = await adaptador.crear(actual);
    await db.query(
      "UPDATE pagos SET preferencia_id=?,checkout_url=?,actualizado_en=NOW(3) WHERE id_pago=? AND checkout_url IS NULL",
      [checkout.preferencia_id, checkout.checkout_url, pago.id_pago],
    );
    return leerPago(id);
  } finally {
    await bloqueo.query("SELECT RELEASE_LOCK(?)", [`checkout:${pago.id_pago}`]);
    bloqueo.release();
  }
}
export async function consultarPago(id) {
  const pago = await leerPago(id);
  if (
    !pago ||
    ["cancelando", "reembolsando", "reembolsado"].includes(pago.estado)
  )
    return pago;
  const remoto = await obtenerPasarela(pago.proveedor).consultar(pago);
  const actualizado = await transaccion(async (conexion) => {
    const [[pedido]] = await conexion.query(
      "SELECT estado FROM pedidos WHERE id_pedidos=? FOR UPDATE",
      [id],
    );
    const [[actual]] = await conexion.query(
      "SELECT * FROM pagos WHERE id_pedido=? FOR UPDATE",
      [id],
    );
    if (["cancelando", "reembolsando", "reembolsado"].includes(actual.estado))
      return actual;
    if (
      actual.estado === "cancelado" &&
      ["pendiente", "rechazado"].includes(remoto.estado)
    )
      return actual;
    if (
      actual.estado === "aprobado" &&
      ["pendiente", "rechazado"].includes(remoto.estado)
    )
      return actual;
    await conexion.query(
      "UPDATE pagos SET estado=?,referencia_pasarela=COALESCE(?,referencia_pasarela),metodo=COALESCE(?,metodo),actualizado_en=NOW(3) WHERE id_pedido=?",
      [
        remoto.estado,
        remoto.referencia_pasarela || null,
        remoto.metodo || null,
        id,
      ],
    );
    return {
      ...actual,
      ...remoto,
      devolver: pedido.estado === "cancelado" && remoto.estado === "aprobado",
    };
  });
  // Puede aprobarse un intento que ya estaba abierto cuando se canceló el pedido.
  if (actualizado.devolver)
    return reembolsarPago(id, "Sistema: conciliación de cancelación");
  return actualizado;
}
export async function reembolsarPago(id, actor) {
  const pago = await transaccion(async (conexion) => {
    const [[pedido]] = await conexion.query(
      "SELECT * FROM pedidos WHERE id_pedidos=? FOR UPDATE",
      [id],
    );
    comprobar(pedido, "Pedido no encontrado.");
    const [[envio]] = await conexion.query(
      "SELECT estado FROM envios WHERE id_pedido=? FOR UPDATE",
      [id],
    );
    const [[pago]] = await conexion.query(
      "SELECT * FROM pagos WHERE id_pedido=? FOR UPDATE",
      [id],
    );
    comprobar(
      pago && ["aprobado", "reembolsando", "reembolsado"].includes(pago.estado),
      "El pedido no tiene un pago aprobado para reembolsar.",
    );
    if (pago.estado === "reembolsado") return pago;
    comprobar(
      pedido.estado !== "entregado" &&
        !["en_camino", "entregado"].includes(envio?.estado),
      "El pedido ya fue despachado o entregado.",
    );
    comprobar(
      pago.referencia_pasarela,
      "No se encontró la referencia del pago.",
    );
    if (pago.estado !== "reembolsando") {
      if (pedido.estado !== "cancelado") {
        const historial = [
          ...(pedido.historial ? JSON.parse(pedido.historial) : []),
          { status: "cancelado", at: new Date().toISOString(), actor },
        ];
        await conexion.query(
          "UPDATE pedidos SET estado='cancelado',historial=? WHERE id_pedidos=?",
          [JSON.stringify(historial), id],
        );
      }
      await reponerStock(conexion, id);
      await conexion.query(
        "UPDATE pagos SET estado='reembolsando',actualizado_en=NOW(3) WHERE id_pedido=?",
        [id],
      );
    }
    return pago;
  });
  if (pago.estado === "reembolsado") return pago;
  const resultado = await obtenerPasarela(pago.proveedor).reembolsar(pago);
  await db.query(
    "UPDATE pagos SET estado='reembolsado',reembolso_id=?,actualizado_en=NOW(3) WHERE id_pago=?",
    [resultado.reembolso_id, pago.id_pago],
  );
  return leerPago(id);
}

export async function cancelarPago(id, actor) {
  const existente = await leerPago(id);
  comprobar(existente, "No se encontró el cobro del pedido.");
  // Comparte bloqueo con crear checkout: no deja un enlace nuevo abierto al cancelar.
  const bloqueo = await db.getConnection();
  try {
    const [[{ ok }]] = await bloqueo.query("SELECT GET_LOCK(?,5) AS ok", [
      `checkout:${existente.id_pago}`,
    ]);
    comprobar(ok, "El cobro se está actualizando. Reintentá en unos segundos.");
    return await cancelarConBloqueo(id, actor);
  } finally {
    await bloqueo.query("SELECT RELEASE_LOCK(?)", [
      `checkout:${existente.id_pago}`,
    ]);
    bloqueo.release();
  }
}

async function cancelarConBloqueo(id, actor) {
  const pago = await transaccion(async (conexion) => {
    const [[pedido]] = await conexion.query(
      "SELECT * FROM pedidos WHERE id_pedidos=? FOR UPDATE",
      [id],
    );
    const [[pago]] = await conexion.query(
      "SELECT * FROM pagos WHERE id_pedido=? FOR UPDATE",
      [id],
    );
    comprobar(pedido && pago, "No se encontró el cobro del pedido.");
    if (pedido.estado === "cancelado" && pago.estado === "cancelado")
      return pago;
    comprobar(
      ["pendiente", "cancelado"].includes(pedido.estado) &&
        ["pendiente", "rechazado", "cancelando"].includes(pago.estado),
      "Si el pago está aprobado, usá Cancelar y reembolsar.",
    );
    if (pedido.estado !== "cancelado") {
      const historial = [
        ...(pedido.historial ? JSON.parse(pedido.historial) : []),
        { status: "cancelado", at: new Date().toISOString(), actor },
      ];
      await conexion.query(
        "UPDATE pedidos SET estado='cancelado',historial=? WHERE id_pedidos=?",
        [JSON.stringify(historial), id],
      );
    }
    await reponerStock(conexion, id);
    await conexion.query(
      "UPDATE pagos SET estado='cancelando',actualizado_en=NOW(3) WHERE id_pedido=?",
      [id],
    );
    return pago;
  });
  if (pago.estado === "cancelado") return pago;
  const remoto = pago.preferencia_id
    ? await obtenerPasarela(pago.proveedor).cancelar(pago)
    : { estado: "cancelado" };
  await db.query(
    "UPDATE pagos SET estado=?,referencia_pasarela=COALESCE(?,referencia_pasarela),actualizado_en=NOW(3) WHERE id_pedido=?",
    [remoto.estado, remoto.referencia_pasarela || null, id],
  );
  if (remoto.estado === "aprobado") return reembolsarPago(id, actor);
  return leerPago(id);
}
