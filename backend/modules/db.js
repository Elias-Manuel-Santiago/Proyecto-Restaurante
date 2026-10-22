import mysql from "mysql2/promise";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const archivoEnv = new URL("../.env", import.meta.url);
if (existsSync(archivoEnv)) process.loadEnvFile(fileURLToPath(archivoEnv));

const connection = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_DATABASE || "restaurante",
});

export default connection;
