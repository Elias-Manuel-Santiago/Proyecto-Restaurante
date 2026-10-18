import db from "./db.js";

// Resúmenes existentes: consultas parametrizadas y transacción para sus posiciones.
export async function crearResumen({
  tipo,
  ganancias,
  pedidos,
  pedidos_cancelados,
  comidas_posiciones,
}) {
  // comidas_posiciones = [{ id_comida: 1, posicion: 1 }, { id_comida: 3, posicion: 2 }, ...]
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [resumenResult] = await connection.query(
      "INSERT INTO resumenes (tipo, ganancias, pedidos, pedidos_cancelados) VALUES (?, ?, ?, ?)",
      [tipo, ganancias, pedidos, pedidos_cancelados],
    );
    const id_resumen = resumenResult.insertId;

    if (Array.isArray(comidas_posiciones)) {
      for (const item of comidas_posiciones) {
        await connection.query(
          "INSERT INTO resumen_comida (id_resumen, id_comida, posicion) VALUES (?, ?, ?)",
          [id_resumen, item.id_comida, item.posicion],
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
    [id_resumen],
  );
  return result.affectedRows;
}

export async function listarDatosDeUnResumen(id_resumen) {
  const [resumen] = await db.query(
    "SELECT * FROM resumenes WHERE id_resumen = ?",
    [id_resumen],
  );

  if (resumen.length === 0) return null;

  const [comidas] = await db.query(
    `
    SELECT rc.posicion, c.*
    FROM resumen_comida rc
    JOIN comidas c ON rc.id_comida = c.id_comida
    WHERE rc.id_resumen = ?
    ORDER BY rc.posicion ASC
  `,
    [id_resumen],
  );

  return {
    ...resumen[0],
    comidas,
  };
}
