import db from "./db.js";
import { readFile } from "node:fs/promises";

export async function migrarAutenticacion(pool = db) {
  const conexion = await pool.getConnection();
  try {
    // Reutiliza el esquema de acceso versionado: no crea usuarios duplicados.
    const esquema = await readFile(
      new URL("../../frontend/database/restaurante.sql", import.meta.url),
      "utf8",
    );
    for (const nombre of ["usuarios", "sesiones_usuarios"]) {
      const sql = esquema.match(
        new RegExp(`CREATE TABLE ${nombre} \\([\\s\\S]*?;`),
      )?.[0];
      if (!sql) throw new Error(`No se encontró la definición de ${nombre}.`);
      await conexion.query(
        sql.replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS "),
      );
    }
    const [campos] = await conexion.query("SHOW COLUMNS FROM usuarios");
    for (const nombre of [
      "id_usuario",
      "usuario",
      "nombre",
      "tipo",
      "password_hash",
      "activo",
    ])
      if (!campos.some((c) => c.Field === nombre))
        throw new Error(
          `usuarios existente incompatible: falta ${nombre}. No se borraron datos.`,
        );
    for (const [tabla, primaria, unica] of [
      ["usuarios", "id_usuario", "usuario"],
      ["sesiones_usuarios", "id_sesion", "token_hash"],
    ]) {
      const [indices] = await conexion.query(
        "SELECT INDEX_NAME,NON_UNIQUE,GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columnas FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? GROUP BY INDEX_NAME,NON_UNIQUE",
        [tabla],
      );
      const [[motor]] = await conexion.query(
        "SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
        [tabla],
      );
      if (
        motor.ENGINE !== "InnoDB" ||
        !indices.some(
          (i) => i.INDEX_NAME === "PRIMARY" && i.columnas === primaria,
        ) ||
        !indices.some((i) => !i.NON_UNIQUE && i.columnas === unica)
      )
        throw new Error(
          `${tabla} existente incompatible: se requiere InnoDB, PK y unicidad de ${unica}. No se borraron datos.`,
        );
    }
    const [sesiones] = await conexion.query(
      "SHOW COLUMNS FROM sesiones_usuarios",
    );
    for (const nombre of [
      "id_usuario",
      "token_hash",
      "creado_en",
      "expira_en",
      "revocado_en",
    ]) {
      if (!sesiones.some((c) => c.Field === nombre))
        throw new Error(
          `sesiones_usuarios existente incompatible: falta ${nombre}.`,
        );
    }
    const [[control]] = await conexion.query(
      "SELECT CHECK_CLAUSE FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND CONSTRAINT_NAME='usuarios_tipo_check'",
    );
    if (!control || !control.CHECK_CLAUSE.includes("repartidor")) {
      const [[{ version }]] = await conexion.query(
        "SELECT VERSION() AS version",
      );
      // Una sola sentencia conserva la restricción incluso si falla el ALTER.
      const quitar = version.includes("MariaDB")
        ? "DROP CONSTRAINT"
        : "DROP CHECK";
      await conexion.query(
        `ALTER TABLE usuarios ${control ? `${quitar} usuarios_tipo_check, ` : ""}ADD CONSTRAINT usuarios_tipo_check CHECK (tipo IN ('admin','chef','mozo','repartidor'))`,
      );
    }
  } finally {
    conexion.release();
  }
}
if (process.argv[1]?.endsWith("migrate-auth.js")) {
  try {
    await migrarAutenticacion();
    console.log("Migración de acceso completada.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
