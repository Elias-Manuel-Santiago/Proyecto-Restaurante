import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { hashToken } from "../modules/autenticacion.js";
import { sembrarUsuarios } from "../modules/seed-usuarios.js";
import { guardarUsuario } from "../modules/usuarios.js";

export async function probarAuth(base, db, clientes) {
  const headers = {
    "Content-Type": "application/json",
    "X-Nacar-Request": "1",
  };
  const raw = async (
    path,
    { method = "GET", body, role, cookie, extra = {} } = {},
  ) =>
    fetch(base + path, {
      method,
      headers: {
        ...headers,
        ...(role ? { Cookie: clientes.cookies[role] } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  assert.equal((await raw("/auth/session")).status, 401);
  assert.equal((await raw("/pedidos/eventos")).status, 401);
  for (const body of [
    { username: "nadie", password: "no-existe" },
    { username: "test_admin", password: "incorrecta" },
    { username: "' OR 1=1 --", password: "incorrecta" },
  ]) {
    const rechazo = await raw("/auth/login", { method: "POST", body });
    assert.equal(rechazo.status, 401);
    assert.match(
      rechazo.headers.get("set-cookie") || "",
      /nacar_session=;/,
      "Un ingreso rechazado elimina la cookie de una sesión anterior",
    );
  }
  assert.equal(
    (
      await raw("/auth/login", {
        method: "POST",
        body: {},
        extra: { "X-Nacar-Request": "" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await raw("/usuarios", {
        method: "POST",
        role: "admin",
        body: {},
        extra: { Origin: "https://otro-sitio.test" },
      })
    ).status,
    403,
  );
  for (const role of ["mozo", "chef", "repartidor"])
    assert.equal((await raw("/usuarios", { role })).status, 403);
  assert.equal(
    (
      await raw("/resumenes/obtener", {
        method: "POST",
        role: "mozo",
        body: {},
      })
    ).status,
    403,
  );
  assert.equal(
    (await raw("/comidas", { method: "POST", role: "chef", body: {} })).status,
    403,
  );
  const session = await raw("/auth/session", { role: "admin" });
  const actual = await session.json();
  assert.equal(actual.role, "admin");
  assert.ok(!("password_hash" in actual));
  assert.equal(
    (await raw("/auth/session", { role: "admin" })).status,
    200,
    "Nueva solicitud restaura la sesión",
  );
  const perfil = {
    username: "cuenta_prueba",
    name: "Cuenta prueba",
    role: "mozo",
    active: true,
    password: randomBytes(18).toString("base64url"),
  };
  assert.equal(
    (
      await raw("/usuarios", {
        method: "POST",
        role: "admin",
        body: { ...perfil, password: "corta" },
      })
    ).status,
    400,
  );
  const alta = await raw("/usuarios", {
    method: "POST",
    role: "admin",
    body: perfil,
  });
  assert.equal(alta.status, 201);
  const u = await alta.json();
  assert.ok(!("password" in u));
  assert.equal(
    (await raw("/usuarios", { method: "POST", role: "admin", body: perfil }))
      .status,
    409,
  );
  const login = await raw("/auth/login", { method: "POST", body: perfil });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Expires=/i);
  const cookie = setCookie.split(";")[0];
  const [[guardada]] = await db.query(
    "SELECT * FROM sesiones_usuarios WHERE token_hash=?",
    [hashToken(cookie.split("=")[1])],
  );
  assert.ok(guardada);
  assert.notEqual(guardada.token_hash, cookie.split("=")[1]);
  const [[cuenta]] = await db.query(
    "SELECT password_hash FROM usuarios WHERE id_usuario=?",
    [u.id],
  );
  assert.match(cuenta.password_hash, /^\$argon2id\$/);
  assert.notEqual(cuenta.password_hash, perfil.password);
  assert.equal(
    (
      await raw(`/usuarios/${u.id}`, {
        method: "PUT",
        role: "admin",
        body: { ...perfil, password: undefined, name: "Nombre editado" },
      })
    ).status,
    200,
  );
  assert.equal(
    (await (await raw("/auth/session", { cookie })).json()).name,
    "Nombre editado",
  );
  assert.equal(
    (
      await raw(`/usuarios/${u.id}`, {
        method: "PUT",
        role: "admin",
        body: { ...perfil, active: false },
      })
    ).status,
    200,
  );
  assert.equal((await raw("/auth/session", { cookie })).status, 401);
  assert.equal(
    (await raw("/auth/login", { method: "POST", body: perfil })).status,
    401,
  );
  const nuevaClave = randomBytes(18).toString("base64url");
  await raw(`/usuarios/${u.id}`, {
    method: "PUT",
    role: "admin",
    body: { ...perfil, password: nuevaClave, active: true },
  });
  assert.equal(
    (await raw("/auth/login", { method: "POST", body: perfil })).status,
    401,
  );
  const reingreso = await raw("/auth/login", {
    method: "POST",
    body: { username: perfil.username, password: nuevaClave },
  });
  assert.equal(reingreso.status, 200);
  const cookieNueva = reingreso.headers.get("set-cookie").split(";")[0];
  await raw(`/usuarios/${u.id}`, {
    method: "PUT",
    role: "admin",
    body: { ...perfil, password: randomBytes(18).toString("base64url") },
  });
  assert.equal(
    (await raw("/auth/session", { cookie: cookieNueva })).status,
    401,
    "Cambiar clave revoca sesiones existentes",
  );
  const admin = clientes.usuarios.admin;
  for (const cambio of [
    { active: false, role: "admin" },
    { active: true, role: "mozo" },
  ])
    assert.equal(
      (
        await raw(`/usuarios/${admin.id}`, {
          method: "PUT",
          role: "admin",
          body: { username: admin.username, name: "Admin", ...cambio },
        })
      ).status,
      400,
    );
  const segundo = await (
    await raw("/usuarios", {
      method: "POST",
      role: "admin",
      body: { ...perfil, username: "admin_segundo", role: "admin" },
    })
  ).json();
  assert.equal(segundo.role, "admin");
  assert.equal(
    (
      await raw(`/usuarios/${segundo.id}`, {
        method: "PUT",
        role: "admin",
        body: {
          ...perfil,
          username: "admin_segundo",
          role: "admin",
          active: false,
          password: undefined,
        },
      })
    ).status,
    200,
  );
  const prueba = await raw("/auth/login", {
    method: "POST",
    body: { username: admin.username, password: admin.password },
  });
  const cookieAdmin = prueba.headers.get("set-cookie").split(";")[0];
  await db.query(
    "UPDATE sesiones_usuarios SET creado_en=DATE_SUB(NOW(3),INTERVAL 2 HOUR),expira_en=DATE_SUB(NOW(3),INTERVAL 1 HOUR) WHERE token_hash=?",
    [hashToken(cookieAdmin.split("=")[1])],
  );
  assert.equal(
    (await raw("/auth/session", { cookie: cookieAdmin })).status,
    401,
  );
  await raw("/auth/logout", { method: "POST", cookie, body: {} });
  assert.equal((await raw("/auth/session", { cookie })).status, 401);
  const cierre = await raw("/auth/login", {
    method: "POST",
    body: { username: admin.username, password: admin.password },
  });
  const cookieCierre = cierre.headers.get("set-cookie").split(";")[0];
  await raw("/auth/logout", { method: "POST", cookie: cookieCierre, body: {} });
  assert.equal(
    (await raw("/auth/session", { cookie: cookieCierre })).status,
    401,
    "Logout revoca una sesión que era válida",
  );
  // Dos administradores intentan desactivarse mutuamente: solo uno puede lograrlo.
  await raw(`/usuarios/${segundo.id}`, {
    method: "PUT",
    role: "admin",
    body: {
      ...perfil,
      username: "admin_segundo",
      role: "admin",
      active: true,
      password: undefined,
    },
  });
  const loginSegundo = await raw("/auth/login", {
    method: "POST",
    body: { username: "admin_segundo", password: perfil.password },
  });
  const cookieSegundo = loginSegundo.headers.get("set-cookie").split(";")[0];
  const carreras = await Promise.all([
    raw(`/usuarios/${segundo.id}`, {
      method: "PUT",
      role: "admin",
      body: {
        username: "admin_segundo",
        name: "Admin segundo",
        role: "admin",
        active: false,
      },
    }),
    raw(`/usuarios/${admin.id}`, {
      method: "PUT",
      cookie: cookieSegundo,
      body: {
        username: admin.username,
        name: "Admin",
        role: "admin",
        active: false,
      },
    }),
  ]);
  assert.equal(carreras.filter((r) => r.status === 200).length, 1);
  const [administradores] = await db.query(
    "SELECT id_usuario,usuario,nombre FROM usuarios WHERE tipo='admin' AND activo=1",
  );
  assert.equal(administradores.length, 1);
  await assert.rejects(
    guardarUsuario(
      String(administradores[0].id_usuario),
      {
        username: administradores[0].usuario,
        name: administradores[0].nombre,
        role: "mozo",
        active: true,
      },
      null,
    ),
    /al menos un administrador/,
  );
  const env = {
    ADMIN_USERNAME: "elias_seed",
    ADMIN_NAME: "Elías Manuel Santiago",
    ADMIN_PASSWORD: randomBytes(18).toString("base64url"),
    SEED_EQUIPO_PASSWORD: randomBytes(18).toString("base64url"),
  };
  assert.equal((await sembrarUsuarios({ incluirEquipo: true, env })).length, 5);
  const [[antes]] = await db.query(
    "SELECT password_hash FROM usuarios WHERE usuario='elias_seed'",
  );
  assert.deepEqual(
    await sembrarUsuarios({
      incluirEquipo: true,
      env: { ...env, ADMIN_PASSWORD: "otra-clave-distinta" },
    }),
    [],
  );
  const [[despues]] = await db.query(
    "SELECT password_hash FROM usuarios WHERE usuario='elias_seed'",
  );
  assert.equal(antes.password_hash, despues.password_hash);
  let limitado = false;
  for (let i = 0; i < 18; i++) {
    const response = await raw("/auth/login", {
      method: "POST",
      body: { username: "no_existe", password: "clave-incorrecta" },
    });
    if (response.status === 429) {
      limitado = true;
      break;
    }
  }
  assert.ok(limitado, "Los intentos fallidos se limitan");
  console.log(
    "OK autenticación: credenciales reales, cookie persistente, roles, CSRF, ABM, desactivación, expiración y semilla repetible sin cambiar claves.",
  );
}
