import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import db from "../modules/db.js";
import { migrarAutenticacion } from "../modules/migrate-auth.js";

test("acceso: migra el esquema anterior sin borrar cuentas, claves ni sesiones", async () => {
  const nombre = `codex_restaurante_test_${randomBytes(6).toString("hex")}`;
  const conexion = await db.getConnection();
  let pool;
  try {
    await conexion.query("CREATE DATABASE ??", [nombre]);
    pool = mysql.createPool({
      host: conexion.config.host,
      port: conexion.config.port,
      user: conexion.config.user,
      password: conexion.config.password,
      database: nombre,
    });
    const sql = await readFile(
      new URL("../../frontend/database/restaurante.sql", import.meta.url),
      "utf8",
    );
    for (const tabla of ["usuarios", "sesiones_usuarios"]) {
      const sentencia = sql
        .match(new RegExp(`CREATE TABLE ${tabla} \\([\\s\\S]*?;`))[0]
        .replace("'mozo','repartidor'", "'mozo'");
      await pool.query(sentencia);
    }
    const [u] = await pool.query(
      "INSERT INTO usuarios (usuario,nombre,tipo,password_hash) VALUES ('anterior','Cuenta anterior','admin','hash-anterior-no-se-reemplaza')",
    );
    await pool.query(
      "INSERT INTO sesiones_usuarios (id_usuario,token_hash,expira_en) VALUES (?,?,DATE_ADD(NOW(3),INTERVAL 1 DAY))",
      [u.insertId, "a".repeat(64)],
    );
    await migrarAutenticacion(pool);
    await migrarAutenticacion(pool);
    const [[usuario]] = await pool.query(
      "SELECT * FROM usuarios WHERE id_usuario=?",
      [u.insertId],
    );
    assert.equal(usuario.password_hash, "hash-anterior-no-se-reemplaza");
    assert.equal(usuario.nombre, "Cuenta anterior");
    assert.equal(
      (await pool.query("SELECT * FROM sesiones_usuarios"))[0].length,
      1,
    );
    await pool.query(
      "INSERT INTO usuarios (usuario,nombre,tipo,password_hash) VALUES ('repartidor','Repartidor','repartidor','hash-prueba')",
    );
    await assert.rejects(
      pool.query("UPDATE usuarios SET tipo='inexistente' WHERE id_usuario=?", [
        u.insertId,
      ]),
    );
    await assert.rejects(
      pool.query(
        "INSERT INTO usuarios (usuario,nombre,tipo,password_hash) VALUES ('anterior','Duplicado','mozo','hash')",
      ),
    );
  } finally {
    if (pool) await pool.end();
    await conexion.query("DROP DATABASE IF EXISTS ??", [nombre]);
    conexion.release();
    await db.end();
  }
});
