import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import mysql from "mysql2/promise";
import db from "../modules/db.js";
import { migrarEnviosPagos } from "../modules/migrate-envios-pagos.js";

test("envíos/pagos: conserva históricos y tarifas; rechaza estructuras incompatibles", async () => {
  const nombre = `codex_restaurante_test_${randomBytes(6).toString("hex")}`;
  const conexion = await db.getConnection();
  let aislada;
  try {
    await conexion.query("CREATE DATABASE ??", [nombre]);
    aislada = mysql.createPool({
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: nombre,
    });
    await aislada.query(
      "CREATE TABLE pedidos (id_pedidos INT PRIMARY KEY, estado VARCHAR(30) NOT NULL) ENGINE=InnoDB",
    );
    await aislada.query(
      "CREATE TABLE envios (id_pedido INT PRIMARY KEY,direccion VARCHAR(300) NOT NULL,repartidor_id VARCHAR(200) NOT NULL,repartidor_nombre VARCHAR(80) NOT NULL) ENGINE=InnoDB",
    );
    await aislada.query("INSERT INTO pedidos VALUES (1,'pendiente')");
    await aislada.query(
      "INSERT INTO envios VALUES (1,'Dirección histórica','42','Repartidor histórico')",
    );
    await migrarEnviosPagos(aislada);
    await aislada.query(
      "UPDATE modalidades_envio SET costo=432.10 WHERE codigo='moto_propia'",
    );
    await migrarEnviosPagos(aislada);
    const [[pedido]] = await aislada.query(
      "SELECT * FROM pedidos WHERE id_pedidos=1",
    );
    assert.equal(
      pedido.pago_requerido,
      0,
      "No exige un pago nuevo al pedido histórico",
    );
    const [[envio]] = await aislada.query(
      "SELECT * FROM envios WHERE id_pedido=1",
    );
    assert.equal(envio.direccion, "Dirección histórica");
    assert.equal(envio.repartidor_id, "42");
    const [[modo]] = await aislada.query(
      "SELECT costo FROM modalidades_envio WHERE codigo='moto_propia'",
    );
    assert.equal(modo.costo, "432.10");
    const [[{ total }]] = await aislada.query(
      "SELECT COUNT(*) AS total FROM modalidades_envio",
    );
    assert.equal(total, 3);
    await aislada.query("ALTER TABLE pagos DROP COLUMN metodo");
    await assert.rejects(
      migrarEnviosPagos(aislada),
      /pagos tiene una estructura incompatible/,
    );
    const [[conservado]] = await aislada.query(
      "SELECT direccion FROM envios WHERE id_pedido=1",
    );
    assert.equal(conservado.direccion, envio.direccion);
  } finally {
    if (aislada) await aislada.end();
    await conexion.query("DROP DATABASE IF EXISTS ??", [nombre]);
    conexion.release();
    await db.end();
  }
});
