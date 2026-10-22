import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { hashClave } from "../modules/autenticacion.js";

export async function crearClientes(base, db) {
  const password = randomBytes(20).toString("base64url");
  const hash = await hashClave(password);
  const usuarios = {};
  const cookies = {};
  for (const role of [
    "admin",
    "mozo",
    "chef",
    "repartidor",
    "otro_repartidor",
  ]) {
    const username = `test_${role}`;
    const [result] = await db.query(
      "INSERT INTO usuarios (usuario,nombre,tipo,password_hash) VALUES (?,?,?,?)",
      [username, role, role === "otro_repartidor" ? "repartidor" : role, hash],
    );
    usuarios[role] = { id: String(result.insertId), username, password };
    const response = await fetch(base + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Nacar-Request": "1" },
      body: JSON.stringify({ username, password }),
    });
    assert.equal(response.status, 200, await response.clone().text());
    cookies[role] = response.headers.get("set-cookie").split(";")[0];
  }
  return { usuarios, cookies, password };
}
export function rolSolicitud(method, path, body) {
  if (path.startsWith("/envios") && path !== "/envios") return "repartidor";
  if (path.endsWith("/prioridad")) return "chef";
  if (path === "/pedidos" && method === "POST") return "mozo";
  if (path.endsWith("/estado"))
    return body?.estado === "entregado"
      ? "mozo"
      : body?.estado === "cancelado"
        ? "admin"
        : "chef";
  return "admin";
}
