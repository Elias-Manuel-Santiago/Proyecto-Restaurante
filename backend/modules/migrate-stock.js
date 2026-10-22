import { readFile } from "node:fs/promises";
import db from "./db.js";

const tablas = {
  Unidades: {
    columnas: { id_unidad: "int", nombre: "varchar(100)" },
    primaria: ["id_unidad"],
    autoincremento: "id_unidad",
    referencias: [],
    checks: ["char_length(trim(nombre)) > 0"],
  },
  Stock: {
    columnas: {
      id_stock: "int",
      nombre: "varchar(100)",
      cantidad: "decimal(12,3)",
      id_unidad: "int",
    },
    primaria: ["id_stock"],
    autoincremento: "id_stock",
    referencias: [["id_unidad", "Unidades", "id_unidad"]],
    checks: ["char_length(trim(nombre)) > 0", "cantidad >= 0"],
  },
  comida_stock: {
    columnas: { id_comida: "int", id_stock: "int" },
    primaria: ["id_comida", "id_stock"],
    referencias: [
      ["id_comida", "comidas", "id_comida"],
      ["id_stock", "Stock", "id_stock"],
    ],
    checks: [],
  },
};

function comprobar(condicion, mensaje) {
  if (!condicion) throw new Error(`Inventario: ${mensaje}`);
}
const normalizarTipo = (tipo) =>
  tipo.toLowerCase().replace(/^int\(\d+\)/, "int");
const normalizarCheck = (expresion) =>
  expresion.toLowerCase().replace(/[`\s()]/g, "");

async function inspeccionar(conexion, tabla) {
  const [[datos]] = await conexion.query(
    "SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [tabla],
  );
  if (!datos) return null;
  comprobar(datos.ENGINE === "InnoDB", `${tabla} debe usar InnoDB.`);
  // Se usa el nombre devuelto por el motor, que Windows puede guardar en minúsculas.
  const [columnas] = await conexion.query("SHOW COLUMNS FROM ??", [
    datos.TABLE_NAME,
  ]);
  const [indices] = await conexion.query("SHOW INDEX FROM ??", [
    datos.TABLE_NAME,
  ]);
  const primaria = indices
    .filter((indice) => indice.Key_name === "PRIMARY")
    .sort((a, b) => a.Seq_in_index - b.Seq_in_index)
    .map((indice) => indice.Column_name);
  return { nombre: datos.TABLE_NAME, columnas, primaria };
}

async function validarTabla(conexion, tabla, esperado, actual) {
  const error = `${tabla} existe con una estructura incompatible; no se modificó. Revisá sus columnas, claves y restricciones.`;
  comprobar(
    actual.columnas.length === Object.keys(esperado.columnas).length,
    error,
  );
  for (const [nombre, tipo] of Object.entries(esperado.columnas)) {
    const columna = actual.columnas.find((campo) => campo.Field === nombre);
    comprobar(
      columna && normalizarTipo(columna.Type) === tipo && columna.Null === "NO",
      error,
    );
    comprobar(
      Boolean(columna.Extra.includes("auto_increment")) ===
        (nombre === esperado.autoincremento),
      error,
    );
  }
  comprobar(
    JSON.stringify(actual.primaria) === JSON.stringify(esperado.primaria),
    error,
  );
  const [referencias] = await conexion.query(
    `SELECT k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME,
      k.REFERENCED_TABLE_SCHEMA, r.DELETE_RULE, r.UPDATE_RULE
    FROM information_schema.KEY_COLUMN_USAGE k
    JOIN information_schema.REFERENTIAL_CONSTRAINTS r
      ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME
      AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME
    WHERE k.TABLE_SCHEMA=DATABASE() AND k.TABLE_NAME=? AND k.REFERENCED_TABLE_NAME IS NOT NULL`,
    [actual.nombre],
  );
  const [[{ base }]] = await conexion.query("SELECT DATABASE() AS base");
  comprobar(referencias.length === esperado.referencias.length, error);
  for (const [columna, padre, clave] of esperado.referencias) {
    comprobar(
      referencias.some(
        (fk) =>
          fk.COLUMN_NAME === columna &&
          fk.REFERENCED_TABLE_NAME.toLowerCase() === padre.toLowerCase() &&
          fk.REFERENCED_COLUMN_NAME === clave &&
          fk.REFERENCED_TABLE_SCHEMA === base &&
          ["RESTRICT", "NO ACTION"].includes(fk.DELETE_RULE) &&
          ["RESTRICT", "NO ACTION"].includes(fk.UPDATE_RULE),
      ),
      error,
    );
  }
  const [checks] = await conexion.query(
    `SELECT cc.CHECK_CLAUSE FROM information_schema.CHECK_CONSTRAINTS cc
    JOIN information_schema.TABLE_CONSTRAINTS tc
      ON tc.CONSTRAINT_SCHEMA=cc.CONSTRAINT_SCHEMA AND tc.CONSTRAINT_NAME=cc.CONSTRAINT_NAME
    WHERE tc.TABLE_SCHEMA=DATABASE() AND tc.TABLE_NAME=? AND tc.CONSTRAINT_TYPE='CHECK'`,
    [actual.nombre],
  );
  comprobar(
    esperado.checks.every((clausula) =>
      checks.some(
        (check) =>
          normalizarCheck(check.CHECK_CLAUSE) === normalizarCheck(clausula),
      ),
    ),
    error,
  );
}

/** Solo crea las tres tablas acordadas. No altera tablas ni datos existentes. */
export async function migrarStock(pool = db) {
  const conexion = await pool.getConnection();
  try {
    const comidas = await inspeccionar(conexion, "comidas");
    comprobar(
      comidas &&
        comidas.columnas.some(
          (campo) =>
            campo.Field === "id_comida" &&
            normalizarTipo(campo.Type) === "int" &&
            campo.Null === "NO",
        ) &&
        JSON.stringify(comidas.primaria) === '["id_comida"]',
      "se requiere comidas.id_comida INT con clave primaria en la misma base.",
    );
    // Validar TODO antes del primer CREATE evita ocultar tablas incompatibles.
    for (const [tabla, esperado] of Object.entries(tablas)) {
      const actual = await inspeccionar(conexion, tabla);
      if (actual) await validarTabla(conexion, tabla, esperado, actual);
    }
    const sql = await readFile(
      new URL("../../frontend/database/inventario.sql", import.meta.url),
      "utf8",
    );
    const sentencias = sql
      .replace(/^\s*--.*$/gm, "")
      .split(";")
      .map((sentencia) => sentencia.trim())
      .filter(Boolean);
    for (const sentencia of sentencias) await conexion.query(sentencia);
    for (const [tabla, esperado] of Object.entries(tablas)) {
      await validarTabla(
        conexion,
        tabla,
        esperado,
        await inspeccionar(conexion, tabla),
      );
    }
  } finally {
    conexion.release();
  }
}

if (process.argv[1]?.endsWith("migrate-stock.js")) {
  try {
    await migrarStock();
    console.log("Tablas de inventario verificadas y creadas.");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
