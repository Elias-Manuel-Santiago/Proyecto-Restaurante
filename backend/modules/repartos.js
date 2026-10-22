import db from "./db.js";
import { comprobar, transaccion, guardarItems } from "./restaurante.js";

const texto = (valor, max) =>
  typeof valor === "string" && valor.trim().length > 0 && valor.length <= max;
export async function crearEnvio(datos) {
  comprobar(
    texto(datos.destinatario, 100) && texto(datos.direccion, 300),
    "Completá destinatario y dirección.",
  );
  comprobar(
    texto(datos.repartidor_id, 200) && texto(datos.repartidor_nombre, 80),
    "Elegí un repartidor.",
  );
  comprobar(
    texto(datos.mozo_id, 200) && texto(datos.mozo_nombre, 80),
    "Indicá quién registra el envío.",
  );
  comprobar(
    datos.indicaciones === undefined ||
      (typeof datos.indicaciones === "string" &&
        datos.indicaciones.length <= 300),
    "Indicaciones inválidas.",
  );
  return transaccion(async (conexion) => {
    const [[repartidor]] = await conexion.query(
      "SELECT id_usuario,nombre FROM usuarios WHERE id_usuario=? AND tipo='repartidor' AND activo=1 FOR UPDATE",
      [datos.repartidor_id],
    );
    comprobar(repartidor, "El repartidor elegido ya no está habilitado.");
    datos = { ...datos, repartidor_nombre: repartidor.nombre };
    const ahora = new Date();
    const historial = JSON.stringify([
      {
        status: "pendiente",
        at: ahora.toISOString(),
        actor: datos.mozo_nombre,
      },
    ]);
    const [pedido] = await conexion.query(
      "INSERT INTO pedidos (id_mesa,id_mesero,estado,mozo_id,mozo_nombre,creado_en,historial) VALUES (NULL,?,'pendiente',?,?,?,?)",
      [
        datos.id_mesero ?? null,
        datos.mozo_id,
        datos.mozo_nombre,
        ahora,
        historial,
      ],
    );
    await guardarItems(conexion, pedido.insertId, datos.comidas);
    await conexion.query(
      "INSERT INTO envios (id_pedido,destinatario,direccion,indicaciones,repartidor_id,repartidor_nombre) VALUES (?,?,?,?,?,?)",
      [
        pedido.insertId,
        datos.destinatario.trim(),
        datos.direccion.trim(),
        datos.indicaciones?.trim() || "",
        datos.repartidor_id,
        datos.repartidor_nombre.trim(),
      ],
    );
    return pedido.insertId;
  });
}

export async function listarEnvios(repartidor) {
  comprobar(texto(repartidor, 200), "Indicá el repartidor.");
  const [filas] = await db.query(
    `SELECT e.*, p.estado AS estado_pedido,
    pc.id_comida, pc.cantidad, pc.notas, pc.nombre_comida
    FROM envios e JOIN pedidos p ON p.id_pedidos=e.id_pedido
    JOIN pedidos_comida pc ON pc.id_pedido=p.id_pedidos
    WHERE e.repartidor_id=? AND p.estado<>'cancelado' ORDER BY e.id_pedido DESC,pc.id_comida`,
    [repartidor],
  );
  return filas;
}

export async function cambiarEstadoEnvio(id, datos) {
  comprobar(
    texto(datos.repartidor_id, 200) && texto(datos.actor, 80),
    "Indicá el repartidor y su nombre.",
  );
  comprobar(
    ["en_camino", "entregado"].includes(datos.estado),
    "Estado de envío inválido.",
  );
  return transaccion(async (conexion) => {
    // Mismo orden que los cambios de cocina: pedido antes de su envío.
    const [[pedido]] = await conexion.query(
      "SELECT * FROM pedidos WHERE id_pedidos=? FOR UPDATE",
      [id],
    );
    const [[envio]] = await conexion.query(
      "SELECT * FROM envios WHERE id_pedido=? FOR UPDATE",
      [id],
    );
    comprobar(
      pedido && envio && envio.repartidor_id === datos.repartidor_id,
      "El envío no está asignado a este repartidor.",
    );
    if (envio.estado === datos.estado && pedido.estado !== "cancelado") return; // Reintento seguro.
    comprobar(
      pedido.estado === "listo",
      "El pedido debe estar listo en cocina y no cancelado.",
    );
    comprobar(
      (envio.estado === "pendiente" && datos.estado === "en_camino") ||
        (envio.estado === "en_camino" && datos.estado === "entregado"),
      "Transición de envío inválida.",
    );
    const ahora = new Date();
    await conexion.query(
      "UPDATE envios SET estado=?,retirado_en=COALESCE(retirado_en,?),entregado_en=? WHERE id_pedido=?",
      [datos.estado, ahora, datos.estado === "entregado" ? ahora : null, id],
    );
    if (datos.estado === "entregado") {
      const historial = [
        ...(pedido.historial ? JSON.parse(pedido.historial) : []),
        { status: "entregado", at: ahora.toISOString(), actor: datos.actor },
      ];
      await conexion.query(
        "UPDATE pedidos SET estado='entregado',historial=? WHERE id_pedidos=?",
        [JSON.stringify(historial), id],
      );
    }
  });
}
