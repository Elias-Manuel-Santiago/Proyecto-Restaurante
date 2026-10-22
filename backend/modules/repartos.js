import { validarModalidad } from "./modalidades-envio.js";
import { exigirPago } from "./pagos.js";
import db from "./db.js";
import { comprobar, transaccion, guardarItems } from "./restaurante.js";

const texto = (valor, max) =>
  typeof valor === "string" && valor.trim().length > 0 && valor.length <= max;
export async function crearEnvio(datos) {
  comprobar(texto(datos.destinatario, 100), "Completá el destinatario.");
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
    const modalidad = await validarModalidad(conexion, datos);
    comprobar(
      !modalidad.requiere_direccion || texto(datos.direccion, 300),
      "Completá la dirección de entrega.",
    );
    let repartidor = null;
    if (modalidad.requiere_repartidor) {
      comprobar(texto(datos.repartidor_id, 200), "Elegí el repartidor.");
      [[repartidor]] = await conexion.query(
        "SELECT id_usuario,nombre FROM usuarios WHERE id_usuario=? AND tipo='repartidor' AND activo=1 FOR UPDATE",
        [datos.repartidor_id],
      );
      comprobar(repartidor, "El repartidor ya no está habilitado.");
    }
    const ahora = new Date();
    const historial = JSON.stringify([
      {
        status: "pendiente",
        at: ahora.toISOString(),
        actor: datos.mozo_nombre,
      },
    ]);
    const [pedido] = await conexion.query(
      "INSERT INTO pedidos (id_mesa,id_mesero,estado,mozo_id,mozo_nombre,creado_en,historial,pago_requerido) VALUES (NULL,?,'pendiente',?,?,?,?,1)",
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
        modalidad.requiere_direccion ? datos.direccion.trim() : null,
        datos.indicaciones?.trim() || "",
        repartidor ? String(repartidor.id_usuario) : null,
        repartidor?.nombre || null,
      ],
    );
    await conexion.query(
      "INSERT INTO envio_modalidad (id_pedido,modalidad_codigo,costo) VALUES (?,?,?)",
      [pedido.insertId, modalidad.codigo, modalidad.costo],
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

export async function cambiarEstadoEnvio(id, datos, actor) {
  comprobar(
    actor && texto(datos.actor, 80),
    "Ingresá nuevamente para continuar.",
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
    comprobar(pedido && envio, "El envío no está asignado a este repartidor.");
    const [[modalidad]] = await conexion.query(
      "SELECT m.* FROM envio_modalidad em JOIN modalidades_envio m ON m.codigo=em.modalidad_codigo WHERE em.id_pedido=?",
      [id],
    );
    const interno = modalidad ? Boolean(modalidad.requiere_repartidor) : true;
    const retiro = modalidad ? !modalidad.requiere_direccion : false;
    comprobar(
      interno
        ? actor.role === "repartidor" && envio.repartidor_id === actor.id
        : ["mozo", "admin"].includes(actor.role),
      "La entrega corresponde a otro rol o repartidor.",
    );
    await exigirPago(conexion, pedido);
    if (envio.estado === datos.estado && pedido.estado !== "cancelado") return; // Reintento seguro.
    comprobar(
      pedido.estado === "listo",
      "El pedido debe estar listo en cocina y no cancelado.",
    );
    comprobar(
      (envio.estado === "pendiente" &&
        datos.estado === (retiro ? "entregado" : "en_camino")) ||
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
