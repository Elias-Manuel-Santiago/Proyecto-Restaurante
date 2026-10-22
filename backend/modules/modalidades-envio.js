import db from "./db.js";
import { comprobar, transaccion } from "./restaurante.js";
import { centavos, decimal } from "./importes.js";

export async function listarModalidades() {
  const [filas] = await db.query(
    "SELECT * FROM modalidades_envio ORDER BY nombre",
  );
  return filas;
}
export async function guardarModalidad(codigo, datos) {
  comprobar(/^[a-z0-9_]{3,40}$/.test(codigo), "Código de modalidad inválido.");
  comprobar(
    typeof datos.nombre === "string" &&
      datos.nombre.trim().length > 0 &&
      datos.nombre.trim().length <= 80,
    "Completá el nombre de la modalidad.",
  );
  for (const campo of ["requiere_direccion", "requiere_repartidor", "activo"])
    comprobar(
      typeof datos[campo] === "boolean",
      "Revisá las opciones de la modalidad.",
    );
  comprobar(
    !datos.requiere_repartidor || datos.requiere_direccion,
    "Una entrega con repartidor necesita dirección.",
  );
  const costo = datos.costo === null ? null : decimal(centavos(datos.costo));
  await transaccion(async (conexion) => {
    const [[anterior]] = await conexion.query(
      "SELECT * FROM modalidades_envio WHERE codigo=? FOR UPDATE",
      [codigo],
    );
    if (
      anterior &&
      (Boolean(anterior.requiere_direccion) !== datos.requiere_direccion ||
        Boolean(anterior.requiere_repartidor) !== datos.requiere_repartidor)
    ) {
      const [[usada]] = await conexion.query(
        "SELECT COUNT(*) AS n FROM envio_modalidad WHERE modalidad_codigo=?",
        [codigo],
      );
      comprobar(
        !usada.n,
        "La modalidad ya tiene pedidos. Para cambiar el circuito, agregá otra modalidad.",
      );
    }
    await conexion.query(
      `INSERT INTO modalidades_envio (codigo,nombre,costo,requiere_direccion,requiere_repartidor,activo) VALUES (?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE nombre=VALUES(nombre),costo=VALUES(costo),requiere_direccion=VALUES(requiere_direccion),requiere_repartidor=VALUES(requiere_repartidor),activo=VALUES(activo)`,
      [
        codigo,
        datos.nombre.trim(),
        costo,
        datos.requiere_direccion,
        datos.requiere_repartidor,
        datos.activo,
      ],
    );
  });
}
export async function validarModalidad(conexion, datos) {
  comprobar(
    typeof datos.modalidad === "string",
    "Elegí la modalidad de entrega.",
  );
  const [[modalidad]] = await conexion.query(
    "SELECT * FROM modalidades_envio WHERE codigo=? AND activo=1 FOR UPDATE",
    [datos.modalidad],
  );
  comprobar(
    modalidad && modalidad.costo !== null,
    "La modalidad no está disponible o todavía no tiene tarifa. Consultá al administrador.",
  );
  if (datos.costo_confirmado !== undefined)
    comprobar(
      centavos(datos.costo_confirmado) === centavos(modalidad.costo),
      "La tarifa cambió. Cerrá el borrador y volvé a elegir la modalidad.",
    );
  return modalidad;
}
