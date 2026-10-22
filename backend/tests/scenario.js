import { crearClientes, rolSolicitud } from "./clientes-auth.js";
import { probarAuth } from "./auth-scenario.js";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import db from "../modules/db.js";
import { migrar } from "../modules/migrate.js";
import { app } from "../app.js";
import { probarRepartos } from "./repartos-scenario.js";

assert.match(process.env.DB_DATABASE, /^codex_restaurante_test_[a-f0-9]+$/);
await migrar();
await migrar(); // Repetir no debe borrar ni duplicar datos.
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}/api`;
const clientes = await crearClientes(base, db);
let checks = 0;
async function request(method, path, body, status = 200, asRole) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Nacar-Request": "1",
      Cookie: clientes.cookies[asRole || rolSolicitud(method, path, body)],
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = response.status === 204 ? null : await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  checks++;
  return data;
}
try {
  const mesa = await request(
    "POST",
    "/mesas",
    { numero: 10, cantidad_personas: 4 },
    201,
  );
  const id = mesa.id_mesa;
  await request("POST", "/mesas", { numero: 10, cantidad_personas: 4 }, 400);
  await request("PATCH", `/mesas/${id}/abrir`, { comensales: 8 }, 400);
  await request("PATCH", `/mesas/${id}/abrir`, { comensales: 2 });
  const plato = {
    tipo: "Principales",
    nombre: "Plato de prueba",
    descripcion: "Descripción de prueba",
    precio: 1200.5,
    imagen: "https://example.com/plato.png",
    disponible: true,
  };
  const comida = await request("POST", "/comidas", plato, 201);
  const dishId = comida.id_comida;
  const body = {
    id_mesa: id,
    mozo_id: "local-test",
    mozo_nombre: "Mozo local",
    comidas: [{ id_comida: dishId, cantidad: 2, notas: "Sin sal" }],
  };
  await request(
    "POST",
    "/pedidos",
    { ...body, comidas: [{ id_comida: dishId, cantidad: 0 }] },
    400,
  );
  assert.equal(
    (await request("POST", "/pedidos/obtener", {})).length,
    0,
    "La transacción inválida debe revertirse",
  );
  const pedido = await request("POST", "/pedidos", body, 201);
  const orderId = pedido.id_pedido;
  await request("PATCH", `/mesas/${id}/cerrar`, {}, 400);
  await request("DELETE", `/comidas/${dishId}`, undefined, 400);
  await request(
    "PATCH",
    `/pedidos/${orderId}/estado`,
    { estado: "listo", actor: "Chef" },
    400,
  );
  await request("PUT", `/pedidos/${orderId}`, {
    comidas: [{ id_comida: dishId, cantidad: 3, notas: "Poco cocido" }],
  });
  await request("PUT", `/comidas/${dishId}`, {
    ...plato,
    nombre: "Nombre nuevo",
    precio: 9999,
  });
  let filas = await request("POST", "/pedidos/obtener", {});
  assert.equal(Number(filas[0].precio), 1200.5);
  assert.equal(filas[0].comida_nombre, "Plato de prueba");
  assert.equal(filas[0].cantidad, 3);
  const visita = filas[0].servicio_id;
  assert.ok(filas[0].creado_en);
  for (const estado of ["preparacion", "listo", "entregado"])
    await request("PATCH", `/pedidos/${orderId}/estado`, {
      estado,
      actor: "Servicio de prueba",
    });
  await request("PUT", `/pedidos/${orderId}`, { comidas: body.comidas }, 400);
  filas = await request("POST", "/pedidos/obtener", {});
  assert.equal(JSON.parse(filas[0].historial).length, 4);
  await request("PATCH", `/mesas/${id}/cerrar`, {});
  await request("PUT", `/mesas/${id}`, { numero: 11, cantidad_personas: 6 });
  await request("PATCH", `/mesas/${id}/abrir`, { comensales: 4 });
  const cancelado = await request("POST", "/pedidos", body, 201);
  filas = await request("POST", "/pedidos/obtener", {});
  assert.notEqual(filas[0].servicio_id, visita);
  assert.equal(
    filas.find((fila) => fila.id_pedidos === orderId).numero_mesa,
    10,
  );
  await request("PATCH", `/pedidos/${cancelado.id_pedido}/cancelar`, {
    actor: "Mozo",
  });
  await request("PATCH", `/mesas/${id}/cerrar`, {});
  await request("PATCH", `/comidas/${dishId}/disponibilidad`, {
    disponible: false,
  });
  assert.equal(
    (await request("POST", "/comidas/obtener", {}))[0].disponible,
    0,
  );
  const resumen = await request(
    "POST",
    "/resumenes",
    {
      tipo: "Prueba",
      ganancias: 3601.5,
      pedidos: 2,
      pedidos_cancelados: 1,
      comidas_posiciones: [{ id_comida: dishId, posicion: 1 }],
    },
    201,
  );
  assert.equal(
    (
      await request("POST", "/resumenes/detalle", {
        id_resumen: resumen.id_resumen,
      })
    ).comidas.length,
    1,
  );
  assert.equal((await request("POST", "/resumenes/obtener", {})).length, 1);
  await request("DELETE", `/resumenes/${resumen.id_resumen}`);
  await request("DELETE", `/comidas/${dishId}`);
  assert.equal((await request("POST", "/comidas/obtener", {})).length, 0);
  await request("DELETE", `/mesas/${id}`);
  assert.equal((await request("POST", "/mesas/obtener", {})).length, 0);
  assert.equal(
    (await request("POST", "/pedidos/obtener", {})).length,
    2,
    "Borrado lógico conserva los pedidos",
  );
  const frontendCode = await new Promise((resolve, reject) => {
    const proceso = spawn(
      process.execPath,
      ["../frontend/tests/store.integration.mjs"],
      {
        env: {
          ...process.env,
          TEST_API_BASE: base,
          TEST_AUTH_PASSWORD: clientes.password,
        },
        stdio: "inherit",
      },
    );
    proceso.on("error", reject);
    proceso.on("exit", resolve);
  });
  assert.equal(frontendCode, 0, "El frontend debe operar contra la API real");
  await probarRepartos(request, db, clientes);
  await probarAuth(base, db, clientes);
  const preflight = await fetch(base + "/pedidos/1/estado", {
    method: "OPTIONS",
  });
  assert.match(preflight.headers.get("access-control-allow-methods"), /PATCH/);
  console.log(
    `OK: ${checks} solicitudes, transacciones, estados, historial, precios, visitas, CRUD, resúmenes, CORS y migración repetible.`,
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
  await db.end();
}
