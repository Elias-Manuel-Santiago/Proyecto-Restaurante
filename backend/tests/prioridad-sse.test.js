import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { app } from "../app.js";
import db from "../modules/db.js";
import { crearEventosPrioridad } from "../modules/eventos-prioridad.js";

test("SSE HTTP: dos clientes reciben el movimiento y una reconexión lee el orden vigente", { timeout: 8000 }, async (t) => {
  const filas = [1, 2].map((id) => ({ id_pedidos: id, estado: "pendiente" }));
  t.mock.method(db, "query", async (sql) => {
    assert.match(sql, /^SELECT\b/i);
    return [structuredClone(filas)];
  });
  const server = app.listen(0, "127.0.0.1");
  const clientes = [];
  t.after(async () => {
    for (const cliente of clientes) cliente.controller.abort();
    await Promise.all(clientes.map(({ reader }) => reader.cancel().catch(() => {})));
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await db.end();
  });
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const base = `http://127.0.0.1:${server.address().port}/api/pedidos`;
  async function conectar() {
    const controller = new AbortController();
    const response = await fetch(base + "/eventos", {
      signal: AbortSignal.any([controller.signal, t.signal]),
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/event-stream/);
    assert.equal(response.headers.get("x-accel-buffering"), "no");
    assert.match(response.headers.get("cache-control"), /no-cache/);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const cliente = {
      controller, reader,
      async frame() {
        while (!buffer.includes("\n\n")) {
          const { value, done } = await reader.read();
          assert.equal(done, false, "El stream debe continuar abierto");
          buffer += decoder.decode(value, { stream: true });
        }
        const end = buffer.indexOf("\n\n");
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        return frame;
      },
    };
    clientes.push(cliente);
    assert.equal(await cliente.frame(), "retry: 3000");
    return cliente;
  }
  const primero = await conectar();
  const segundo = await conectar();
  const mover = async (id, destino) => {
    const response = await fetch(base + `/${id}/prioridad`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destino, antes: true }), signal: t.signal,
    });
    assert.equal(response.status, 200);
    await response.json();
  };
  await mover(2, 1);
  assert.deepEqual(await Promise.all([primero.frame(), segundo.frame()]), [
    "event: prioridad\ndata: {}", "event: prioridad\ndata: {}",
  ]);
  primero.controller.abort();
  await primero.reader.cancel().catch(() => {});
  const reconectado = await conectar();
  const listado = await fetch(base + "/obtener", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: "{}", signal: t.signal,
  });
  assert.deepEqual((await listado.json()).map((fila) => fila.prioridad), [2, 1]);
  await mover(1, 2);
  assert.deepEqual(await Promise.all([segundo.frame(), reconectado.frame()]), [
    "event: prioridad\ndata: {}", "event: prioridad\ndata: {}",
  ]);
});

test("SSE: latidos, limpieza y desconexión de clientes lentos", (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const eventos = crearEventosPrioridad();
  const respuesta = () => {
    const res = new EventEmitter();
    res.frames = [];
    res.slow = false;
    res.status = () => res;
    res.set = () => res;
    res.flushHeaders = () => {};
    res.write = (frame) => { res.frames.push(frame); return !res.slow; };
    res.end = () => res.emit("close");
    eventos.conectar(res);
    return res;
  };
  const cerrado = respuesta();
  const lento = respuesta();
  const activo = respuesta();
  cerrado.emit("close");
  t.mock.timers.tick(25000);
  assert.deepEqual(cerrado.frames, ["retry: 3000\n\n"]);
  assert.equal(activo.frames.at(-1), ": latido\n\n");
  lento.slow = true;
  eventos.avisar();
  const recibidos = lento.frames.length;
  eventos.avisar();
  t.mock.timers.tick(25000);
  assert.equal(lento.frames.length, recibidos, "Se retiran cliente y temporizador");
  assert.equal(activo.frames.filter((frame) => frame.includes("event: prioridad")).length, 2);
  activo.emit("error", new Error("Desconexión"));
  const antes = activo.frames.length;
  eventos.avisar();
  t.mock.timers.tick(25000);
  assert.equal(activo.frames.length, antes);
});
