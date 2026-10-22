import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import rateLimit from "express-rate-limit";
import db from "./db.js";

export const roles = ["admin", "mozo", "chef", "repartidor"];
export const fallo = (status, message) =>
  Object.assign(new Error(message), { status });
export const perfil = (u) => ({
  id: String(u.id_usuario),
  username: u.usuario,
  name: u.nombre,
  role: u.tipo,
  active: Boolean(u.activo),
});
export const hashToken = (token) =>
  createHash("sha256").update(token).digest("hex");
export const claveValida = (password) =>
  typeof password === "string" &&
  password.length >= 10 &&
  password.length <= 128 &&
  password.trim().length > 0;
export const hashClave = (password) =>
  argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
const cookie = "nacar_session";
const opcionesCookie = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/api",
});
const horas = () => {
  const valor = Number(process.env.SESSION_HOURS || 8);
  if (!Number.isFinite(valor) || valor <= 0 || valor > 168)
    throw fallo(500, "SESSION_HOURS debe estar entre 0 y 168 horas.");
  return valor;
};
// Hash ficticio para que un usuario inexistente también realice una verificación costosa.
const hashFicticio = hashClave(randomBytes(32).toString("hex"));
export const limitarIngresos = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    message:
      "Demasiados intentos. Esperá unos minutos antes de volver a ingresar.",
  },
});

export function protegerEscritura(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("Origin");
  const permitidos = [
    process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    `${req.protocol}://${req.get("host")}`,
    ...(process.env.NODE_ENV !== "production"
      ? ["http://127.0.0.1:5173", "http://localhost:5173"]
      : []),
  ];
  if (
    req.get("X-Nacar-Request") !== "1" ||
    (origin && !permitidos.includes(origin))
  )
    return next(fallo(403, "Origen de la solicitud no permitido."));
  next();
}
export async function buscarSesion(token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return null;
  const [[u]] = await db.query(
    `SELECT u.*,s.id_sesion,s.expira_en FROM sesiones_usuarios s JOIN usuarios u ON u.id_usuario=s.id_usuario
    WHERE s.token_hash=? AND s.revocado_en IS NULL AND s.expira_en>NOW(3) AND u.activo=1`,
    [hashToken(token)],
  );
  return u || null;
}
export async function exigirSesion(req, res, next) {
  try {
    const u = await buscarSesion(req.cookies?.[cookie]);
    if (!u) {
      res.clearCookie(cookie, opcionesCookie());
      throw fallo(401, "Tu sesión venció o fue cerrada. Ingresá nuevamente.");
    }
    req.usuario = perfil(u);
    req.sesion = u;
    next();
  } catch (error) {
    next(error);
  }
}
export const permitir =
  (...permitidos) =>
  (req, res, next) =>
    permitidos.includes(req.usuario?.role)
      ? next()
      : next(fallo(403, "Tu rol no puede realizar esta acción."));
export async function ingresar(req, res) {
  const usuario =
    typeof req.body?.username === "string"
      ? req.body.username.trim().toLowerCase()
      : "";
  const password = req.body?.password;
  if (
    !/^[a-z0-9._-]{3,40}$/.test(usuario) ||
    typeof password !== "string" ||
    password.length > 128 ||
    !password.length
  )
    throw fallo(401, "Usuario o contraseña incorrectos.");
  const [[u]] = await db.query("SELECT * FROM usuarios WHERE usuario=?", [
    usuario,
  ]);
  const hash = u?.password_hash?.startsWith("$argon2id$")
    ? u.password_hash
    : await hashFicticio;
  const correcta = await argon2.verify(hash, password).catch(() => false);
  if (!correcta || !u?.activo || !roles.includes(u.tipo))
    throw fallo(401, "Usuario o contraseña incorrectos.");
  const token = randomBytes(32).toString("hex");
  const expira = new Date(Date.now() + horas() * 3600000);
  const conexion = await db.getConnection();
  try {
    await conexion.beginTransaction();
    const [[actual]] = await conexion.query(
      "SELECT * FROM usuarios WHERE id_usuario=? FOR UPDATE",
      [u.id_usuario],
    );
    if (
      !actual?.activo ||
      actual.password_hash !== u.password_hash ||
      actual.tipo !== u.tipo
    )
      throw fallo(401, "La cuenta cambió. Volvé a ingresar.");
    if (req.cookies?.[cookie])
      await conexion.query(
        "UPDATE sesiones_usuarios SET revocado_en=NOW(3) WHERE token_hash=?",
        [hashToken(req.cookies[cookie])],
      );
    await conexion.query(
      "INSERT INTO sesiones_usuarios (id_usuario,token_hash,expira_en) VALUES (?,?,?)",
      [u.id_usuario, hashToken(token), expira],
    );
    await conexion.commit();
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
  res.cookie(cookie, token, { ...opcionesCookie(), expires: expira });
  return perfil(u);
}
export async function salir(req, res) {
  if (req.cookies?.[cookie])
    await db.query(
      "UPDATE sesiones_usuarios SET revocado_en=NOW(3) WHERE token_hash=?",
      [hashToken(req.cookies[cookie])],
    );
  res.clearCookie(cookie, opcionesCookie());
  return { message: "Sesión cerrada." };
}

// SSE valida también sesiones revocadas mientras la conexión permanece abierta.
export function vigilarSesion(req, res) {
  const revisar = async () => {
    try {
      if (!(await buscarSesion(req.cookies[cookie]))) {
        res.write("event: sesion-expirada\ndata: {}\n\n");
        res.end();
      }
    } catch {
      res.end();
    }
  };
  const timer = setInterval(revisar, 15000);
  timer.unref();
  res.once("close", () => clearInterval(timer));
}
