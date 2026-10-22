import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import db from "../modules/db.js";
import { app } from "../app.js";
import { cargarAccesosPruebas } from "../modules/seed-usuarios.js";

assert.match(process.env.DB_DATABASE, /^codex_restaurante_test_[a-f0-9]+$/);
const accesos = await cargarAccesosPruebas();
const servidor = app.listen(0, "127.0.0.1");
await new Promise((resolve) => servidor.once("listening", resolve));
const base = `http://127.0.0.1:${servidor.address().port}/api`;
const encabezados = {
  "Content-Type": "application/json",
  "X-Nacar-Request": "1",
};
try {
  for (const [usuario, rol] of [
    ["elias", "admin"],
    ["martin", "mozo"],
    ["laureano", "chef"],
    ["santiago", "repartidor"],
    ["nehuen", "mozo"],
  ]) {
    const password =
      usuario === "elias"
        ? process.env.TEST_ADMIN_PASSWORD || accesos.ADMIN_PASSWORD
        : accesos[`SEED_PASSWORD_${usuario.toUpperCase()}`];
    const login = await fetch(base + "/auth/login", {
      method: "POST",
      headers: encabezados,
      body: JSON.stringify({ username: usuario, password }),
    });
    assert.equal(login.status, 200, await login.clone().text());
    assert.equal((await login.json()).role, rol);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    for (let i = 0; i < 2; i++) {
      const sesion = await fetch(base + "/auth/session", {
        headers: { Cookie: cookie },
      });
      assert.equal(sesion.status, 200);
      assert.equal((await sesion.json()).username, usuario);
    }
    const listado = await fetch(base + "/usuarios", {
      headers: { Cookie: cookie },
    });
    assert.equal(listado.status, rol === "admin" ? 200 : 403);
    if (rol === "admin") {
      const alta = await fetch(base + "/usuarios", {
        method: "POST",
        headers: { ...encabezados, Cookie: cookie },
        body: JSON.stringify({
          username: "nuevo_del_admin",
          name: "Alta desde instalación nueva",
          role: "mozo",
          active: true,
          password: randomBytes(18).toString("base64url"),
        }),
      });
      assert.equal(alta.status, 201, await alta.clone().text());
      const cuenta = await alta.json();
      assert.ok(cuenta.id);
    }
    const salida = await fetch(base + "/auth/logout", {
      method: "POST",
      headers: { ...encabezados, Cookie: cookie },
      body: "{}",
    });
    assert.equal(salida.status, 200);
    assert.equal(
      (await fetch(base + "/auth/session", { headers: { Cookie: cookie } }))
        .status,
      401,
    );
  }
  console.log(
    "Cinco cuentas SQL: ingreso, roles, recuperación, permisos y logout; alta desde admin comprobada.",
  );
} finally {
  await new Promise((resolve) => servidor.close(resolve));
  await db.end();
}
