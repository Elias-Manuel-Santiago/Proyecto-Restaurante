import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mysql from "mysql2/promise";
import db from "../modules/db.js";
import { hashClave } from "../modules/autenticacion.js";
import { asegurarConfiguracion } from "../modules/preparar-equipo.js";

async function ejecutar(args, env) {
  const hijo = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let salida = "";
  hijo.stdout.on("data", (datos) => {
    salida += datos;
  });
  hijo.stderr.on("data", (datos) => {
    salida += datos;
  });
  const codigo = await new Promise((resolve, reject) => {
    hijo.once("error", reject);
    hijo.once("exit", resolve);
  });
  assert.equal(codigo, 0, salida);
  return salida;
}

test("preparación del equipo: instalación vacía, actualización con datos y cinco cuentas reales", async () => {
  const carpeta = await mkdtemp(join(tmpdir(), "nacar-equipo-"));
  const archivo = join(carpeta, ".env");
  // Claves aleatorias de esta prueba: no depende de archivos locales con secretos.
  const archivoAccesos = join(carpeta, "accesos.json");
  const archivoMp = join(carpeta, "mercadopago.json");
  const clave = () => randomBytes(18).toString("base64url");
  await writeFile(
    archivoAccesos,
    JSON.stringify({
      ADMIN_USERNAME: "elias",
      ADMIN_NAME: "Elías Manuel Santiago",
      ADMIN_PASSWORD: clave(),
      SEED_PASSWORD_MARTIN: clave(),
      SEED_PASSWORD_LAUREANO: clave(),
      SEED_PASSWORD_SANTIAGO: clave(),
      SEED_PASSWORD_NEHUEN: clave(),
    }),
  );
  await writeFile(
    archivoMp,
    JSON.stringify({
      access_token: `TEST-${clave()}`,
      vendedor_id: "100",
      compradores_ids: ["200", "300"],
    }),
  );
  const administrador = await db.getConnection();
  const plantilla = await readFile(
    new URL("../.env.example", import.meta.url),
    "utf8",
  );
  const sql = await readFile(
    new URL("../../frontend/database/restaurante.sql", import.meta.url),
    "utf8",
  );
  // Reproduce la instalación de 12 tablas anterior al incremento de pagos.
  const anterior = sql
    .replace(
      /CREATE TABLE (modalidades_envio|envio_modalidad|pagos) \([\s\S]*?ENGINE=InnoDB[^;]*;/g,
      "",
    )
    .replace(/^  pago_requerido .*\n/m, "");
  try {
    await asegurarConfiguracion(archivo);
    await writeFile(
      archivo,
      "# conexión del integrante\nDB_DATABASE=preservar_configuracion\n",
    );
    await asegurarConfiguracion(archivo);
    assert.equal(
      await readFile(archivo, "utf8"),
      "# conexión del integrante\nDB_DATABASE=preservar_configuracion\n",
    );
    for (const existente of [false, true]) {
      const nombre = `codex_restaurante_test_${randomBytes(6).toString("hex")}`;
      let aislada;
      const claveAnterior = randomBytes(18).toString("base64url");
      let hashAnterior;
      try {
        if (existente) {
          await administrador.query("CREATE DATABASE ??", [nombre]);
          aislada = await mysql.createConnection({
            host: process.env.DB_HOST || "127.0.0.1",
            port: Number(process.env.DB_PORT || 3306),
            user: process.env.DB_USER || "root",
            password: process.env.DB_PASSWORD || "",
            database: nombre,
          });
          for (const sentencia of anterior
            .replace(/^\s*--.*$/gm, "")
            .split(";")
            .map((s) => s.trim())
            .filter(Boolean))
            await aislada.query(sentencia);
          hashAnterior = await hashClave(claveAnterior);
          await aislada.query(
            "INSERT INTO usuarios (usuario,nombre,tipo,password_hash) VALUES ('elias','Admin existente','admin',?)",
            [hashAnterior],
          );
          await aislada.query(
            "INSERT INTO mesas (numero,cantidad_personas) VALUES (22,4)",
          );
          await aislada.query(
            "INSERT INTO comidas (tipo,nombre,descripcion,precio) VALUES ('Principales','Plato conservado','',500)",
          );
          await aislada.query(
            "INSERT INTO pedidos (id_mesa,estado) VALUES (1,'entregado')",
          );
          await aislada.query(
            "INSERT INTO pedidos_comida (id_pedido,id_comida,cantidad,precio_unitario,nombre_comida) VALUES (1,1,2,500,'Plato conservado')",
          );
          await aislada.end();
          aislada = null;
        }
        await writeFile(
          archivo,
          plantilla.replace(/^DB_DATABASE=.*$/m, `DB_DATABASE=${nombre}`),
        );
        const env = {
          ...process.env,
          NODE_ENV: "test",
          DB_DATABASE: nombre,
          NACAR_ENV_FILE: archivo,
          NACAR_ACCESOS_FILE: archivoAccesos,
          NACAR_MP_FILE: archivoMp,
          ...(existente ? { TEST_ADMIN_PASSWORD: claveAnterior } : {}),
        };
        // Solo se sustituye la prevalidación HTTP de la credencial de prueba.
        // El SQL, el instalador, las migraciones, los hashes y la API son reales.
        const codigo = `import {readFile} from 'node:fs/promises'; const datos=JSON.parse(await readFile(process.env.NACAR_MP_FILE,'utf8')); globalThis.fetch=async(url)=>{if(url!=='https://api.mercadopago.com/users/me')throw Error('Solicitud inesperada');return {ok:true,json:async()=>({id:datos.vendedor_id,tags:['test_user']})}}; const {prepararEquipo}=await import('./modules/preparar-equipo.js'); await prepararEquipo();`;
        await ejecutar(["--input-type=module", "-e", codigo], env);
        await ejecutar(["--input-type=module", "-e", codigo], env);
        aislada = await mysql.createConnection({
          host: process.env.DB_HOST || "127.0.0.1",
          port: Number(process.env.DB_PORT || 3306),
          user: process.env.DB_USER || "root",
          password: process.env.DB_PASSWORD || "",
          database: nombre,
        });
        const [tablas] = await aislada.query("SHOW TABLES");
        assert.equal(tablas.length, 15);
        const [[{ total }]] = await aislada.query(
          "SELECT COUNT(*) AS total FROM usuarios",
        );
        assert.equal(total, 5, "Repetir no duplica usuarios");
        if (existente) {
          const [[cuenta]] = await aislada.query(
            "SELECT nombre,password_hash FROM usuarios WHERE usuario='elias'",
          );
          assert.equal(cuenta.nombre, "Admin existente");
          assert.equal(cuenta.password_hash, hashAnterior);
          const [[pedido]] = await aislada.query(
            "SELECT estado,pago_requerido FROM pedidos WHERE id_pedidos=1",
          );
          assert.equal(pedido.estado, "entregado");
          assert.equal(pedido.pago_requerido, 0);
          const [[item]] = await aislada.query(
            "SELECT cantidad,precio_unitario FROM pedidos_comida WHERE id_pedido=1",
          );
          assert.equal(item.cantidad, 2);
          assert.equal(item.precio_unitario, "500.00");
        }
        const contenido = await readFile(archivo, "utf8");
        assert.ok(contenido.includes(`DB_DATABASE=${nombre}`));
        assert.match(contenido, /^MP_TEST_BUYER_IDS=\d+,\d+$/m);
        await ejecutar(["tests/equipo-scenario.js"], env);
      } finally {
        if (aislada) await aislada.end();
        await administrador.query("DROP DATABASE IF EXISTS ??", [nombre]);
      }
    }
  } finally {
    administrador.release();
    await db.end();
    assert.ok(carpeta.startsWith(join(tmpdir(), "nacar-equipo-")));
    await rm(carpeta, { recursive: true, force: true });
  }
});
