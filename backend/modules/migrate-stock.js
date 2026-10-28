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
    columnas: {
      id_comida: "int",
      id_stock: "int",
      cantidad_requerida: "decimal(12,3)",
    },
    // Las bases anteriores tienen la tabla sin la cantidad: se agrega sin tocar filas.
    agregadas: {
      cantidad_requerida: {
        columna: "DECIMAL(12,3) NOT NULL DEFAULT 1",
        check: "cantidad_requerida > 0",
        nombreCheck: "comida_stock_cantidad_check",
      },
    },
    primaria: ["id_comida", "id_stock"],
    referencias: [
      ["id_comida", "comidas", "id_comida"],
      ["id_stock", "Stock", "id_stock"],
    ],
    checks: ["cantidad_requerida > 0"],
  },
  movimientos_stock: {
    columnas: {
      id_movimiento: "int",
      id_stock: "int",
      id_pedido: "int",
      tipo: "varchar(20)",
      cantidad: "decimal(12,3)",
      id_usuario: "int",
      creado_en: "datetime(3)",
    },
    nulables: ["id_pedido", "id_usuario"],
    primaria: ["id_movimiento"],
    autoincremento: "id_movimiento",
    referencias: [
      ["id_stock", "Stock", "id_stock"],
      ["id_pedido", "pedidos", "id_pedidos"],
      ["id_usuario", "usuarios", "id_usuario", "SET NULL"],
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

// previa=true: antes de migrar se aceptan tablas a las que todavía les faltan
// las columnas "agregadas" (versión anterior del inventario).
async function validarTabla(conexion, tabla, esperado, actual, previa = false) {
  const error = `${tabla} existe con una estructura incompatible; no se modificó. Revisá sus columnas, claves y restricciones.`;
  const faltantes = previa
    ? Object.keys(esperado.agregadas ?? {}).filter(
        (nombre) => !actual.columnas.some((campo) => campo.Field === nombre),
      )
    : [];
  const columnas = Object.entries(esperado.columnas).filter(
    ([nombre]) => !faltantes.includes(nombre),
  );
  comprobar(actual.columnas.length === columnas.length, error);
  for (const [nombre, tipo] of columnas) {
    const columna = actual.columnas.find((campo) => campo.Field === nombre);
    comprobar(
      columna &&
        normalizarTipo(columna.Type) === tipo &&
        columna.Null === (esperado.nulables?.includes(nombre) ? "YES" : "NO"),
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
  for (const [columna, padre, clave, alBorrar] of esperado.referencias) {
    comprobar(
      referencias.some(
        (fk) =>
          fk.COLUMN_NAME === columna &&
          fk.REFERENCED_TABLE_NAME.toLowerCase() === padre.toLowerCase() &&
          fk.REFERENCED_COLUMN_NAME === clave &&
          fk.REFERENCED_TABLE_SCHEMA === base &&
          (alBorrar
            ? fk.DELETE_RULE === alBorrar
            : ["RESTRICT", "NO ACTION"].includes(fk.DELETE_RULE)) &&
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
    esperado.checks
      .filter((clausula) => !faltantes.some((nombre) => clausula.includes(nombre)))
      .every((clausula) =>
      checks.some(
        (check) =>
          normalizarCheck(check.CHECK_CLAUSE) === normalizarCheck(clausula),
      ),
    ),
    error,
  );
}

/**
 * Crea las tablas de inventario que falten y agrega la cantidad por receta a
 * comida_stock. No borra ni modifica filas existentes.
 */
export async function migrarStock(pool = db) {
  const conexion = await pool.getConnection();
  try {
    for (const [tabla, clave] of [
      ["comidas", "id_comida"],
      ["pedidos", "id_pedidos"],
      ["usuarios", "id_usuario"],
    ]) {
      const padre = await inspeccionar(conexion, tabla);
      comprobar(
        padre &&
          padre.columnas.some(
            (campo) =>
              campo.Field === clave &&
              normalizarTipo(campo.Type) === "int" &&
              campo.Null === "NO",
          ) &&
          JSON.stringify(padre.primaria) === JSON.stringify([clave]),
        `se requiere ${tabla}.${clave} INT con clave primaria en la misma base.`,
      );
    }
    // Validar TODO antes del primer CREATE evita ocultar tablas incompatibles.
    const anteriores = {};
    for (const [tabla, esperado] of Object.entries(tablas)) {
      const actual = await inspeccionar(conexion, tabla);
      if (actual) await validarTabla(conexion, tabla, esperado, actual, true);
      anteriores[tabla] = actual;
    }
    for (const [tabla, esperado] of Object.entries(tablas)) {
      const actual = anteriores[tabla];
      for (const [nombre, agregada] of Object.entries(esperado.agregadas ?? {}))
        if (actual && !actual.columnas.some((campo) => campo.Field === nombre))
          await conexion.query(
            `ALTER TABLE ?? ADD COLUMN ${nombre} ${agregada.columna}, ADD CONSTRAINT ${agregada.nombreCheck} CHECK (${agregada.check})`,
            [actual.nombre],
          );
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
