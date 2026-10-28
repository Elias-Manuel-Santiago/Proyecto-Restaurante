import db from "./db.js";

// Se calcula en milésimas enteras para no arrastrar errores de coma flotante:
// MySQL devuelve DECIMAL(12,3) como texto ("2.750").
const milesimas = (valor) => Math.round(Number(valor) * 1000);
const decimal = (milesimas) => (milesimas / 1000).toFixed(3);
const mostrar = (milesimas) =>
  (milesimas / 1000).toLocaleString("es-AR", { maximumFractionDigits: 3 });

function comprobar(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}
const texto = (valor, max) =>
  typeof valor === "string" && valor.trim().length > 0 && valor.length <= max;
const entero = (valor) => Number.isSafeInteger(valor) && valor > 0;
const MAXIMO = 999999999; // DECIMAL(12,3) admite hasta 999.999.999,999.
const cantidadValida = (valor, permitirNegativa = false) =>
  Number.isFinite(valor) &&
  Math.abs(valor) <= MAXIMO &&
  milesimas(valor) !== 0 &&
  (permitirNegativa || valor > 0);

// Orden fijo de bloqueo (id_stock ascendente) para que dos pedidos no se traben.
async function bloquearInsumos(conexion, ids) {
  if (!ids.length) return new Map();
  const [filas] = await conexion.query(
    `SELECT s.id_stock, s.nombre, s.cantidad, u.nombre AS unidad
     FROM Stock s JOIN Unidades u ON u.id_unidad=s.id_unidad
     WHERE s.id_stock IN (?) ORDER BY s.id_stock FOR UPDATE`,
    [ids],
  );
  return new Map(filas.map((fila) => [fila.id_stock, fila]));
}

/**
 * Deja el stock consumido por el pedido igual a lo que piden sus ítems actuales.
 * Se llama al crear y al editar, dentro de la misma transacción que guarda los
 * ítems: si un insumo no alcanza, se revierte todo el pedido.
 */
export async function consumirStock(conexion, idPedido, idUsuario = null) {
  const [requeridos] = await conexion.query(
    `SELECT cs.id_stock, SUM(pc.cantidad * cs.cantidad_requerida) AS cantidad
     FROM pedidos_comida pc JOIN comida_stock cs ON cs.id_comida=pc.id_comida
     WHERE pc.id_pedido=? GROUP BY cs.id_stock`,
    [idPedido],
  );
  const [previos] = await conexion.query(
    "SELECT id_stock, cantidad FROM movimientos_stock WHERE id_pedido=? AND tipo='consumo'",
    [idPedido],
  );
  const nuevo = new Map(
    requeridos.map((fila) => [fila.id_stock, milesimas(fila.cantidad)]),
  );
  const anterior = new Map(
    previos.map((fila) => [fila.id_stock, milesimas(fila.cantidad)]),
  );
  const ids = [...new Set([...nuevo.keys(), ...anterior.keys()])].sort(
    (a, b) => a - b,
  );
  const insumos = await bloquearInsumos(conexion, ids);
  // Primero se valida todo; recién después se escribe.
  for (const id of ids) {
    const diferencia = (nuevo.get(id) ?? 0) - (anterior.get(id) ?? 0);
    const insumo = insumos.get(id);
    comprobar(
      diferencia <= 0 || milesimas(insumo.cantidad) >= diferencia,
      `Sin stock suficiente de ${insumo.nombre}: el pedido necesita ${mostrar(diferencia)} ${insumo.unidad} y quedan ${mostrar(milesimas(insumo.cantidad))}.`,
    );
  }
  for (const id of ids) {
    const total = nuevo.get(id) ?? 0;
    const diferencia = total - (anterior.get(id) ?? 0);
    if (diferencia === 0) continue;
    await conexion.query(
      "UPDATE Stock SET cantidad=cantidad-? WHERE id_stock=?",
      [decimal(diferencia), id],
    );
    if (!total)
      await conexion.query(
        "DELETE FROM movimientos_stock WHERE id_pedido=? AND id_stock=? AND tipo='consumo'",
        [idPedido, id],
      );
    else
      await conexion.query(
        `INSERT INTO movimientos_stock (id_stock,id_pedido,tipo,cantidad,id_usuario)
         VALUES (?,?,'consumo',?,?)
         ON DUPLICATE KEY UPDATE cantidad=VALUES(cantidad), creado_en=CURRENT_TIMESTAMP(3)`,
        [id, idPedido, decimal(total), idUsuario],
      );
  }
}

/**
 * Devuelve exactamente lo que se descontó (aunque la receta haya cambiado).
 * Es idempotente: si el pedido ya se repuso no vuelve a sumar.
 */
export async function reponerStock(conexion, idPedido) {
  const [consumos] = await conexion.query(
    `SELECT c.id_stock, c.cantidad, c.id_usuario FROM movimientos_stock c
     WHERE c.id_pedido=? AND c.tipo='consumo' AND NOT EXISTS (
       SELECT 1 FROM movimientos_stock r
       WHERE r.id_pedido=c.id_pedido AND r.id_stock=c.id_stock AND r.tipo='reposicion')
     ORDER BY c.id_stock`,
    [idPedido],
  );
  await bloquearInsumos(
    conexion,
    consumos.map((fila) => fila.id_stock),
  );
  for (const consumo of consumos) {
    await conexion.query(
      "UPDATE Stock SET cantidad=cantidad+? WHERE id_stock=?",
      [consumo.cantidad, consumo.id_stock],
    );
    // El UNIQUE (id_pedido,id_stock,tipo) es la última defensa contra reponer dos veces.
    await conexion.query(
      "INSERT INTO movimientos_stock (id_stock,id_pedido,tipo,cantidad) VALUES (?,?,'reposicion',?)",
      [consumo.id_stock, idPedido, consumo.cantidad],
    );
  }
}

// --- Administración del inventario (solo admin) ---

async function transaccion(operacion) {
  const conexion = await db.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await operacion(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

export async function listarInventario() {
  const [unidades] = await db.query(
    "SELECT id_unidad, nombre FROM Unidades ORDER BY nombre",
  );
  const [insumos] = await db.query(
    `SELECT s.id_stock, s.nombre, s.cantidad, s.id_unidad, u.nombre AS unidad
     FROM Stock s JOIN Unidades u ON u.id_unidad=s.id_unidad ORDER BY s.nombre`,
  );
  const [recetas] = await db.query(
    `SELECT cs.id_comida, cs.id_stock, cs.cantidad_requerida
     FROM comida_stock cs JOIN comidas c ON c.id_comida=cs.id_comida
     WHERE c.eliminado=0 ORDER BY cs.id_comida, cs.id_stock`,
  );
  const [movimientos] = await db.query(
    `SELECT m.id_movimiento, m.id_stock, s.nombre AS insumo, u.nombre AS unidad,
       m.id_pedido, m.tipo, m.cantidad, m.creado_en, us.nombre AS usuario
     FROM movimientos_stock m JOIN Stock s ON s.id_stock=m.id_stock
     JOIN Unidades u ON u.id_unidad=s.id_unidad
     LEFT JOIN usuarios us ON us.id_usuario=m.id_usuario
     ORDER BY m.creado_en DESC, m.id_movimiento DESC LIMIT 30`,
  );
  return { unidades, insumos, recetas, movimientos };
}

export async function crearUnidad({ nombre }) {
  comprobar(texto(nombre, 100), "Escribí el nombre de la unidad.");
  const [[existente]] = await db.query(
    "SELECT id_unidad FROM Unidades WHERE nombre=?",
    [nombre.trim()],
  );
  comprobar(!existente, "Esa unidad ya existe.");
  const [resultado] = await db.query(
    "INSERT INTO Unidades (nombre) VALUES (?)",
    [nombre.trim()],
  );
  return resultado.insertId;
}

async function validarInsumo(conexion, { nombre, id_unidad }, id = 0) {
  comprobar(texto(nombre, 100), "Escribí el nombre del insumo.");
  comprobar(entero(id_unidad), "Elegí la unidad del insumo.");
  const [[unidad]] = await conexion.query(
    "SELECT id_unidad FROM Unidades WHERE id_unidad=?",
    [id_unidad],
  );
  comprobar(unidad, "La unidad elegida no existe.");
  const [[repetido]] = await conexion.query(
    "SELECT id_stock FROM Stock WHERE nombre=? AND id_stock<>?",
    [nombre.trim(), id],
  );
  comprobar(!repetido, "Ya hay un insumo con ese nombre.");
}

export async function crearInsumo(datos, idUsuario = null) {
  const inicial = datos.cantidad ?? 0;
  comprobar(
    Number.isFinite(inicial) && inicial >= 0 && inicial <= MAXIMO,
    "La cantidad inicial no puede ser negativa.",
  );
  return transaccion(async (conexion) => {
    await validarInsumo(conexion, datos);
    const [resultado] = await conexion.query(
      "INSERT INTO Stock (nombre,cantidad,id_unidad) VALUES (?,?,?)",
      [datos.nombre.trim(), decimal(milesimas(inicial)), datos.id_unidad],
    );
    if (milesimas(inicial))
      await conexion.query(
        "INSERT INTO movimientos_stock (id_stock,tipo,cantidad,id_usuario) VALUES (?,'ajuste',?,?)",
        [resultado.insertId, decimal(milesimas(inicial)), idUsuario],
      );
    return resultado.insertId;
  });
}

export async function editarInsumo(id, datos) {
  return transaccion(async (conexion) => {
    await validarInsumo(conexion, datos, Number(id));
    const [resultado] = await conexion.query(
      "UPDATE Stock SET nombre=?, id_unidad=? WHERE id_stock=?",
      [datos.nombre.trim(), datos.id_unidad, id],
    );
    comprobar(resultado.affectedRows > 0, "Insumo no encontrado.");
  });
}

/** Ajuste manual (compra, merma, recuento). Queda registrado con su autor. */
export async function ajustarInsumo(id, { cantidad }, idUsuario = null) {
  comprobar(
    cantidadValida(cantidad, true),
    "Indicá cuánto sumar (positivo) o restar (negativo).",
  );
  return transaccion(async (conexion) => {
    const insumo = (await bloquearInsumos(conexion, [Number(id)])).get(
      Number(id),
    );
    comprobar(insumo, "Insumo no encontrado.");
    const final = milesimas(insumo.cantidad) + milesimas(cantidad);
    comprobar(
      final >= 0,
      `No se puede restar más de lo que hay: quedan ${mostrar(milesimas(insumo.cantidad))} ${insumo.unidad} de ${insumo.nombre}.`,
    );
    await conexion.query("UPDATE Stock SET cantidad=? WHERE id_stock=?", [
      decimal(final),
      id,
    ]);
    await conexion.query(
      "INSERT INTO movimientos_stock (id_stock,tipo,cantidad,id_usuario) VALUES (?,'ajuste',?,?)",
      [id, decimal(milesimas(cantidad)), idUsuario],
    );
    return decimal(final);
  });
}

/** Reemplaza la receta completa del plato. Lista vacía = plato sin receta. */
export async function guardarReceta(idComida, { insumos }) {
  comprobar(
    Array.isArray(insumos) && insumos.length <= 50,
    "Revisá los insumos de la receta.",
  );
  comprobar(
    new Set(insumos.map((item) => item.id_stock)).size === insumos.length,
    "No repitas un insumo en la misma receta.",
  );
  for (const item of insumos)
    comprobar(
      entero(item.id_stock) && cantidadValida(item.cantidad_requerida),
      "Cada insumo necesita una cantidad mayor a cero.",
    );
  return transaccion(async (conexion) => {
    const [[comida]] = await conexion.query(
      "SELECT id_comida FROM comidas WHERE id_comida=? AND eliminado=0 FOR UPDATE",
      [idComida],
    );
    comprobar(comida, "Comida no encontrada.");
    if (insumos.length) {
      const [existentes] = await conexion.query(
        "SELECT id_stock FROM Stock WHERE id_stock IN (?)",
        [insumos.map((item) => item.id_stock)],
      );
      comprobar(
        existentes.length === insumos.length,
        "Uno de los insumos ya no existe.",
      );
    }
    // Los pedidos ya registrados conservan lo descontado en movimientos_stock.
    await conexion.query("DELETE FROM comida_stock WHERE id_comida=?", [
      idComida,
    ]);
    for (const item of insumos)
      await conexion.query(
        "INSERT INTO comida_stock (id_comida,id_stock,cantidad_requerida) VALUES (?,?,?)",
        [idComida, item.id_stock, decimal(milesimas(item.cantidad_requerida))],
      );
  });
}
