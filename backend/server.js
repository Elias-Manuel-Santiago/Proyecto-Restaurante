import express from "express";
import {
  // Consultas de Mesas
  crearMesa,
  borrarMesa,
  cambiarTamañoMesa,
  listarTodasLasMesas,
  // Consultas de Pedidos
  crearPedido,
  editarPedido,
  cancelarPedido,
  despacharPedido,
  listarTodosLosPedidos,
  // Consultas de Comidas
  crearComida,
  editarComida,
  cambiarDisponibilidadComida,
  eliminarComida,
  listarTodasLasComidas,
  // Consultas de Resúmenes
  crearResumen,
  listarResumenes,
  borrarResumen,
  listarDatosDeUnResumen,
} from "./modules/consultas.js";

const app = express();
const port = 3005;

// Middleware de CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:5173");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json());

// Validadores auxiliares
function validarCampos(...campos) {
  return (req, res, next) => {
    const faltantes = campos.filter(
      (campo) => req.body?.[campo] === undefined || req.body[campo] === null
    );
    if (faltantes.length) {
      return res.status(400).json({ error: "Faltan campos obligatorios", campos: faltantes });
    }
    next();
  };
}

app.param("id", (req, res, next, id) => {
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    return res.status(400).json({ error: "El ID debe ser un entero positivo valido" });
  }
  next();
});

// ==========================================
// RUTAS DE MESAS
// ==========================================

// Obtener todas las mesas (Cambiado de GET a POST)
app.post("/api/mesas/obtener", async (req, res, next) => {
  try {
    const mesas = await listarTodasLasMesas();
    res.json(mesas);
  } catch (error) {
    next(error);
  }
});

app.post("/api/mesas", validarCampos("cantidad_personas"), async (req, res, next) => {
  try {
    const { cantidad_personas } = req.body;
    const id = await crearMesa(cantidad_personas);
    res.status(201).json({ id_mesa: id, cantidad_personas });
  } catch (error) {
    next(error);
  }
});

app.put("/api/mesas/:id", validarCampos("cantidad_personas"), async (req, res, next) => {
  try {
    const filasAfectadas = await cambiarTamañoMesa(req.params.id, req.body.cantidad_personas);
    if (filasAfectadas === 0) return res.status(404).json({ error: "Mesa no encontrada" });
    res.json({ message: "Mesa actualizada correctamente" });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/mesas/:id", async (req, res, next) => {
  try {
    const filasAfectadas = await borrarMesa(req.params.id);
    if (filasAfectadas === 0) return res.status(404).json({ error: "Mesa no encontrada" });
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// RUTAS DE COMIDAS
// ==========================================

// Obtener todas las comidas (Cambiado de GET a POST)
app.post("/api/comidas/obtener", async (req, res, next) => {
  try {
    const comidas = await listarTodasLasComidas();
    res.json(comidas);
  } catch (error) {
    next(error);
  }
});

app.post("/api/comidas", validarCampos("tipo", "nombre", "descripcion", "precio"), async (req, res, next) => {
  try {
    const id = await crearComida(req.body);
    res.status(201).json({ id_comida: id, ...req.body });
  } catch (error) {
    next(error);
  }
});

app.put("/api/comidas/:id", validarCampos("tipo", "nombre", "descripcion", "precio"), async (req, res, next) => {
  try {
    const filasAfectadas = await editarComida(req.params.id, req.body);
    if (filasAfectadas === 0) return res.status(404).json({ error: "Comida no encontrada" });
    res.json({ message: "Comida actualizada correctamente" });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/comidas/:id/disponibilidad", validarCampos("disponible"), async (req, res, next) => {
  try {
    const filasAfectadas = await cambiarDisponibilidadComida(req.params.id, req.body.disponible);
    if (filasAfectadas === 0) return res.status(404).json({ error: "Comida no encontrada" });
    res.json({ message: "Disponibilidad actualizada" });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/comidas/:id", async (req, res, next) => {
  try {
    const filasAfectadas = await eliminarComida(req.params.id);
    if (filasAfectadas === 0) return res.status(404).json({ error: "Comida no encontrada" });
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// RUTAS DE PEDIDOS
// ==========================================

// Obtener todos los pedidos (Cambiado de GET a POST)
app.post("/api/pedidos/obtener", async (req, res, next) => {
  try {
    const pedidos = await listarTodosLosPedidos();
    res.json(pedidos);
  } catch (error) {
    next(error);
  }
});

app.post("/api/pedidos", validarCampos("id_mesa", "comidas"), async (req, res, next) => {
  try {
    const { id_mesa, comidas } = req.body;
    if (!Array.isArray(comidas) || comidas.length === 0) {
      return res.status(400).json({ error: "El pedido debe tener al menos una comida" });
    }
    const id_pedido = await crearPedido(id_mesa, comidas);
    res.status(201).json({ id_pedido, id_mesa, comidas });
  } catch (error) {
    next(error);
  }
});

app.put("/api/pedidos/:id", validarCampos("comidas"), async (req, res, next) => {
  try {
    const { comidas } = req.body;
    if (!Array.isArray(comidas)) {
      return res.status(400).json({ error: "Lista de comidas invalida" });
    }
    await editarPedido(req.params.id, comidas);
    res.json({ message: "Pedido actualizado correctamente" });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/pedidos/:id/cancelar", async (req, res, next) => {
  try {
    const filasAfectadas = await cancelarPedido(req.params.id);
    if (filasAfectadas === 0) return res.status(404).json({ error: "Pedido no encontrado" });
    res.json({ message: "Pedido cancelado" });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/pedidos/:id/despachar", async (req, res, next) => {
  try {
    const filasAfectadas = await despacharPedido(req.params.id);
    if (filasAfectadas === 0) return res.status(404).json({ error: "Pedido no encontrado" });
    res.json({ message: "Pedido despachado" });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// RUTAS DE RESÚMENES
// ==========================================

// Obtener lista de resúmenes (Cambiado de GET a POST)
app.post("/api/resumenes/obtener", async (req, res, next) => {
  try {
    const resumenes = await listarResumenes();
    res.json(resumenes);
  } catch (error) {
    next(error);
  }
});

// Obtener datos de un resumen específico (Cambiado de GET a POST)
app.post("/api/resumenes/detalle", validarCampos("id_resumen"), async (req, res, next) => {
  try {
    const { id_resumen } = req.body;
    const resumen = await listarDatosDeUnResumen(id_resumen);
    if (!resumen) return res.status(404).json({ error: "Resumen no encontrado" });
    res.json(resumen);
  } catch (error) {
    next(error);
  }
});

app.post("/api/resumenes", validarCampos("tipo", "ganancias", "pedidos", "pedidos_cancelados"), async (req, res, next) => {
  try {
    const id_resumen = await crearResumen(req.body);
    res.status(201).json({ id_resumen, ...req.body });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/resumenes/:id", async (req, res, next) => {
  try {
    const filasAfectadas = await borrarResumen(req.params.id);
    if (filasAfectadas === 0) return res.status(404).json({ error: "Resumen no encontrado" });
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});


app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "El cuerpo debe contener JSON valido" });
  }
  if (error.code === "ER_ROW_IS_REFERENCED_2" || error.code === "ER_NO_REFERENCED_ROW_2") {
    return res.status(400).json({ error: "Error de clave foranea. Verifique las referencias enviadas (e.g., id_mesa o id_comida inexistente)" });
  }
  console.error("Error en el servidor:", error);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});