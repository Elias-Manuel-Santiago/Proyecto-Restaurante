import db from "./db.js";
import { pathToFileURL } from "node:url";
import { hashClave, claveValida } from "./autenticacion.js";

export const equipo = [
  { username: "martin", name: "Martín Porcelli", role: "mozo" },
  { username: "laureano", name: "Laureano Desantadina", role: "chef" },
  { username: "santiago", name: "Santiago Oviedo", role: "repartidor" },
  { username: "nehuen", name: "Parrondo Nehuen", role: "mozo" },
];

export async function sembrarUsuarios({
  incluirEquipo = false,
  env = process.env,
  pool = db,
} = {}) {
  const username = (env.ADMIN_USERNAME || "elias").trim().toLowerCase();
  const nombre = (env.ADMIN_NAME || "Elías Manuel Santiago").trim();
  if (!/^[a-z0-9._-]{3,40}$/.test(username) || !nombre || nombre.length > 80)
    throw new Error("Configurá ADMIN_USERNAME y ADMIN_NAME válidos.");
  const conexion = await pool.getConnection();
  const creados = [];
  try {
    // Evita semillas simultáneas sin modificar la contraseña de una cuenta existente.
    const [[{ ok }]] = await conexion.query(
      "SELECT GET_LOCK(CONCAT(DATABASE(),':seed-usuarios'),10) AS ok",
    );
    if (!ok) throw new Error("Otra carga de usuarios está en curso.");
    const [[admin]] = await conexion.query(
      "SELECT * FROM usuarios WHERE usuario=?",
      [username],
    );
    if (admin && (admin.tipo !== "admin" || !admin.activo))
      throw new Error(
        "La cuenta indicada existe sin acceso de administrador. No se modificó.",
      );
    const cuentas = [
      { username, name: nombre, role: "admin", password: env.ADMIN_PASSWORD },
      ...(incluirEquipo
        ? equipo.map((u) => ({
            ...u,
            password:
              env[`SEED_PASSWORD_${u.username.toUpperCase()}`] ||
              env.SEED_EQUIPO_PASSWORD,
          }))
        : []),
    ];
    const pendientes = [];
    for (const cuenta of cuentas) {
      const [[existe]] = await conexion.query(
        "SELECT id_usuario FROM usuarios WHERE usuario=?",
        [cuenta.username],
      );
      if (existe) continue;
      if (!claveValida(cuenta.password))
        throw new Error(
          `Definí una contraseña de 10 a 128 caracteres para ${cuenta.username} en el entorno local.`,
        );
      pendientes.push({ ...cuenta, hash: await hashClave(cuenta.password) });
    }
    await conexion.beginTransaction();
    for (const cuenta of pendientes) {
      await conexion.query(
        "INSERT INTO usuarios (usuario,nombre,tipo,password_hash,activo) VALUES (?,?,?,?,1)",
        [cuenta.username, cuenta.name, cuenta.role, cuenta.hash],
      );
      creados.push(cuenta.username);
    }
    await conexion.commit();
    return creados;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    await conexion.query(
      "SELECT RELEASE_LOCK(CONCAT(DATABASE(),':seed-usuarios'))",
    );
    conexion.release();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const usuarios = await sembrarUsuarios({
      incluirEquipo: process.argv.includes("--equipo"),
    });
    console.log(
      usuarios.length
        ? `Cuentas creadas: ${usuarios.join(", ")}.`
        : "Las cuentas ya existen; se conservaron sus datos y contraseñas.",
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
