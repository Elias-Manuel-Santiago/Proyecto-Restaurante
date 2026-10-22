import { readFile } from "node:fs/promises";
import db from "./db.js";

export async function migrarReparto(pool = db) {
  const conexion = await pool.getConnection();
  try {
    const [columnas] = await conexion.query("SHOW COLUMNS FROM pedidos");
    const mesa = columnas.find((campo) => campo.Field === "id_mesa");
    if (!mesa || !/^int(?:\(\d+\))?$/.test(mesa.Type))
      throw new Error(
        "Reparto requiere pedidos.id_mesa INT compatible con la base existente.",
      );
    const [[existente]] = await conexion.query(
      "SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='envios'",
    );
    if (existente) {
      const [campos] = await conexion.query("SHOW COLUMNS FROM envios");
      const esperados = {
        id_pedido: "int",
        destinatario: "varchar(100)",
        direccion: "varchar(300)",
        indicaciones: "varchar(300)",
        repartidor_id: "varchar(200)",
        repartidor_nombre: "varchar(80)",
        estado: "varchar(20)",
        retirado_en: "datetime(3)",
        entregado_en: "datetime(3)",
      };
      const [claves] = await conexion.query(
        "SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME, REFERENCED_TABLE_SCHEMA FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='envios'",
      );
      const [[{ base }]] = await conexion.query("SELECT DATABASE() AS base");
      if (
        existente.ENGINE !== "InnoDB" ||
        campos.length !== 9 ||
        claves.filter((clave) => clave.CONSTRAINT_NAME === "PRIMARY").length !==
          1 ||
        !claves.some(
          (clave) =>
            clave.CONSTRAINT_NAME === "PRIMARY" &&
            clave.COLUMN_NAME === "id_pedido",
        ) ||
        !Object.entries(esperados).every(([nombre, tipo]) =>
          campos.some(
            (campo) =>
              campo.Field === nombre &&
              campo.Type.replace(/^int\(\d+\)/, "int") === tipo &&
              campo.Null === (nombre.endsWith("_en") ? "YES" : "NO"),
          ),
        ) ||
        !claves.some(
          (clave) =>
            clave.COLUMN_NAME === "id_pedido" &&
            clave.REFERENCED_TABLE_NAME === "pedidos" &&
            clave.REFERENCED_COLUMN_NAME === "id_pedidos" &&
            clave.REFERENCED_TABLE_SCHEMA === base,
        )
      )
        throw new Error(
          "La tabla envios existente es incompatible; no se modificó. Revisá su estructura.",
        );
    }
    // Conserva todas las mesas existentes; los nuevos pedidos de envío usan NULL.
    if (mesa.Null === "NO")
      await conexion.query("ALTER TABLE pedidos MODIFY id_mesa INT NULL");
    const sql = await readFile(
      new URL("../../frontend/database/repartos.sql", import.meta.url),
      "utf8",
    );
    for (const sentencia of sql
      .replace(/^\s*--.*$/gm, "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await conexion.query(sentencia);
  } finally {
    conexion.release();
  }
}

if (process.argv[1]?.endsWith("migrate-reparto.js")) {
  try {
    await migrarReparto();
    console.log("Reparto conectado: migración completada.");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
