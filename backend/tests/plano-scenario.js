import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { planoDeFilas } from "../modules/plano.js";

/** Usa las sesiones, el pedido abierto y la conexión SQL del escenario general. */
export async function probarPlano(request, db, idMesa, idPedido) {
  const listar = (rol) => request("POST", "/mesas/obtener", {}, 200, rol);
  const guardar = (body, status, rol) =>
    request("PUT", "/mesas/plano", body, status, rol);
  const filas = await listar("admin");
  const mesa = filas.find((fila) => fila.id_mesa === idMesa);
  assert.ok(mesa);
  const base = planoDeFilas(filas);
  const layout = {
    shape: "rectangle",
    x: 200,
    y: 200,
    width: 128,
    height: 96,
    rotation: 45,
  };
  const tables = base.map((actual) =>
    actual.id === String(idMesa) ? { ...actual, layout } : actual,
  );
  const nueva = {
    id: "new:" + randomUUID(),
    number: 999,
    capacity: 2,
    layout: {
      ...layout,
      shape: "circle",
      x: 450,
      width: 80,
      height: 80,
      rotation: 0,
    },
  };
  const borrador = { base, tables: [...tables, nueva] };
  await guardar(borrador, 403, "mozo");
  await guardar(
    { base, tables: [...tables, { ...nueva, layout }] },
    400,
    "admin",
  );
  await guardar({ base, tables: [] }, 400, "admin");
  assert.deepEqual(planoDeFilas(await listar("mozo")), base);
  await guardar(borrador, 200, "admin");
  const publicadas = await listar("mozo");
  const publicada = publicadas.find((fila) => fila.id_mesa === idMesa);
  assert.deepEqual(planoDeFilas([publicada])[0].layout, layout);
  assert.equal(publicada.servicio_id, mesa.servicio_id);
  assert.equal(publicada.comensales, mesa.comensales);
  const [[pedido]] = await db.query(
    "SELECT id_mesa, estado FROM pedidos WHERE id_pedidos=?",
    [idPedido],
  );
  assert.equal(pedido.id_mesa, idMesa);
  assert.equal(pedido.estado, "pendiente");
  await guardar(borrador, 409, "admin");
  const despues = planoDeFilas(publicadas);
  const insertada = despues.find((fila) => fila.number === nueva.number);
  assert.ok(insertada && /^\d+$/.test(insertada.id));
  assert.deepEqual(insertada.layout, nueva.layout);
  await guardar(
    {
      base: despues,
      tables: despues.filter((fila) => fila.id !== insertada.id),
    },
    200,
    "admin",
  );
  assert.equal((await listar("mozo")).length, filas.length);
  console.log(
    "OK plano en SQL real: permisos, colisión, alta, baja, conflicto y visita con pedido conservada.",
  );
}
