import assert from "node:assert/strict";
import { registrarPasarela } from "../modules/pasarelas.js";

export async function probarPagos(request, db, clientes) {
  const remotos = new Map();
  let enlaces = 0;
  let fallarReembolso = false;
  registrarPasarela("prueba_pagos", {
    crear: async (pago) => {
      enlaces++;
      return {
        preferencia_id: pago.id_pago,
        checkout_url: "https://www.mercadopago.com.ar/checkout-prueba",
      };
    },
    consultar: async (pago) => ({
      estado: remotos.get(pago.id_pago) || "pendiente",
      referencia_pasarela: pago.id_pago,
      metodo: "visa",
    }),
    reembolsar: async (pago) => {
      if (fallarReembolso) throw new Error("Demora de prueba de la pasarela.");
      return { reembolso_id: `refund-${pago.id_pago}` };
    },
    cancelar: async () => ({ estado: "cancelado" }),
  });
  const plato = await request(
    "POST",
    "/comidas",
    {
      tipo: "Principales",
      nombre: "Prueba pagos",
      descripcion: "",
      precio: 1234.56,
      disponible: true,
    },
    201,
  );
  const datos = {
    destinatario: "Cliente de prueba",
    direccion: "Dirección de prueba",
    indicaciones: "",
    modalidad: "retiro_local",
    comidas: [{ id_comida: plato.id_comida, cantidad: 2 }],
  };
  const crear = async (extra = {}) =>
    (await request("POST", "/envios", { ...datos, ...extra }, 201)).id_pedido;
  const id = await crear();
  const [[envio]] = await db.query("SELECT * FROM envios WHERE id_pedido=?", [
    id,
  ]);
  assert.equal(envio.direccion, null);
  assert.equal(envio.repartidor_id, null);
  await request("POST", "/envios", { ...datos, modalidad: "cadeteria" }, 400);
  await request("PUT", "/modalidades-envio/cadeteria", {
    nombre: "Cadetería externa",
    costo: "500.25",
    requiere_direccion: true,
    requiere_repartidor: false,
    activo: true,
  });
  const externo = await crear({
    modalidad: "cadeteria",
    costo_confirmado: "500.25",
  });
  await request("PUT", "/modalidades-envio/cadeteria", {
    nombre: "Cadetería externa",
    costo: "900.00",
    requiere_direccion: true,
    requiere_repartidor: false,
    activo: true,
  });
  const [[snapshot]] = await db.query(
    "SELECT costo FROM envio_modalidad WHERE id_pedido=?",
    [externo],
  );
  assert.equal(snapshot.costo, "500.25");
  await request(
    "POST",
    "/envios",
    { ...datos, modalidad: "cadeteria", costo_confirmado: "1.00" },
    400,
  );
  await request(
    "PUT",
    "/modalidades-envio/cadeteria",
    {
      nombre: "Cambio de circuito",
      costo: "900.00",
      requiere_direccion: false,
      requiere_repartidor: false,
      activo: true,
    },
    400,
  );
  await request("PUT", "/modalidades-envio/bicicleta", {
    nombre: "Bicicleta",
    costo: "50.01",
    requiere_direccion: true,
    requiere_repartidor: true,
    activo: true,
  });
  const nuevo = await crear({
    modalidad: "bicicleta",
    repartidor_id: clientes.usuarios.repartidor.id,
  });
  assert.ok(nuevo);
  await request("POST", `/pagos/${id}`, { proveedor: "no_existe" }, 400);
  const [a, b] = await Promise.all([
    request("POST", `/pagos/${id}`, { proveedor: "prueba_pagos" }),
    request("POST", `/pagos/${id}`, { proveedor: "prueba_pagos" }),
  ]);
  assert.equal(a.id_pago, b.id_pago);
  assert.equal(enlaces, 1, "Dos clics no crean dos enlaces");
  assert.equal(a.importe, "2469.12");
  await request("PUT", `/pedidos/${id}`, { comidas: datos.comidas }, 400);
  await request(
    "PATCH",
    `/pedidos/${id}/estado`,
    { estado: "preparacion" },
    400,
  );
  remotos.set(a.id_pago, "rechazado");
  assert.equal((await request("GET", `/pagos/${id}`)).estado, "rechazado");
  await request(
    "PATCH",
    `/pedidos/${id}/estado`,
    { estado: "preparacion" },
    400,
  );
  remotos.set(a.id_pago, "aprobado");
  assert.equal((await request("GET", `/pagos/${id}`)).estado, "aprobado");
  for (const estado of ["preparacion", "listo"])
    await request("PATCH", `/pedidos/${id}/estado`, { estado });
  await request(
    "PATCH",
    `/envios/${id}/estado`,
    { estado: "entregado" },
    400,
    "repartidor",
  );
  await request(
    "PATCH",
    `/envios/${id}/estado`,
    { estado: "entregado" },
    200,
    "mozo",
  );
  await request("POST", `/pagos/${id}/reembolsar`, {}, 400);
  const pExterno = await request("POST", `/pagos/${externo}`, {
    proveedor: "prueba_pagos",
  });
  assert.equal(pExterno.importe, "2969.37");
  remotos.set(pExterno.id_pago, "aprobado");
  await request("GET", `/pagos/${externo}`);
  for (const estado of ["preparacion", "listo"])
    await request("PATCH", `/pedidos/${externo}/estado`, { estado });
  await request(
    "PATCH",
    `/envios/${externo}/estado`,
    { estado: "en_camino" },
    200,
    "mozo",
  );
  await request("POST", `/pagos/${externo}/reembolsar`, {}, 400);
  await request(
    "PATCH",
    `/envios/${externo}/estado`,
    { estado: "entregado" },
    200,
    "mozo",
  );
  const cancelar = await crear();
  const pCancelar = await request("POST", `/pagos/${cancelar}`, {
    proveedor: "prueba_pagos",
  });
  remotos.set(pCancelar.id_pago, "aprobado");
  await request("GET", `/pagos/${cancelar}`);
  fallarReembolso = true;
  await request("POST", `/pagos/${cancelar}/reembolsar`, {}, 400);
  const [[retenido]] = await db.query(
    "SELECT p.estado,pg.estado AS pago FROM pedidos p JOIN pagos pg ON pg.id_pedido=p.id_pedidos WHERE p.id_pedidos=?",
    [cancelar],
  );
  assert.equal(retenido.estado, "cancelado");
  assert.equal(retenido.pago, "reembolsando");
  await request(
    "PATCH",
    `/pedidos/${cancelar}/estado`,
    { estado: "preparacion" },
    400,
  );
  fallarReembolso = false;
  const devuelto = await request("POST", `/pagos/${cancelar}/reembolsar`, {});
  assert.equal(devuelto.estado, "reembolsado");
  assert.equal(
    (await request("POST", `/pagos/${cancelar}/reembolsar`, {})).reembolso_id,
    devuelto.reembolso_id,
  );
  await request("GET", `/pagos/${id}`, undefined, 403, "repartidor");
  const sinPagar = await crear();
  await request("POST", `/pagos/${sinPagar}`, { proveedor: "prueba_pagos" });
  assert.equal(
    (await request("POST", `/pagos/${sinPagar}/cancelar`, {})).estado,
    "cancelado",
  );
  assert.equal(
    (await request("POST", `/pagos/${sinPagar}/cancelar`, {})).estado,
    "cancelado",
  );
  await request(
    "PATCH",
    `/pedidos/${sinPagar}/estado`,
    { estado: "preparacion" },
    400,
  );
  // Una consulta atrasada no revive un cobro cancelado.
  assert.equal(
    (await request("GET", `/pagos/${sinPagar}`)).estado,
    "cancelado",
  );
  const [[pTardio]] = await db.query(
    "SELECT id_pago FROM pagos WHERE id_pedido=?",
    [sinPagar],
  );
  remotos.set(pTardio.id_pago, "aprobado");
  assert.equal(
    (await request("GET", `/pagos/${sinPagar}`)).estado,
    "reembolsado",
  );
  const [[historia]] = await db.query(
    "SELECT historial FROM pedidos WHERE id_pedidos=?",
    [sinPagar],
  );
  assert.equal(
    JSON.parse(historia.historial).filter((h) => h.status === "cancelado")
      .length,
    1,
  );
  console.log(
    "OK pagos/modalidades: tarifas, snapshots, retiro/cadetería, importes exactos, pago obligatorio, aprobación/rechazo, reembolso fallido y reintentos.",
  );
}
