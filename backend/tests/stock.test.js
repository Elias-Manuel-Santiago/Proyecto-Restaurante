import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { migrarStock } from "../modules/migrate-stock.js";
import db from "../modules/db.js";

const sentencias = (sql) =>
  sql
    .replaceAll("\r\n", "\n")
    .replace(/^\s*--.*$/gm, "")
    .split(";")
    .map((sentencia) => sentencia.trim())
    .filter(Boolean);

test("inventario: migración aditiva, repetible, restricciones y compatibilidad", async () => {
  const nombre = `codex_restaurante_test_${randomBytes(6).toString("hex")}`;
  assert.match(nombre, /^codex_restaurante_test_[a-f0-9]+$/);
  // Misma conexión que el resto de las pruebas (.env o variables del entorno).
  const acceso = {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
  };
  const conexion = await mysql.createConnection(acceso);
  let pool;
  let creada = false;
  try {
    await conexion.query(
      "CREATE DATABASE ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      [nombre],
    );
    creada = true;
    await conexion.query("USE ??", [nombre]);
    pool = mysql.createPool({ ...acceso, database: nombre });
    const esquema = sentencias(
      await readFile(
        new URL("../../frontend/database/restaurante.sql", import.meta.url),
        "utf8",
      ),
    );
    const sqlInventario = sentencias(
      await readFile(
        new URL("../../frontend/database/inventario.sql", import.meta.url),
        "utf8",
      ),
    );
    const nuevas = esquema.filter((sql) =>
      /^CREATE TABLE (Unidades|Stock|comida_stock)\b/.test(sql),
    );
    assert.deepEqual(
      nuevas,
      sqlInventario.map((sql) => sql.replace(" IF NOT EXISTS", "")),
      "La instalación nueva y la migración deben crear el mismo inventario",
    );
    for (const sql of esquema.filter(
      (sql) =>
        !nuevas.includes(sql) &&
        !/^CREATE TABLE (envios|modalidades_envio|envio_modalidad|pagos)\b/.test(
          sql,
        ),
    ))
      await conexion.query(sql);
    const [antes] = await conexion.query("SHOW TABLES");
    assert.equal(antes.length, 8);
    const definiciones = await Promise.all(
      antes.map(async (fila) => {
        const tabla = Object.values(fila)[0];
        const [[definicion]] = await conexion.query("SHOW CREATE TABLE ??", [
          tabla,
        ]);
        return definicion["Create Table"].replace(/ AUTO_INCREMENT=\d+/g, "");
      }),
    );
    const [plato] = await conexion.query(
      "INSERT INTO comidas (tipo,nombre,descripcion,precio) VALUES (?,?,?,?)",
      ["Principales", "Milanesa", "Plato anterior a inventario", 1000],
    );
    const [[comidaAnterior]] = await conexion.query(
      "SELECT * FROM comidas WHERE id_comida=?",
      [plato.insertId],
    );
    await migrarStock(pool);
    assert.equal((await conexion.query("SHOW TABLES"))[0].length, 11);
    const [unidad] = await conexion.query(
      "INSERT INTO Unidades (nombre) VALUES (?)",
      ["Kilogramo"],
    );
    const [stock] = await conexion.query(
      "INSERT INTO Stock (nombre,cantidad,id_unidad) VALUES (?,?,?)",
      ["Carne", "2.750", unidad.insertId],
    );
    await conexion.query(
      "INSERT INTO comida_stock (id_comida,id_stock) VALUES (?,?)",
      [plato.insertId, stock.insertId],
    );
    await migrarStock(pool);
    const [[insumo]] = await conexion.query(
      "SELECT * FROM Stock WHERE id_stock=?",
      [stock.insertId],
    );
    assert.equal(insumo.cantidad, "2.750");
    assert.deepEqual((await conexion.query("SELECT * FROM comida_stock"))[0], [
      { id_comida: plato.insertId, id_stock: stock.insertId },
    ]);
    assert.deepEqual(
      (
        await conexion.query("SELECT * FROM comidas WHERE id_comida=?", [
          plato.insertId,
        ])
      )[0][0],
      comidaAnterior,
    );
    for (let i = 0; i < antes.length; i++) {
      const [[actual]] = await conexion.query("SHOW CREATE TABLE ??", [
        Object.values(antes[i])[0],
      ]);
      assert.equal(
        actual["Create Table"].replace(/ AUTO_INCREMENT=\d+/g, ""),
        definiciones[i],
        "Las ocho estructuras anteriores se conservan",
      );
    }
    const rechazar = async (sql, valores, codigo) =>
      assert.rejects(
        conexion.query(sql, valores),
        (error) => error.code === codigo,
      );
    await rechazar(
      "INSERT INTO comida_stock (id_comida,id_stock) VALUES (?,?)",
      [plato.insertId, stock.insertId],
      "ER_DUP_ENTRY",
    );
    for (const valores of [
      [2147483647, stock.insertId],
      [plato.insertId, 2147483647],
    ])
      await rechazar(
        "INSERT INTO comida_stock (id_comida,id_stock) VALUES (?,?)",
        valores,
        "ER_NO_REFERENCED_ROW_2",
      );
    await rechazar(
      "INSERT INTO Stock (nombre,id_unidad) VALUES (?,?)",
      ["Sin unidad", 2147483647],
      "ER_NO_REFERENCED_ROW_2",
    );
    // MySQL y MariaDB asignan códigos distintos a violaciones CHECK.
    for (const [sql, valores] of [
      ["UPDATE Stock SET cantidad=? WHERE id_stock=?", [-1, stock.insertId]],
      ["INSERT INTO Unidades (nombre) VALUES (?)", ["   "]],
      [
        "INSERT INTO Stock (nombre,id_unidad) VALUES (?,?)",
        ["", unidad.insertId],
      ],
    ])
      await assert.rejects(conexion.query(sql, valores), (error) =>
        [3819, 4025].includes(error.errno),
      );
    for (const [tabla, campo, id] of [
      ["Unidades", "id_unidad", unidad.insertId],
      ["Stock", "id_stock", stock.insertId],
      ["comidas", "id_comida", plato.insertId],
    ])
      await rechazar(
        "DELETE FROM ?? WHERE ??=?",
        [tabla, campo, id],
        "ER_ROW_IS_REFERENCED_2",
      );
    await conexion.query("UPDATE Stock SET cantidad=0 WHERE id_stock=?", [
      stock.insertId,
    ]);
    // El vínculo guarda composición, no descuenta existencias ni crea otra comida.
    assert.equal(
      (await conexion.query("SELECT cantidad FROM Stock"))[0][0].cantidad,
      "0.000",
    );
    await conexion.query("DELETE FROM comida_stock");
    await conexion.query("DROP TABLE comida_stock");
    await conexion.query(
      "ALTER TABLE Stock MODIFY cantidad INT NOT NULL DEFAULT 0",
    );
    await assert.rejects(
      migrarStock(pool),
      /Stock existe con una estructura incompatible/,
    );
    assert.equal(
      (await conexion.query("SHOW TABLES"))[0].length,
      10,
      "Rechaza la incompatibilidad antes de crear la tabla faltante",
    );
    assert.equal(
      (await conexion.query("SELECT nombre FROM Stock"))[0][0].nombre,
      "Carne",
    );
  } finally {
    if (pool) await pool.end();
    if (creada) await conexion.query("DROP DATABASE ??", [nombre]);
    await conexion.end();
    await db.end();
  }
});
