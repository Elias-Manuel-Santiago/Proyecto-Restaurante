import db from "./db.js";

// ==========================================
// CONSULTAS DE MESAS
// ==========================================

export async function crearMesa(cantidad_personas) {
  const [result] = await db.query(
    "INSERT INTO mesas (cantidad_personas) VALUES (?)",
    [cantidad_personas]
  );
  return result.insertId;
}

export async function borrarMesa(id_mesa) {
  const [result] = await db.query(
    "DELETE FROM mesas WHERE id_mesa = ?",
    [id_mesa]
  );
  return result.affectedRows;
}

export async function cambiarTamañoMesa(id_mesa, cantidad_personas) {
  const [result] = await db.query(
    "UPDATE mesas SET cantidad_personas = ? WHERE id_mesa = ?",
    [cantidad_personas, id_mesa]
  );
  return result.affectedRows;
}

export async function listarTodasLasMesas() {
  const [rows] = await db.query("SELECT * FROM mesas");
  return rows;
}

// ==========================================
// CONSULTAS DE PEDIDOS
// ==========================================

export async function crearPedido(id_mesa, comidas) {
  // comidas = [{ id_comida: 1, cantidad: 2, notas: 'Sin cebolla' }, ...]
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [pedidoResult] = await connection.query(
      "INSERT INTO pedidos (id_mesa, estado) VALUES (?, 'pendiente')",
      [id_mesa]
    );
    const id_pedido = pedidoResult.insertId;

    for (const comida of comidas) {
      await connection.query(
        "INSERT INTO pedidos_comida (id_pedido, id_comida, cantidad, notas) VALUES (?, ?, ?, ?)",
        [id_pedido, comida.id_comida, comida.cantidad, comida.notas || ""]
      );
    }

    await connection.commit();
    return id_pedido;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function editarPedido(id_pedido, comidas) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Reemplazamos los ítems del pedido por la nueva lista
    await connection.query("DELETE FROM pedidos_comida WHERE id_pedido = ?", [id_pedido]);

    for (const comida of comidas) {
      await connection.query(
        "INSERT INTO pedidos_comida (id_pedido, id_comida, cantidad, notas) VALUES (?, ?, ?, ?)",
        [id_pedido, comida.id_comida, comida.cantidad, comida.notas || ""]
      );
    }

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function cancelarPedido(id_pedido) {
  const [result] = await db.query(
    "UPDATE pedidos SET estado = 'cancelado' WHERE id_pedidos = ?",
    [id_pedido]
  );
  return result.affectedRows;
}

export async function despacharPedido(id_pedido) {
  const [result] = await db.query(
    "UPDATE pedidos SET estado = 'despachado' WHERE id_pedidos = ?",
    [id_pedido]
  );
  return result.affectedRows;
}

export async function listarTodosLosPedidos() {
  const [rows] = await db.query(`
    SELECT 
      p.id_pedidos,
      p.id_mesa,
      p.estado,
      pc.id_comida,
      pc.cantidad,
      pc.notas,
      c.nombre AS comida_nombre,
      c.precio
    FROM pedidos p
    LEFT JOIN pedidos_comida pc ON p.id_pedidos = pc.id_pedido
    LEFT JOIN comidas c ON pc.id_comida = c.id_comida
  `);
  return rows;
}

// ==========================================
// CONSULTAS DE COMIDAS
// ==========================================

export async function crearComida({ tipo, nombre, descripcion, precio, disponible = 1 }) {
  const [result] = await db.query(
    "INSERT INTO comidas (tipo, nombre, descripcion, precio, disponible, eliminado) VALUES (?, ?, ?, ?, ?, 0)",
    [tipo, nombre, descripcion, precio, disponible]
  );
  return result.insertId;
}

export async function editarComida(id_comida, { tipo, nombre, descripcion, precio }) {
  const [result] = await db.query(
    "UPDATE comidas SET tipo = ?, nombre = ?, descripcion = ?, precio = ? WHERE id_comida = ?",
    [tipo, nombre, descripcion, precio, id_comida]
  );
  return result.affectedRows;
}

export async function cambiarDisponibilidadComida(id_comida, disponible) {
  const [result] = await db.query(
    "UPDATE comidas SET disponible = ? WHERE id_comida = ?",
    [disponible ? 1 : 0, id_comida]
  );
  return result.affectedRows;
}

export async function eliminarComida(id_comida) {
  // Soft delete: cambiar el tag eliminado a 1[cite: 1]
  const [result] = await db.query(
    "UPDATE comidas SET eliminado = 1 WHERE id_comida = ?",
    [id_comida]
  );
  return result.affectedRows;
}

export async function listarTodasLasComidas() {
  // Filtrar para ignorar las tageadas como eliminadas[cite: 1]
  const [rows] = await db.query(
    "SELECT * FROM comidas WHERE eliminado = 0"
  );
  return rows;
}

// ==========================================
// CONSULTAS DE RESÚMENES
// ==========================================

export async function crearResumen({ tipo, ganancias, pedidos, pedidos_cancelados, comidas_posiciones }) {
  // comidas_posiciones = [{ id_comida: 1, posicion: 1 }, { id_comida: 3, posicion: 2 }, ...]
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [resumenResult] = await connection.query(
      "INSERT INTO resumenes (tipo, ganancias, pedidos, pedidos_cancelados) VALUES (?, ?, ?, ?)",
      [tipo, ganancias, pedidos, pedidos_cancelados]
    );
    const id_resumen = resumenResult.insertId;

    if (Array.isArray(comidas_posiciones)) {
      for (const item of comidas_posiciones) {
        await connection.query(
          "INSERT INTO resumen_comida (id_resumen, id_comida, posicion) VALUES (?, ?, ?)",
          [id_resumen, item.id_comida, item.posicion]
        );
      }
    }

    await connection.commit();
    return id_resumen;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listarResumenes() {
  const [rows] = await db.query("SELECT * FROM resumenes ORDER BY fecha DESC");
  return rows;
}

export async function borrarResumen(id_resumen) {
  const [result] = await db.query(
    "DELETE FROM resumenes WHERE id_resumen = ?",
    [id_resumen]
  );
  return result.affectedRows;
}

export async function listarDatosDeUnResumen(id_resumen) {
  const [resumen] = await db.query(
    "SELECT * FROM resumenes WHERE id_resumen = ?",
    [id_resumen]
  );

  if (resumen.length === 0) return null;

  const [comidas] = await db.query(`
    SELECT rc.posicion, c.*
    FROM resumen_comida rc
    JOIN comidas c ON rc.id_comida = c.id_comida
    WHERE rc.id_resumen = ?
    ORDER BY rc.posicion ASC
  `, [id_resumen]);

  return {
    ...resumen[0],
    comidas
  };
}