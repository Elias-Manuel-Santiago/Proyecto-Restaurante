import db from "./db.js";
import { readFile } from "node:fs/promises";

// IF NOT EXISTS no detecta tablas ajenas con el mismo nombre: se validan antes del DDL.
async function validarExistentes(conexion, sql) {
  for (const [, tabla, cuerpo] of sql.matchAll(
    /CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\) ENGINE/g,
  )) {
    const [[actual]] = await conexion.query(
      "SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
      [tabla],
    );
    if (!actual) continue;
    const error = () => {
      throw new Error(
        `Envíos/pagos: ${tabla} tiene una estructura incompatible. No se modificó; revisá sus columnas, claves y restricciones.`,
      );
    };
    if (actual.ENGINE !== "InnoDB") error();
    const [columnas] = await conexion.query("SHOW COLUMNS FROM ??", [tabla]);
    const esperadas = [
      ...cuerpo.matchAll(
        /^  (\w+) ((?:VARCHAR|CHAR|DECIMAL|DATETIME|TINYINT)\([^)]*\)|INT) (.*),?$/gm,
      ),
    ];
    if (columnas.length !== esperadas.length) error();
    for (const [, nombre, tipo, resto] of esperadas) {
      const campo = columnas.find((c) => c.Field === nombre);
      if (
        !campo ||
        campo.Type.toLowerCase().replace(/^int\(\d+\)/, "int") !==
          tipo.toLowerCase() ||
        campo.Null !== (resto.includes("NOT NULL") ? "NO" : "YES")
      )
        error();
    }
    const [[ddl]] = await conexion.query("SHOW CREATE TABLE ??", [tabla]);
    const normalizar = (valor) => valor.toLowerCase().replace(/[`\s()]/g, "");
    const creado = normalizar(ddl["Create Table"]);
    for (const linea of cuerpo
      .split("\n")
      .filter((l) => /PRIMARY KEY|UNIQUE KEY|CONSTRAINT/.test(l))) {
      // CHECK y claves deben conservarse; el motor puede agregar paréntesis/comillas de identificador.
      if (
        !creado.includes(
          normalizar(
            linea.replace(/,$/, "").replace(/ ON DELETE RESTRICT/g, ""),
          ),
        )
      )
        error();
    }
  }
}

export async function migrarEnviosPagos(pool = db) {
  const conexion = await pool.getConnection();
  try {
    const sql = await readFile(
      new URL("../../frontend/database/envios-pagos.sql", import.meta.url),
      "utf8",
    );
    await validarExistentes(conexion, sql);
    const [campos] = await conexion.query("SHOW COLUMNS FROM pedidos");
    const pagoRequerido = campos.find((c) => c.Field === "pago_requerido");
    if (
      pagoRequerido &&
      (!/^tinyint(?:\(1\))?$/.test(pagoRequerido.Type) ||
        pagoRequerido.Null !== "NO")
    )
      throw new Error(
        "Envíos/pagos: pedidos.pago_requerido tiene una estructura incompatible.",
      );
    if (!campos.some((c) => c.Field === "pago_requerido"))
      await conexion.query(
        "ALTER TABLE pedidos ADD pago_requerido TINYINT(1) NOT NULL DEFAULT 0",
      );
    const [envios] = await conexion.query("SHOW COLUMNS FROM envios");
    if (
      envios.some(
        (c) =>
          ["direccion", "repartidor_id", "repartidor_nombre"].includes(
            c.Field,
          ) && c.Null === "NO",
      )
    )
      await conexion.query(
        "ALTER TABLE envios MODIFY direccion VARCHAR(300) NULL, MODIFY repartidor_id VARCHAR(200) NULL, MODIFY repartidor_nombre VARCHAR(80) NULL",
      );
    for (const sentencia of sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await conexion.query(sentencia);
    // Las tarifas del negocio las configura el admin; no se inventa un precio de delivery.
    for (const [codigo, nombre, direccion, repartidor, costo] of [
      ["moto_propia", "Moto propia", 1, 1, null],
      ["cadeteria", "Cadetería externa", 1, 0, null],
      ["retiro_local", "Retiro en local", 0, 0, "0.00"],
    ])
      await conexion.query(
        "INSERT IGNORE INTO modalidades_envio (codigo,nombre,requiere_direccion,requiere_repartidor,costo) VALUES (?,?,?,?,?)",
        [codigo, nombre, direccion, repartidor, costo],
      );
  } finally {
    conexion.release();
  }
}
if (process.argv[1]?.endsWith("migrate-envios-pagos.js")) {
  try {
    await migrarEnviosPagos();
    console.log("Migración de modalidades y pagos completada.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
