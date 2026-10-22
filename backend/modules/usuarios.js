import db from "./db.js";
import { transaccion } from "./restaurante.js";
import {
  roles,
  perfil,
  fallo,
  claveValida,
  hashClave,
} from "./autenticacion.js";

function validar(datos, nuevo) {
  const usuario =
    typeof datos.username === "string"
      ? datos.username.trim().toLowerCase()
      : "";
  if (
    !/^[a-z0-9._-]{3,40}$/.test(usuario) ||
    typeof datos.name !== "string" ||
    !datos.name.trim() ||
    datos.name.trim().length > 80 ||
    !roles.includes(datos.role) ||
    typeof datos.active !== "boolean"
  )
    throw fallo(400, "Revisá nombre, usuario, rol y estado de la cuenta.");
  if ((nuevo || datos.password !== undefined) && !claveValida(datos.password))
    throw fallo(
      400,
      "La contraseña debe tener entre 10 y 128 caracteres y no ser solo espacios.",
    );
  return usuario;
}
export async function listarUsuarios(catalogo = false) {
  const [usuarios] = await db.query(
    "SELECT id_usuario,usuario,nombre,tipo,activo FROM usuarios ORDER BY nombre,id_usuario",
  );
  return usuarios
    .map(perfil)
    .map((u) =>
      catalogo ? { id: u.id, name: u.name, role: u.role, active: u.active } : u,
    );
}
export async function guardarUsuario(id, datos, actor) {
  const username = validar(datos, !id);
  const passwordHash =
    datos.password === undefined ? null : await hashClave(datos.password);
  try {
    return await transaccion(async (conexion) => {
      // Orden único para los cambios concurrentes: protege al último administrador.
      const [usuarios] = await conexion.query(
        "SELECT id_usuario,tipo,activo FROM usuarios ORDER BY id_usuario FOR UPDATE",
      );
      if (actor) {
        const actual = usuarios.find((u) => String(u.id_usuario) === actor.id);
        if (!actual?.activo || actual.tipo !== "admin")
          throw fallo(403, "Tu cuenta ya no puede administrar usuarios.");
      }
      if (id) {
        const anterior = usuarios.find(
          (u) => String(u.id_usuario) === String(id),
        );
        if (!anterior) throw fallo(404, "Usuario no encontrado.");
        if (
          actor?.id === String(id) &&
          (!datos.active || datos.role !== "admin")
        )
          throw fallo(
            400,
            "No podés desactivar tu cuenta ni quitarte el rol de administrador.",
          );
        if (
          anterior.tipo === "admin" &&
          anterior.activo &&
          (!datos.active || datos.role !== "admin") &&
          usuarios.filter((u) => u.tipo === "admin" && u.activo).length <= 1
        )
          throw fallo(400, "Debe quedar al menos un administrador activo.");
        if (!datos.active || anterior.tipo !== datos.role) {
          const [[pendientes]] = await conexion.query(
            `SELECT (SELECT COUNT(*) FROM pedidos WHERE mozo_id=? AND estado IN ('pendiente','preparacion','listo')) +
          (SELECT COUNT(*) FROM envios e JOIN pedidos p ON p.id_pedidos=e.id_pedido WHERE e.repartidor_id=? AND p.estado NOT IN ('entregado','cancelado')) AS n`,
            [String(id), String(id)],
          );
          if (pendientes.n)
            throw fallo(
              400,
              "Terminá o reasigná los pedidos activos antes de desactivar o cambiar el rol.",
            );
        }
        await conexion.query(
          "UPDATE usuarios SET usuario=?,nombre=?,tipo=?,activo=?,password_hash=COALESCE(?,password_hash) WHERE id_usuario=?",
          [
            username,
            datos.name.trim(),
            datos.role,
            datos.active,
            passwordHash,
            id,
          ],
        );
        if (passwordHash || !datos.active || anterior.tipo !== datos.role)
          await conexion.query(
            "UPDATE sesiones_usuarios SET revocado_en=NOW(3) WHERE id_usuario=? AND revocado_en IS NULL",
            [id],
          );
      } else {
        const [result] = await conexion.query(
          "INSERT INTO usuarios (usuario,nombre,tipo,password_hash,activo) VALUES (?,?,?,?,?)",
          [username, datos.name.trim(), datos.role, passwordHash, datos.active],
        );
        id = result.insertId;
      }
      const [[u]] = await conexion.query(
        "SELECT * FROM usuarios WHERE id_usuario=?",
        [id],
      );
      return perfil(u);
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY")
      throw fallo(409, "Ya existe una cuenta con ese usuario.");
    throw error;
  }
}
