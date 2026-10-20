import test from 'node:test';
import assert from 'node:assert/strict';
import { crearColaPrioridad } from '../modules/prioridad.js';

const pedido = (id, estado = 'pendiente') => ({
  id_pedidos: id, estado, creado_en: '2026-10-19T12:00:00Z',
});
const orden = (cola, filas) => cola.listar(filas)
  .filter((fila) => fila.prioridad !== null)
  .sort((a, b) => a.prioridad - b.prioridad)
  .map((fila) => fila.id_pedidos);

test('cola compartida: movimientos, nuevos al final y limpieza de finalizados', () => {
  const cola = crearColaPrioridad();
  const filas = [pedido(3), pedido(2), pedido(1)];
  assert.deepEqual(orden(cola, filas), [1, 2, 3]);
  cola.mover(filas, 3, 1, true);
  assert.deepEqual(orden(cola, filas), [3, 1, 2]);
  // Una segunda lectura (otro empleado) conserva la prioridad.
  assert.deepEqual(orden(cola, [...filas].reverse()), [3, 1, 2]);
  cola.mover(filas, 3, 2, false);
  assert.deepEqual(orden(cola, filas), [1, 2, 3]);
  cola.mover(filas, 3, 1, true);
  assert.deepEqual(orden(cola, [pedido(4), ...filas]), [3, 1, 2, 4]);
  const terminados = [pedido(1), pedido(2, 'entregado'), pedido(3, 'cancelado'), pedido(4)];
  assert.deepEqual(orden(cola, terminados), [1, 4]);
  assert.equal(cola.listar(terminados)[1].prioridad, null);
  assert.deepEqual(orden(cola, []), []);
});

test('JOIN con varios ítems, transición, filtros y reinicio', () => {
  const cola = crearColaPrioridad();
  const filas = [pedido(1), pedido(1), pedido(2), pedido(3), pedido(4)];
  cola.listar(filas);
  // El destino puede provenir de una vista filtrada: no se pierden los ocultos.
  cola.mover(filas, 4, 2, true);
  assert.deepEqual(orden(cola, filas), [1, 1, 4, 2, 3]);
  assert.equal(cola.listar(filas)[0].prioridad, cola.listar(filas)[1].prioridad);
  const siguienteEstado = filas.map((fila) => fila.id_pedidos === 4
    ? { ...fila, estado: 'preparacion' } : fila);
  assert.deepEqual(orden(cola, siguienteEstado), [1, 1, 4, 2, 3]);
  assert.deepEqual(orden(crearColaPrioridad(), filas), [1, 1, 2, 3, 4]);
});

test('rechaza movimientos inválidos o desactualizados sin cambiar la prioridad', () => {
  const cola = crearColaPrioridad();
  const filas = [pedido(1), pedido(2), pedido(3, 'preparacion'), pedido(4, 'listo')];
  cola.mover(filas, 2, 1, true);
  for (const args of [[1, 1, true], [1, 2, 'true'], [1, 99, true],
    [1, 3, false], [1, 4, true], [0, 2, true], [1, 1.5, false]]) {
    assert.throws(() => cola.mover(filas, ...args));
    assert.deepEqual(orden(cola, filas), [2, 1, 3, 4]);
  }
  assert.throws(() => cola.mover([pedido(1), pedido(2, 'entregado')], 1, 2, true));
  assert.deepEqual(orden(cola, [pedido(1)]), [1]);
});
