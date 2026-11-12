/**
 * Guardado del salón: convierte filas SQL al contrato del editor y valida la geometría recibida.
 * Compara la base del borrador con las mesas actuales para rechazar cambios concurrentes antes de escribir.
 */
import { transaccion, comprobar } from './restaurante.js';
import { floorSignature, validateFloor } from './plano-geometria.js';

const leerPlano = valor => typeof valor === 'string' ? JSON.parse(valor) : (valor ?? null);
export const planoDeFilas = filas => filas.map(mesa => ({
  id: String(mesa.id_mesa), number: Number(mesa.numero),
  capacity: Number(mesa.cantidad_personas), layout: leerPlano(mesa.plano),
}));

// Toda la edición se confirma en una sola transacción, incluidos altas y borrados.
export async function guardarPlano(body) {
  comprobar(Array.isArray(body?.tables) && Array.isArray(body?.base), 'Plano inválido.');
  const { tables, base } = body;
  comprobar(base.length <= 150 && base.every(t => t && typeof t.id === 'string'), 'Plano original inválido.');
  const error = validateFloor(tables);
  comprobar(!error, error);
  return transaccion(async conexion => {
    // Bloquea también los rangos: dos administradores no pueden confirmar el mismo borrador.
    const [actuales] = await conexion.query('SELECT * FROM mesas ORDER BY id_mesa FOR UPDATE');
    const activas = actuales.filter(m => !m.eliminado);
    if (floorSignature(base) !== floorSignature(planoDeFilas(activas)))
      throw Object.assign(new Error('El plano cambió mientras lo editabas. Cancelá y volvé a editar para cargar la versión actual.'), { status: 409 });
    const porId = new Map(activas.map(m => [String(m.id_mesa), m]));
    const conservadas = new Set(tables.map(t => t.id));
    // Validar todo antes de escribir, conservando las visitas y los pedidos históricos.
    for (const mesa of activas) {
      if (conservadas.has(String(mesa.id_mesa))) continue;
      comprobar(mesa.estado === 'desocupada', `La mesa ${mesa.numero} está ocupada y no puede eliminarse.`);
      const [[pedidos]] = await conexion.query("SELECT COUNT(*) AS cantidad FROM pedidos WHERE id_mesa=? AND estado IN ('pendiente','preparacion','listo')", [mesa.id_mesa]);
      comprobar(Number(pedidos.cantidad) === 0, `La mesa ${mesa.numero} tiene pedidos activos.`);
    }
    for (const mesa of tables) {
      const actual = porId.get(mesa.id);
      comprobar(actual || /^new:[a-f0-9-]{36}$/i.test(mesa.id), 'Identificador de mesa inválido.');
      if (actual) {
        comprobar(mesa.number === Number(actual.numero), 'El editor conserva los números de las mesas existentes.');
        comprobar(mesa.capacity >= Number(actual.comensales), `La capacidad de la mesa ${mesa.number} es menor que sus comensales.`);
      }
    }
    // Liberar los números de las mesas eliminadas antes de insertar las nuevas.
    for (const mesa of activas)
      if (!conservadas.has(String(mesa.id_mesa)))
        await conexion.query('UPDATE mesas SET eliminado=1,numero=NULL WHERE id_mesa=?', [mesa.id_mesa]);
    for (const mesa of tables) {
      const plano = JSON.stringify(mesa.layout);
      if (porId.has(mesa.id))
        await conexion.query('UPDATE mesas SET cantidad_personas=?,plano=? WHERE id_mesa=?', [mesa.capacity, plano, Number(mesa.id)]);
      else
        await conexion.query('INSERT INTO mesas (numero,cantidad_personas,plano) VALUES (?,?,?)', [mesa.number, mesa.capacity, plano]);
    }
    const [guardadas] = await conexion.query('SELECT * FROM mesas WHERE eliminado=0 ORDER BY numero');
    return guardadas;
  });
}
