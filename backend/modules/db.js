import mysql from "mysql2/promise";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { opcionesSsl } from "./conexion-ssl.js";

const archivoEnv = new URL("../.env", import.meta.url);
if (existsSync(archivoEnv)) process.loadEnvFile(fileURLToPath(archivoEnv));

const connection = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_DATABASE || "restaurante",
  ...opcionesSsl(),
});

// mysql2 escribe las fechas de Node en hora local. Cada conexión usa el mismo huso,
// así NOW() (sesiones) coincide aunque el servidor SQL del hosting esté en UTC.
// En el hosting se define TZ=America/Argentina/Buenos_Aires para ver la hora local.
export function husoNode(fecha = new Date()) {
  const minutos = -fecha.getTimezoneOffset();
  const signo = minutos < 0 ? "-" : "+";
  const abs = Math.abs(minutos);
  return `${signo}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}
connection.pool.on("connection", (conexion) => {
  // Se encola antes de la primera consulta de esa conexión.
  conexion.query("SET time_zone = ?", [husoNode()], () => {});
});

export default connection;
