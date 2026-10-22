import { registrarAcceso } from "./modules/rutas-acceso.js";
import { vigilarSesion } from "./modules/autenticacion.js";
import { crearEventosPrioridad } from "./modules/eventos-prioridad.js";
import { crearColaPrioridad } from "./modules/prioridad.js";
import express from "express";
import * as restaurante from "./modules/restaurante.js";
import * as repartos from "./modules/repartos.js";
import {
  crearResumen,
  listarResumenes,
  borrarResumen,
  listarDatosDeUnResumen,
} from "./modules/consultas.js";

const prioridad = crearColaPrioridad();
const eventosPrioridad = crearEventosPrioridad();

export const app = express();
app.use((req, res, next) => {
  res.header(
    "Access-Control-Allow-Origin",
    process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  );
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, X-Nacar-Request",
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "256kb" }));
registrarAcceso(app);
app.param("id", (req, res, next, id) => {
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))
    return res
      .status(400)
      .json({ message: "El ID debe ser un entero positivo." });
  next();
});

// Un único try/catch por solicitud; el manejador final devuelve mensajes seguros.
function ruta(metodo, url, operacion, status = 200) {
  app[metodo](url, async (req, res, next) => {
    try {
      const resultado = await operacion(req);
      res.status(status).json(resultado);
    } catch (error) {
      next(error);
    }
  });
}
const mensaje = (message) => ({ message });

ruta("post", "/api/envios/obtener", ({ body }) =>
  repartos.listarEnvios(body.repartidor_id),
);
ruta(
  "post",
  "/api/envios",
  async ({ body }) => ({ id_pedido: await repartos.crearEnvio(body) }),
  201,
);
ruta("patch", "/api/envios/:id/estado", async ({ params, body }) => {
  await repartos.cambiarEstadoEnvio(params.id, body);
  return mensaje("Envío actualizado.");
});

ruta("post", "/api/mesas/obtener", () => restaurante.listarTodasLasMesas());
ruta(
  "post",
  "/api/mesas",
  async ({ body }) => ({
    id_mesa: await restaurante.crearMesa(body.cantidad_personas, body.numero),
    ...body,
  }),
  201,
);
ruta("put", "/api/mesas/:id", async ({ params, body }) => {
  await restaurante.cambiarTamanoMesa(
    params.id,
    body.cantidad_personas,
    body.numero,
  );
  return mensaje("Mesa actualizada.");
});
ruta("patch", "/api/mesas/:id/abrir", async ({ params, body }) => {
  await restaurante.abrirMesa(params.id, body.comensales);
  return mensaje("Mesa abierta.");
});
ruta("patch", "/api/mesas/:id/cerrar", async ({ params }) => {
  await restaurante.cerrarMesa(params.id);
  return mensaje("Mesa cerrada.");
});
ruta("delete", "/api/mesas/:id", async ({ params }) => {
  await restaurante.borrarMesa(params.id);
  return mensaje("Mesa eliminada.");
});

ruta("post", "/api/comidas/obtener", () => restaurante.listarTodasLasComidas());
ruta(
  "post",
  "/api/comidas",
  async ({ body }) => ({
    id_comida: await restaurante.crearComida(body),
    ...body,
  }),
  201,
);
ruta("put", "/api/comidas/:id", async ({ params, body }) => {
  await restaurante.editarComida(params.id, body);
  return mensaje("Comida actualizada.");
});
ruta("patch", "/api/comidas/:id/disponibilidad", async ({ params, body }) => {
  await restaurante.cambiarDisponibilidadComida(params.id, body.disponible);
  return mensaje("Disponibilidad actualizada.");
});
ruta("delete", "/api/comidas/:id", async ({ params }) => {
  await restaurante.eliminarComida(params.id);
  return mensaje("Comida eliminada.");
});

app.get("/api/pedidos/eventos", (req, res) => {
  eventosPrioridad.conectar(res);
  vigilarSesion(req, res);
});

ruta("post", "/api/pedidos/obtener", async () =>
  prioridad.listar(await restaurante.listarTodosLosPedidos()),
);
ruta("patch", "/api/pedidos/:id/prioridad", async ({ params, body }) => {
  prioridad.mover(
    await restaurante.listarTodosLosPedidos(),
    Number(params.id),
    body?.destino,
    body?.antes,
  );
  eventosPrioridad.avisar();
  return mensaje("Prioridad actualizada.");
});
ruta(
  "post",
  "/api/pedidos",
  async ({ body }) => ({
    id_pedido: await restaurante.crearPedido(
      body.id_mesa,
      body.comidas,
      body.mozo_id,
      body.mozo_nombre,
      body.id_mesero,
    ),
    ...body,
  }),
  201,
);
ruta("put", "/api/pedidos/:id", async ({ params, body }) => {
  await restaurante.editarPedido(params.id, body.comidas);
  return mensaje("Pedido actualizado.");
});
ruta("patch", "/api/pedidos/:id/estado", async ({ params, body }) => {
  await restaurante.cambiarEstadoPedido(params.id, body.estado, body.actor);
  return mensaje("Estado actualizado.");
});
// Se conservan las rutas anteriores para cancelar y despachar.
ruta("patch", "/api/pedidos/:id/cancelar", async ({ params, body }) => {
  await restaurante.cambiarEstadoPedido(
    params.id,
    "cancelado",
    body?.actor || "Servicio",
  );
  return mensaje("Pedido cancelado.");
});
ruta("patch", "/api/pedidos/:id/despachar", async ({ params, body }) => {
  await restaurante.cambiarEstadoPedido(
    params.id,
    "entregado",
    body?.actor || "Servicio",
  );
  return mensaje("Pedido entregado.");
});

ruta("post", "/api/resumenes/obtener", () => listarResumenes());
ruta("post", "/api/resumenes/detalle", async ({ body }) => {
  restaurante.comprobar(
    Number.isSafeInteger(body.id_resumen) && body.id_resumen > 0,
    "ID de resumen inválido.",
  );
  return listarDatosDeUnResumen(body.id_resumen);
});
ruta(
  "post",
  "/api/resumenes",
  async ({ body }) => {
    restaurante.comprobar(
      typeof body.tipo === "string" &&
        body.tipo.trim() &&
        body.tipo.length <= 100,
      "Tipo de resumen inválido.",
    );
    restaurante.comprobar(
      Number.isFinite(body.ganancias) && body.ganancias >= 0,
      "Ganancias inválidas.",
    );
    for (const campo of ["pedidos", "pedidos_cancelados"])
      restaurante.comprobar(
        Number.isSafeInteger(body[campo]) && body[campo] >= 0,
        `Revisá ${campo}.`,
      );
    if (body.comidas_posiciones !== undefined)
      restaurante.comprobar(
        Array.isArray(body.comidas_posiciones) &&
          body.comidas_posiciones.every(
            (item) =>
              Number.isSafeInteger(item.id_comida) &&
              item.id_comida > 0 &&
              Number.isSafeInteger(item.posicion) &&
              item.posicion > 0,
          ),
        "Posiciones inválidas.",
      );
    return { id_resumen: await crearResumen(body), ...body };
  },
  201,
);
ruta("delete", "/api/resumenes/:id", async ({ params }) => {
  await borrarResumen(params.id);
  return mensaje("Resumen eliminado.");
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (!error.status) console.error(error);
  const message = error.code?.startsWith("ER_")
    ? "No se pudo guardar el cambio. Revisá los datos o la configuración de la base."
    : error.message;
  res.status(error.status || 400).json({ message });
});
