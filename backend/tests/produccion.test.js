import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { husoNode } from "../modules/db.js";
import db from "../modules/db.js";

// Proceso aparte: NODE_ENV=production se lee al importar app.js.
const escenario = `
import assert from "node:assert/strict";
import { app } from "./app.js";
import db from "./modules/db.js";
const servidor = app.listen(0, "127.0.0.1");
await new Promise((r) => servidor.once("listening", r));
const base = "http://127.0.0.1:" + servidor.address().port;
try {
  for (const ruta of ["/", "/mesas", "/pedidos/historial"]) {
    const res = await fetch(base + ruta);
    assert.equal(res.status, 200, ruta);
    assert.match(await res.text(), /id="root"/);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.ok(res.headers.get("strict-transport-security"));
    assert.equal(res.headers.get("x-powered-by"), null);
  }
  // /api nunca cae en index.html.
  const api = await fetch(base + "/api/auth/session");
  assert.equal(api.status, 401);
  assert.match(api.headers.get("content-type"), /json/);
  // Detrás del proxy HTTPS el origen propio se acepta; uno ajeno no.
  const escribir = (origin) =>
    fetch(base + "/api/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Nacar-Request": "1",
        "X-Forwarded-Proto": "https",
        Origin: origin,
      },
      body: "{}",
    });
  const propio = "https://127.0.0.1:" + servidor.address().port;
  assert.equal((await escribir(propio)).status, 200);
  assert.equal((await escribir("https://otro.example.test")).status, 403);
  console.log("Producción: frontend en el mismo origen, cabeceras y proxy HTTPS.");
} finally {
  await new Promise((r) => servidor.close(r));
  await db.end();
}
`;

test("producción: Express sirve el frontend, cabeceras de seguridad y proxy HTTPS", async () => {
  const dist = await mkdtemp(join(tmpdir(), "nacar-dist-"));
  try {
    await writeFile(
      join(dist, "index.html"),
      '<!doctype html><div id="root"></div>',
    );
    const hijo = spawn(
      process.execPath,
      ["--input-type=module", "-e", escenario],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: "production",
          FRONTEND_DIST: dist,
          FRONTEND_ORIGIN: "https://nacar.example.test",
        },
        stdio: ["ignore", "inherit", "inherit"],
      },
    );
    const codigo = await new Promise((resolve, reject) => {
      hijo.once("error", reject);
      hijo.once("exit", resolve);
    });
    assert.equal(codigo, 0);
  } finally {
    await rm(dist, { recursive: true, force: true });
    await db.end();
  }
});

test("huso horario: formato de desplazamiento para la sesión SQL", () => {
  const conDesplazamiento = (minutos) => ({ getTimezoneOffset: () => minutos });
  assert.equal(husoNode(conDesplazamiento(180)), "-03:00");
  assert.equal(husoNode(conDesplazamiento(0)), "+00:00");
  assert.equal(husoNode(conDesplazamiento(-330)), "+05:30");
});
