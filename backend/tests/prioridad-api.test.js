import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';
import db from '../modules/db.js';

test('HTTP: comparte prioridad entre lecturas, valida movimientos y no escribe en MySQL', async (t) => {
  const filas = [
    { id_pedidos: 1, estado: 'pendiente', id_comida: 1 },
    { id_pedidos: 1, estado: 'pendiente', id_comida: 2 },
    { id_pedidos: 2, estado: 'pendiente', id_comida: 1 },
    { id_pedidos: 3, estado: 'preparacion', id_comida: 1 },
    { id_pedidos: 4, estado: 'entregado', id_comida: 1 },
  ];
  const original = structuredClone(filas);
  const queries = [];
  t.mock.method(db, 'query', async (sql) => {
    queries.push(sql);
    assert.match(sql, /^SELECT\b/i, 'La prioridad no ejecuta escrituras');
    return [structuredClone(filas)];
  });
  t.mock.method(console, 'error', () => {});
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}/api/pedidos`;
  async function request(method, url, body, status = 200) {
    const response = await fetch(base + url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    assert.equal(response.status, status, JSON.stringify(data));
    return data;
  }
  try {
    let lectura = await request('POST', '/obtener', {});
    assert.deepEqual(lectura.map((fila) => fila.prioridad), [1, 1, 2, 3, null]);
    await request('PATCH', '/2/prioridad', { destino: 1, antes: true });
    // Lecturas independientes de distintos clientes reciben el mismo orden.
    for (let i = 0; i < 2; i++) {
      lectura = await request('POST', '/obtener', {});
      assert.deepEqual(lectura.map((fila) => fila.prioridad), [2, 2, 1, 3, null]);
    }
    for (const [id, body] of [
      [1, { destino: 3, antes: true }],
      [1, { destino: 4, antes: true }],
      [2, { destino: 99, antes: false }],
      [2, { destino: 1, antes: 'false' }],
      [2, { destino: 2, antes: true }],
      [2, {}],
      ['abc', { destino: 1, antes: true }],
    ]) await request('PATCH', `/${id}/prioridad`, body, 400);
    assert.deepEqual(filas, original, 'No se alteran estados ni filas persistidas');
    await request('PATCH', '/2/prioridad', { destino: 1, antes: false });
    lectura = await request('POST', '/obtener', {});
    assert.deepEqual(lectura.map((fila) => fila.prioridad), [1, 1, 2, 3, null]);
    filas[2].estado = 'cancelado';
    await request('PATCH', '/2/prioridad', { destino: 1, antes: true }, 400);
    lectura = await request('POST', '/obtener', {});
    assert.equal(lectura[2].prioridad, null);
    assert.ok(queries.length > 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await db.end();
  }
});
