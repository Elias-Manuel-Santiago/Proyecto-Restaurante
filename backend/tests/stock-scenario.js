import assert from "node:assert/strict";
import { registrarPasarela } from "../modules/pasarelas.js";

// Control de stock de punta a punta contra la API real y una base aislada.
export async function probarStock(request, db) {
  const aprobados = new Set();
  registrarPasarela("prueba_stock", {
    crear: async (pago) => ({
      preferencia_id: pago.id_pago,
      checkout_url: "https://www.mercadopago.com.ar/checkout-prueba",
    }),
    consultar: async (pago) => ({
      estado: aprobados.has(pago.id_pago) ? "aprobado" : "pendiente",
      referencia_pasarela: pago.id_pago,
    }),
    reembolsar: async (pago) => ({ reembolso_id: `refund-${pago.id_pago}` }),
    cancelar: async () => ({ estado: "cancelado" }),
  });
  const existencias = async () => {
    const [filas] = await db.query(
      "SELECT nombre,cantidad FROM Stock WHERE nombre IN ('Carne','Pan')",
    );
    return Object.fromEntries(filas.map((f) => [f.nombre, f.cantidad]));
  };
  const porciones = async (id) =>
    (await request("POST", "/comidas/obtener", {})).find(
      (comida) => comida.id_comida === id,
    );

  // Inventario: solo admin, con validación en backend.
  await request("GET", "/inventario", undefined, 403, "mozo");
  await request("GET", "/inventario", undefined, 403, "chef");
  await request("POST", "/inventario/unidades", { nombre: "  " }, 400);
  const { id_unidad: gramos } = await request(
    "POST",
    "/inventario/unidades",
    { nombre: "g" },
    201,
  );
  await request("POST", "/inventario/unidades", { nombre: "g" }, 400);
  const { id_unidad: unidades } = await request(
    "POST",
    "/inventario/unidades",
    { nombre: "unidad" },
    201,
  );
  const { id_stock: carne } = await request(
    "POST",
    "/inventario/insumos",
    { nombre: "Carne", id_unidad: gramos, cantidad: 500 },
    201,
  );
  const { id_stock: pan } = await request(
    "POST",
    "/inventario/insumos",
    { nombre: "Pan", id_unidad: unidades, cantidad: 3 },
    201,
  );
  await request(
    "POST",
    "/inventario/insumos",
    { nombre: "Carne", id_unidad: gramos },
    400,
  );
  await request(
    "POST",
    "/inventario/insumos",
    { nombre: "Sal", id_unidad: gramos, cantidad: -1 },
    400,
  );
  const plato = async (nombre) =>
    (
      await request(
        "POST",
        "/comidas",
        {
          tipo: "Principales",
          nombre,
          descripcion: "",
          precio: 1000,
          disponible: true,
        },
        201,
      )
    ).id_comida;
  const hamburguesa = await plato("Hamburguesa de stock");
  const agua = await plato("Agua sin receta");
  await request(
    "PUT",
    `/inventario/recetas/${hamburguesa}`,
    { insumos: [{ id_stock: carne, cantidad_requerida: 0 }] },
    400,
  );
  await request(
    "PUT",
    `/inventario/recetas/${hamburguesa}`,
    {
      insumos: [
        { id_stock: carne, cantidad_requerida: 1 },
        { id_stock: carne, cantidad_requerida: 2 },
      ],
    },
    400,
  );
  await request("PUT", `/inventario/recetas/${hamburguesa}`, {
    insumos: [
      { id_stock: carne, cantidad_requerida: 150 },
      { id_stock: pan, cantidad_requerida: 1 },
    ],
  });
  assert.equal((await porciones(hamburguesa)).porciones_disponibles, 3);
  assert.equal((await porciones(agua)).porciones_disponibles, null);

  // Mesa: descuenta al registrar, ajusta al editar y no deja cambios parciales.
  const { id_mesa } = await request(
    "POST",
    "/mesas",
    { numero: 77, cantidad_personas: 4 },
    201,
  );
  await request("PATCH", `/mesas/${id_mesa}/abrir`, { comensales: 2 });
  const pedir = (comidas, status = 201) =>
    request("POST", "/pedidos", { id_mesa, comidas }, status);
  const { id_pedido: pedido } = await pedir([
    { id_comida: hamburguesa, cantidad: 2 },
    { id_comida: agua, cantidad: 1 },
  ]);
  assert.deepEqual(await existencias(), { Carne: "200.000", Pan: "1.000" });
  await request("PUT", `/pedidos/${pedido}`, {
    comidas: [{ id_comida: hamburguesa, cantidad: 3 }],
  });
  assert.deepEqual(await existencias(), { Carne: "50.000", Pan: "0.000" });
  const [consumos] = await db.query(
    "SELECT id_stock,cantidad FROM movimientos_stock WHERE id_pedido=? AND tipo='consumo' ORDER BY id_stock",
    [pedido],
  );
  assert.deepEqual(
    consumos.map((m) => m.cantidad),
    ["450.000", "3.000"],
    "La edición actualiza lo reservado, no suma otro consumo",
  );
  const [[{ antes }]] = await db.query("SELECT COUNT(*) AS antes FROM pedidos");
  const rechazo = await pedir(
    [
      { id_comida: agua, cantidad: 1 },
      { id_comida: hamburguesa, cantidad: 1 },
    ],
    400,
  );
  assert.match(rechazo.message, /Sin stock suficiente de Carne/);
  const [[{ despues }]] = await db.query(
    "SELECT COUNT(*) AS despues FROM pedidos",
  );
  assert.equal(despues, antes, "El pedido rechazado no queda guardado");
  assert.deepEqual(await existencias(), { Carne: "50.000", Pan: "0.000" });
  const agotada = await porciones(hamburguesa);
  assert.equal(agotada.porciones_disponibles, 0);
  assert.equal(agotada.insumo_faltante, "Carne");
  await request(
    "PUT",
    `/pedidos/${pedido}`,
    { comidas: [{ id_comida: hamburguesa, cantidad: 4 }] },
    400,
  );
  assert.deepEqual(await existencias(), { Carne: "50.000", Pan: "0.000" });
  await request("PUT", `/pedidos/${pedido}`, {
    comidas: [{ id_comida: hamburguesa, cantidad: 1 }],
  });
  assert.deepEqual(await existencias(), { Carne: "350.000", Pan: "2.000" });

  // Cambiar la receta no altera lo que el pedido ya descontó.
  await request("PUT", `/inventario/recetas/${hamburguesa}`, {
    insumos: [
      { id_stock: carne, cantidad_requerida: 100 },
      { id_stock: pan, cantidad_requerida: 1 },
    ],
  });
  await request("PATCH", `/pedidos/${pedido}/estado`, { estado: "cancelado" });
  assert.deepEqual(await existencias(), { Carne: "500.000", Pan: "3.000" });
  await request(
    "PATCH",
    `/pedidos/${pedido}/estado`,
    { estado: "cancelado" },
    400,
  );
  assert.deepEqual(
    await existencias(),
    { Carne: "500.000", Pan: "3.000" },
    "Una segunda cancelación no repone dos veces",
  );

  // Ajustes manuales con su registro.
  await request("POST", `/inventario/insumos/${carne}/ajuste`, { cantidad: 0 }, 400);
  await request(
    "POST",
    `/inventario/insumos/${carne}/ajuste`,
    { cantidad: -501 },
    400,
  );
  assert.equal(
    (
      await request("POST", `/inventario/insumos/${carne}/ajuste`, {
        cantidad: -400,
      })
    ).cantidad,
    "100.000",
  );

  // Mesa y envío piden la última porción a la vez: solo uno la obtiene.
  const carrera = await Promise.allSettled([
    pedir([{ id_comida: hamburguesa, cantidad: 1 }]),
    request(
      "POST",
      "/envios",
      {
        destinatario: "Carrera",
        modalidad: "retiro_local",
        comidas: [{ id_comida: hamburguesa, cantidad: 1 }],
      },
      201,
    ),
  ]);
  assert.equal(
    carrera.filter((r) => r.status === "fulfilled").length,
    1,
    "Solo un pedido consigue la última porción",
  );
  assert.match(
    carrera.find((r) => r.status === "rejected").reason.message,
    /Sin stock suficiente de Carne/,
  );
  assert.equal((await existencias()).Carne, "0.000");

  // Envío pagado y reembolsado: reembolsar cancela y repone una sola vez.
  await request("POST", `/inventario/insumos/${carne}/ajuste`, { cantidad: 300 });
  const envio = async () =>
    (
      await request(
        "POST",
        "/envios",
        {
          destinatario: "Cliente stock",
          modalidad: "retiro_local",
          comidas: [{ id_comida: hamburguesa, cantidad: 2 }],
        },
        201,
      )
    ).id_pedido;
  const pagado = await envio();
  assert.equal((await existencias()).Carne, "100.000");
  const pago = await request("POST", `/pagos/${pagado}`, {
    proveedor: "prueba_stock",
  });
  aprobados.add(pago.id_pago);
  assert.equal((await request("GET", `/pagos/${pagado}`)).estado, "aprobado");
  await request("POST", `/pagos/${pagado}/reembolsar`, {});
  await request("POST", `/pagos/${pagado}/reembolsar`, {});
  assert.equal((await existencias()).Carne, "300.000");

  // Envío sin pagar cancelado desde el cobro: también repone.
  const sinPagar = await envio();
  await request("POST", `/pagos/${sinPagar}`, { proveedor: "prueba_stock" });
  await request("POST", `/pagos/${sinPagar}/cancelar`, {});
  await request("POST", `/pagos/${sinPagar}/cancelar`, {});
  assert.equal((await existencias()).Carne, "300.000");

  const inventario = await request("GET", "/inventario");
  assert.equal(inventario.insumos.length, 2);
  assert.equal(
    inventario.recetas.filter((r) => r.id_comida === hamburguesa).length,
    2,
  );
  const tipos = new Set(inventario.movimientos.map((m) => m.tipo));
  assert.deepEqual(
    [...tipos].sort(),
    ["ajuste", "consumo", "reposicion"],
  );
  const [[{ duplicadas }]] = await db.query(
    "SELECT COUNT(*) AS duplicadas FROM (SELECT id_pedido,id_stock FROM movimientos_stock WHERE tipo='reposicion' GROUP BY id_pedido,id_stock HAVING COUNT(*)>1) d",
  );
  assert.equal(duplicadas, 0);
  console.log(
    "OK stock: recetas, descuento, edición, rechazo sin cambios parciales, cancelación, reembolso, ajustes y última porción concurrente.",
  );
}
