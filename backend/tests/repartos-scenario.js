import assert from "node:assert/strict";

export async function probarRepartos(request, db, clientes) {
  const comida = await request(
    "POST",
    "/comidas",
    {
      tipo: "Principales",
      nombre: "Prueba SQL reparto",
      descripcion: "",
      precio: 1250,
      disponible: true,
    },
    201,
  );
  const datos = {
    destinatario: "Destinatario de prueba",
    direccion: "Dirección de prueba 123",
    indicaciones: "Timbre",
    repartidor_id: clientes.usuarios.repartidor.id,
    repartidor_nombre: "Repartidor de prueba",
    mozo_id: "mozo-test",
    mozo_nombre: "Mozo de prueba",
    comidas: [{ id_comida: comida.id_comida, cantidad: 2, notas: "Sin sal" }],
  };
  const cantidad = async () =>
    (await db.query("SELECT COUNT(*) AS n FROM pedidos"))[0][0].n;
  const antes = await cantidad();
  await request("POST", "/envios", { ...datos, direccion: " " }, 400);
  await request(
    "POST",
    "/envios",
    { ...datos, comidas: [{ id_comida: comida.id_comida, cantidad: 0 }] },
    400,
  );
  assert.equal(
    await cantidad(),
    antes,
    "Un envío inválido no deja pedidos huérfanos",
  );
  const { id_pedido: id } = await request("POST", "/envios", datos, 201);
  const [[pedido]] = await db.query(
    "SELECT * FROM pedidos WHERE id_pedidos=?",
    [id],
  );
  assert.equal(pedido.id_mesa, null, "Delivery no ocupa una mesa ficticia");
  let filas = await request("POST", "/envios/obtener", {
    repartidor_id: datos.repartidor_id,
  });
  assert.equal(filas.length, 1);
  assert.equal(filas[0].cantidad, 2);
  assert.equal(filas[0].nombre_comida, "Prueba SQL reparto");
  assert.deepEqual(
    await request(
      "POST",
      "/envios/obtener",
      { repartidor_id: datos.repartidor_id },
      200,
      "otro_repartidor",
    ),
    [],
  );
  assert.equal(
    (await request("POST", "/envios/obtener", { repartidor_id: "' OR 1=1 --" }))
      .length,
    1,
    "El servidor usa la identidad de la sesión, no el filtro falsificado",
  );
  const cambiar = (estado, status = 200, repartidor_id = datos.repartidor_id) =>
    request(
      "PATCH",
      `/envios/${id}/estado`,
      { estado, repartidor_id, actor: "Repartidor de prueba" },
      status,
      repartidor_id === datos.repartidor_id ? "repartidor" : "otro_repartidor",
    );
  await cambiar("en_camino", 400);
  await request("PUT", `/pedidos/${id}`, { comidas: datos.comidas });
  for (const estado of ["preparacion", "listo"])
    await request("PATCH", `/pedidos/${id}/estado`, { estado, actor: "Chef" });
  await request(
    "PATCH",
    `/pedidos/${id}/estado`,
    { estado: "entregado", actor: "Mozo" },
    400,
  );
  await cambiar("entregado", 400);
  await cambiar("en_camino", 400, "otro");
  await Promise.all([cambiar("en_camino"), cambiar("en_camino")]);
  const [[retirado]] = await db.query(
    "SELECT retirado_en FROM envios WHERE id_pedido=?",
    [id],
  );
  await request(
    "PATCH",
    `/pedidos/${id}/estado`,
    { estado: "cancelado", actor: "Mozo" },
    400,
  );
  await Promise.all([cambiar("entregado"), cambiar("entregado")]);
  const [[final]] = await db.query(
    "SELECT e.*,p.estado AS estado_pedido,p.historial FROM envios e JOIN pedidos p ON p.id_pedidos=e.id_pedido WHERE e.id_pedido=?",
    [id],
  );
  assert.equal(final.estado, "entregado");
  assert.equal(final.estado_pedido, "entregado");
  assert.equal(final.retirado_en.getTime(), retirado.retirado_en.getTime());
  assert.ok(final.entregado_en);
  assert.equal(
    JSON.parse(final.historial).length,
    4,
    "Reintentos no duplican historial",
  );
  filas = await request("POST", "/envios/obtener", {
    repartidor_id: datos.repartidor_id,
  });
  assert.equal(
    filas[0].estado,
    "entregado",
    "Una nueva consulta recupera lo guardado en SQL",
  );
  const cancelado = await request("POST", "/envios", datos, 201);
  await request("PATCH", `/pedidos/${cancelado.id_pedido}/estado`, {
    estado: "cancelado",
    actor: "Mozo",
  });
  assert.equal(
    (
      await request("POST", "/envios/obtener", {
        repartidor_id: datos.repartidor_id,
      })
    ).length,
    1,
  );
  await request(
    "PATCH",
    `/envios/${cancelado.id_pedido}/estado`,
    {
      estado: "en_camino",
      repartidor_id: datos.repartidor_id,
      actor: "Repartidor",
    },
    400,
  );
  console.log(
    "OK reparto: creación, cocina, asignación, SQL, cancelación, rollback, consultas parametrizadas y reintentos concurrentes.",
  );
}
