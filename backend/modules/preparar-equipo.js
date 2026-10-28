import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import mysql from "mysql2/promise";
import { configurarMercadoPagoPruebas } from "./configurar-mp-pruebas.js";
import { opcionesSsl } from "./conexion-ssl.js";

export async function asegurarConfiguracion(destino) {
  try {
    await writeFile(
      destino,
      await readFile(new URL("../.env.example", import.meta.url)),
      { flag: "wx" },
    );
    console.log("Se creó .env con la conexión local predeterminada de XAMPP.");
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}

// online=true (hosting): la configuración viene del panel, no hay .env ni claves de
// prueba del equipo. Solo instala o migra y crea el admin con ADMIN_PASSWORD.
export async function prepararEquipo({ online = false } = {}) {
  if (process.env.NODE_ENV === "production" && !online)
    throw new Error(
      "La preparación del equipo es solo para la presentación y pruebas.",
    );
  const destino =
    process.env.NACAR_ENV_FILE ||
    fileURLToPath(new URL("../.env", import.meta.url));
  if (!online) {
    await asegurarConfiguracion(destino);
    process.loadEnvFile(destino);
  }
  const base = process.env.DB_DATABASE || "restaurante";
  if (!/^[a-zA-Z0-9_]{1,64}$/.test(base))
    throw new Error("Revisá DB_DATABASE: usá letras, números y guiones bajos.");
  const conexion = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    ...opcionesSsl(),
  });
  let pool;
  try {
    console.log(
      `Preparando base SQL: ${process.env.DB_HOST || "127.0.0.1"}:${process.env.DB_PORT || 3306}/${base}.`,
    );
    await conexion.query(
      "CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      [base],
    );
    await conexion.query("USE ??", [base]);
    const [tablas] = await conexion.query("SHOW TABLES");
    const nombres = tablas.map((t) =>
      String(Object.values(t)[0]).toLowerCase(),
    );
    if (!nombres.length) {
      const sql = await readFile(
        new URL("../../frontend/database/restaurante.sql", import.meta.url),
        "utf8",
      );
      for (const sentencia of sql
        .replace(/^\s*--.*$/gm, "")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean))
        await conexion.query(sentencia);
      console.log("Base vacía: se instalaron las 15 tablas.");
    } else {
      const faltantes = [
        "mesas",
        "comidas",
        "pedidos",
        "pedidos_comida",
        "resumenes",
        "resumen_comida",
      ].filter((t) => !nombres.includes(t));
      if (faltantes.length)
        throw new Error(
          `La base contiene tablas pero falta la estructura del restaurante: ${faltantes.join(", ")}. No se importó el instalador encima de los datos.`,
        );
      console.log(
        "Base existente: se conservan los datos y se aplican las migraciones.",
      );
    }
    // Importar después de cargar .env: la conexión se crea con la base de esta PC.
    ({ default: pool } = await import("./db.js"));
    const { migrar } = await import("./migrate.js");
    const { sembrarUsuarios, cargarAccesosPruebas, leerEquipo } =
      await import("./seed-usuarios.js");
    await migrar();
    if (online) {
      const creados = await sembrarUsuarios();
      console.log(
        creados.length
          ? `Administrador creado: ${creados.join(", ")}. El resto del equipo se da de alta desde Equipo.`
          : "Base online lista; se conservaron las cuentas existentes.",
      );
      return;
    }
    const accesos = await cargarAccesosPruebas();
    const creados = await sembrarUsuarios({ incluirEquipo: true, env: accesos });
    console.log(
      creados.length
        ? `Cuentas creadas: ${creados.join(", ")}.`
        : "Las cuentas ya existían; se conservaron sus contraseñas.",
    );
    // Informa las cuentas conservadas: no promete que su clave coincida con el JSON.
    const [cuentas] = await pool.query(
      "SELECT usuario,tipo,activo FROM usuarios WHERE usuario IN (?) ORDER BY usuario",
      [
        [
          (accesos.ADMIN_USERNAME || "elias").trim().toLowerCase(),
          ...leerEquipo(accesos).map((u) => u.username),
        ],
      ],
    );
    for (const cuenta of cuentas)
      console.log(
        `${cuenta.usuario}: ${cuenta.tipo}, ${cuenta.activo ? "activo" : "inactivo"}${creados.includes(cuenta.usuario) ? ", acceso de prueba creado" : ", acceso existente conservado"}.`,
      );
    await configurarMercadoPagoPruebas({ destino });
    console.log(
      "Preparación completada. Iniciá backend con npm start y frontend con npm run dev.",
    );
  } finally {
    await conexion.end();
    if (pool) await pool.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  prepararEquipo({ online: process.argv.includes("--online") }).catch((error) => {
    console.error(`No se completó la preparación: ${error.message}`);
    process.exitCode = 1;
  });
}
