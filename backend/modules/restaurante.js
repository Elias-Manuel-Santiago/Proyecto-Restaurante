import { randomUUID } from "node:crypto";
import db from "./db.js";

const estados = {
  pendiente: ["preparacion", "cancelado"],
  preparacion: ["listo", "cancelado"],
  listo: ["entregado", "cancelado"],
  entregado: [],
  cancelado: [],
};
const categorias = ["Entradas", "Principales", "Postres", "Bebidas"];
export function comprobar(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}
const entero = (valor, min, max) =>
  Number.isInteger(valor) && valor >= min && valor <= max;
const texto = (valor, max) =>
  typeof valor === "string" && valor.trim().length > 0 && valor.length <= max;
const leerHistorial = (valor) => (valor ? JSON.parse(valor) : []);

// Cada escritura que afecta varias tablas se confirma o revierte completa.
async function transaccion(operacion) {
  const conexion = await db.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await operacion(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

export async function listarTodasLasMesas() {
  const [mesas] = await db.query(
    "SELECT * FROM mesas WHERE eliminado=0 ORDER BY numero",
  );
  return mesas;
}

export async function crearMesa(cantidad_personas, numero) {
  comprobar(
    entero(cantidad_personas, 1, 30),
    "La capacidad debe estar entre 1 y 30.",
  );
  return transaccion(async (conexion) => {
    if (numero === undefined) {
      const [[fila]] = await conexion.query(
        "SELECT COALESCE(MAX(numero),0)+1 AS numero FROM mesas WHERE eliminado=0",
      );
      numero = Number(fila.numero);
    }
    comprobar(
      entero(numero, 1, 999),
      "El número de mesa debe estar entre 1 y 999.",
    );
    const [resultado] = await conexion.query(
      "INSERT INTO mesas (numero,cantidad_personas) VALUES (?,?)",
      [numero, cantidad_personas],
    );
    return resultado.insertId;
  });
}

export async function cambiarTamanoMesa(id, cantidad_personas, numero) {
  return transaccion(async (conexion) => {
    const [[mesa]] = await conexion.query(
      "SELECT * FROM mesas WHERE id_mesa=? AND eliminado=0 FOR UPDATE",
      [id],
    );
    comprobar(mesa, "Mesa no encontrada.");
    numero ??= mesa.numero;
    comprobar(
      entero(cantidad_personas, 1, 30) && cantidad_personas >= mesa.comensales,
      "Revisá la capacidad de la mesa.",
    );
    comprobar(
      entero(numero, 1, 999) &&
        (mesa.estado === "desocupada" || numero === mesa.numero),
      "No se puede renumerar una mesa ocupada.",
    );
    await conexion.query(
      "UPDATE mesas SET numero=?,cantidad_personas=? WHERE id_mesa=?",
      [numero, cantidad_personas, id],
    );
  });
}

export async function abrirMesa(id, comensales) {
  return transaccion(async (conexion) => {
    const [[mesa]] = await conexion.query(
      "SELECT * FROM mesas WHERE id_mesa=? AND eliminado=0 FOR UPDATE",
      [id],
    );
    comprobar(
      mesa && mesa.estado === "desocupada",
      "La mesa no está disponible.",
    );
    comprobar(
      entero(comensales, 1, mesa.cantidad_personas),
      "Revisá la cantidad de comensales.",
    );
    await conexion.query(
      "UPDATE mesas SET estado='ocupada',comensales=?,servicio_id=? WHERE id_mesa=?",
      [comensales, randomUUID(), id],
    );
  });
}

export async function cerrarMesa(id) {
  return transaccion(async (conexion) => {
    const [[mesa]] = await conexion.query(
      "SELECT * FROM mesas WHERE id_mesa=? AND eliminado=0 FOR UPDATE",
      [id],
    );
    comprobar(mesa && mesa.estado === "ocupada", "La mesa no está ocupada.");
    const [[fila]] = await conexion.query(
      "SELECT COUNT(*) AS cantidad FROM pedidos WHERE id_mesa=? AND estado IN ('pendiente','preparacion','listo')",
      [id],
    );
    comprobar(Number(fila.cantidad) === 0, "La mesa tiene pedidos activos.");
    await conexion.query(
      "UPDATE mesas SET estado='desocupada',comensales=0,servicio_id=NULL WHERE id_mesa=?",
      [id],
    );
  });
}

export async function borrarMesa(id) {
  return transaccion(async (conexion) => {
    const [[mesa]] = await conexion.query(
      "SELECT * FROM mesas WHERE id_mesa=? AND eliminado=0 FOR UPDATE",
      [id],
    );
    comprobar(
      mesa && mesa.estado === "desocupada",
      "La mesa no existe o está ocupada.",
    );
    // Borrado lógico: conserva las referencias de los pedidos históricos.
    const [resultado] = await conexion.query(
      "UPDATE mesas SET eliminado=1,numero=NULL WHERE id_mesa=?",
      [id],
    );
    return resultado.affectedRows;
  });
}

function validarComida(comida) {
  comprobar(
    texto(comida.nombre, 100) &&
      typeof comida.descripcion === "string" &&
      comida.descripcion.length <= 500,
    "Revisá nombre y descripción.",
  );
  comprobar(categorias.includes(comida.tipo), "Categoría inválida.");
  comprobar(
    Number.isFinite(comida.precio) &&
      comida.precio > 0 &&
      comida.precio <= 10000000,
    "Precio inválido.",
  );
  comprobar(
    comida.imagen === undefined ||
      (typeof comida.imagen === "string" &&
        comida.imagen.length <= 2000 &&
        (comida.imagen === "" || comida.imagen.startsWith("https://"))),
    "Imagen inválida.",
  );
  comprobar(
    comida.disponible === undefined ||
      typeof comida.disponible === "boolean" ||
      comida.disponible === 0 ||
      comida.disponible === 1,
    "Disponibilidad inválida.",
  );
}

export async function crearComida(comida) {
  validarComida(comida);
  const {
    tipo,
    nombre,
    descripcion,
    precio,
    imagen = "",
    disponible = true,
  } = comida;
  const [resultado] = await db.query(
    "INSERT INTO comidas (tipo,nombre,descripcion,precio,imagen,disponible,eliminado) VALUES (?,?,?,?,?,?,0)",
    [tipo, nombre, descripcion, precio, imagen, disponible ? 1 : 0],
  );
  return resultado.insertId;
}
export async function editarComida(id, comida) {
  validarComida(comida);
  const { tipo, nombre, descripcion, precio, imagen = "", disponible } = comida;
  const [resultado] = await db.query(
    "UPDATE comidas SET tipo=?,nombre=?,descripcion=?,precio=?,imagen=?,disponible=COALESCE(?,disponible) WHERE id_comida=? AND eliminado=0",
    [
      tipo,
      nombre,
      descripcion,
      precio,
      imagen,
      disponible === undefined ? null : Number(Boolean(disponible)),
      id,
    ],
  );
  comprobar(resultado.affectedRows > 0, "Comida no encontrada.");
}
export async function cambiarDisponibilidadComida(id, disponible) {
  comprobar(typeof disponible === "boolean", "Disponibilidad inválida.");
  const [resultado] = await db.query(
    "UPDATE comidas SET disponible=? WHERE id_comida=? AND eliminado=0",
    [Number(disponible), id],
  );
  comprobar(resultado.affectedRows > 0, "Comida no encontrada.");
}
export async function eliminarComida(id) {
  return transaccion(async (conexion) => {
    // Mismo orden de bloqueo que al crear pedidos: primero comidas y después pedidos.
    const [[comida]] = await conexion.query(
      "SELECT id_comida FROM comidas WHERE id_comida=? AND eliminado=0 FOR UPDATE",
      [id],
    );
    comprobar(comida, "Comida no encontrada.");
    const [[fila]] = await conexion.query(
      "SELECT COUNT(*) AS cantidad FROM pedidos_comida pc JOIN pedidos p ON pc.id_pedido=p.id_pedidos WHERE pc.id_comida=? AND p.estado IN ('pendiente','preparacion','listo')",
      [id],
    );
    comprobar(Number(fila.cantidad) === 0, "La comida tiene pedidos activos.");
    await conexion.query("UPDATE comidas SET eliminado=1 WHERE id_comida=?", [
      id,
    ]);
  });
}
export async function listarTodasLasComidas() {
  const [filas] = await db.query("SELECT * FROM comidas WHERE eliminado=0");
  return filas;
}

// Los precios y nombres se fijan en el servidor al enviar/editar la comanda.
async function guardarItems(conexion, id, comidas) {
  comprobar(
    Array.isArray(comidas) && comidas.length > 0 && comidas.length <= 500,
    "Agregá comidas al pedido.",
  );
  comprobar(
    new Set(comidas.map((comida) => comida.id_comida)).size === comidas.length,
    "No dupliques comidas.",
  );
  for (const item of comidas) {
    comprobar(
      entero(item.id_comida, 1, Number.MAX_SAFE_INTEGER) &&
        entero(item.cantidad, 1, 99) &&
        (item.notas === undefined ||
          (typeof item.notas === "string" && item.notas.length <= 300)),
      "Revisá cantidades y notas.",
    );
    const [[comida]] = await conexion.query(
      "SELECT * FROM comidas WHERE id_comida=? AND disponible=1 AND eliminado=0 FOR UPDATE",
      [item.id_comida],
    );
    comprobar(comida, "Una comida no está disponible.");
    await conexion.query(
      "INSERT INTO pedidos_comida (id_pedido,id_comida,cantidad,notas,nombre_comida,precio_unitario) VALUES (?,?,?,?,?,?)",
      [
        id,
        item.id_comida,
        item.cantidad,
        item.notas ?? "",
        comida.nombre,
        comida.precio,
      ],
    );
  }
}

export async function crearPedido(id_mesa, comidas, mozo_id, mozo_nombre) {
  comprobar(
    texto(mozo_id, 200) && texto(mozo_nombre, 80),
    "Indicá el mozo local del pedido.",
  );
  return transaccion(async (conexion) => {
    const [[mesa]] = await conexion.query(
      "SELECT * FROM mesas WHERE id_mesa=? AND eliminado=0 FOR UPDATE",
      [id_mesa],
    );
    comprobar(
      mesa && mesa.estado === "ocupada",
      "Abrí la mesa antes de crear el pedido.",
    );
    const ahora = new Date();
    const historial = [
      { status: "pendiente", at: ahora.toISOString(), actor: mozo_nombre },
    ];
    const [resultado] = await conexion.query(
      "INSERT INTO pedidos (id_mesa,id_mesero,estado,numero_mesa,servicio_id,mozo_id,mozo_nombre,creado_en,historial) VALUES (?,NULL,'pendiente',?,?,?,?,?,?)",
      [
        id_mesa,
        mesa.numero,
        mesa.servicio_id,
        mozo_id,
        mozo_nombre,
        ahora,
        JSON.stringify(historial),
      ],
    );
    await guardarItems(conexion, resultado.insertId, comidas);
    return resultado.insertId;
  });
}

export async function editarPedido(id, comidas) {
  return transaccion(async (conexion) => {
    const [[pedido]] = await conexion.query(
      "SELECT * FROM pedidos WHERE id_pedidos=? FOR UPDATE",
      [id],
    );
    comprobar(
      pedido?.estado === "pendiente",
      "Solo se pueden editar pedidos pendientes.",
    );
    await conexion.query("DELETE FROM pedidos_comida WHERE id_pedido=?", [id]);
    await guardarItems(conexion, id, comidas);
  });
}

export async function cambiarEstadoPedido(id, estado, actor) {
  comprobar(texto(actor, 80), "Indicá quién cambia el estado.");
  return transaccion(async (conexion) => {
    // Bloquear mesa antes del pedido evita carreras con el cierre de mesa.
    const [[referencia]] = await conexion.query(
      "SELECT id_mesa FROM pedidos WHERE id_pedidos=?",
      [id],
    );
    comprobar(referencia, "Pedido no encontrado.");
    await conexion.query(
      "SELECT id_mesa FROM mesas WHERE id_mesa=? FOR UPDATE",
      [referencia.id_mesa],
    );
    const [[pedido]] = await conexion.query(
      "SELECT * FROM pedidos WHERE id_pedidos=? FOR UPDATE",
      [id],
    );
    comprobar(
      estados[pedido.estado]?.includes(estado),
      "Transición de estado inválida.",
    );
    const historial = [
      ...leerHistorial(pedido.historial),
      { status: estado, at: new Date().toISOString(), actor },
    ];
    await conexion.query(
      "UPDATE pedidos SET estado=?,historial=? WHERE id_pedidos=?",
      [estado, JSON.stringify(historial), id],
    );
  });
}

export async function listarTodosLosPedidos() {
  const [filas] = await db.query(`SELECT p.*, pc.id_comida,pc.cantidad,pc.notas,
    COALESCE(pc.nombre_comida,c.nombre) AS comida_nombre,
    COALESCE(pc.precio_unitario,c.precio) AS precio
    FROM pedidos p LEFT JOIN pedidos_comida pc ON p.id_pedidos=pc.id_pedido
    LEFT JOIN comidas c ON pc.id_comida=c.id_comida ORDER BY p.id_pedidos DESC`);
  return filas;
}
