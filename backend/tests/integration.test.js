import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import db from "../modules/db.js";

// Copia solo la estructura operativa. No lee usuarios ni copia datos reales.
test("API y migración con MySQL en una base aislada", async () => {
  const nombre = `codex_restaurante_test_${randomBytes(6).toString("hex")}`;
  assert.match(nombre, /^codex_restaurante_test_[a-f0-9]+$/);
  const conexion = await db.getConnection();
  const original = conexion.config.database;
  try {
    await conexion.query("CREATE DATABASE ??", [nombre]);
    for (const tabla of [
      "mesas",
      "comidas",
      "pedidos",
      "pedidos_comida",
      "resumenes",
      "resumen_comida",
    ]) {
      const [[fila]] = await conexion.query(`SHOW CREATE TABLE ${tabla}`);
      // No se incluye la FK de usuarios: se prueba la exclusión pedida.
      const sql = fila["Create Table"]
        .split("\n")
        .filter((linea) => !/CONSTRAINT.*REFERENCES `usuarios`/.test(linea))
        .join("\n")
        .replace(/,\n\)/g, "\n)");
      await conexion.query(`USE \`${nombre}\``);
      await conexion.query(sql);
      // SHOW CREATE de la próxima tabla debe consultar la base original.
      await conexion.query("USE ??", [original]);
    }
    const code = await new Promise((resolve, reject) => {
      const proceso = spawn(process.execPath, ["tests/scenario.js"], {
        cwd: process.cwd(),
        env: { ...process.env, DB_DATABASE: nombre },
        stdio: "inherit",
      });
      proceso.on("error", reject);
      proceso.on("exit", resolve);
    });
    assert.equal(code, 0);
  } finally {
    await conexion.query("USE ??", [original]);
    await conexion.query("DROP DATABASE IF EXISTS ??", [nombre]);
    conexion.release();
    await db.end();
  }
});
