# Diagnóstico contra la consigna y diseño del control de stock

Revisión del 28/10/2026 sobre el código (modo A: con acceso al repo). Cuando el código
contradice el resumen anterior, manda el código. "A verificar" = no se pudo comprobar acá.

## 1. Estado por requisito (Pereyra)

| Requisito | Estado | Evidencia | Cómo decirlo |
| --- | --- | --- | --- |
| A1 Pedido a domicilio con dirección e indicaciones | Cumple | `repartos.crearEnvio`, tabla `envios` | "El mozo carga destinatario, dirección e indicaciones; se guarda en `envios`." |
| A2 Estados en preparación / en camino / entregado | Cumple | `pedidos.estado` + `envios.estado` (pendiente → en_camino → entregado) | "Dos máquinas de estado: la de cocina y la del reparto." |
| A3 Asignación de repartidor | Cumple | `requiere_repartidor`, valida rol y cuenta activa con `FOR UPDATE` | "Solo se asigna un repartidor activo; solo él puede retirar y entregar." |
| A4 Costo por modalidad extensible sin tocar el core | Cumple | Tabla `modalidades_envio` editable desde Admin; `envio_modalidad.costo` congela la tarifa | "Una modalidad nueva es una fila, no código." |
| B1 Tarjeta / MercadoPago / transferencia | Parcial | Checkout Pro (el checkout de MP ofrece tarjeta y dinero en cuenta). Solo se probó con saldo de prueba. Transferencia bancaria: no hay pasarela | "Integramos MP; la pasarela es un registro de adaptadores, sumar otra es un objeto con 4 funciones." |
| B2 Cobros y reembolsos | Cumple | `pagos.iniciarPago / consultarPago / reembolsarPago`, claves de idempotencia | "El importe lo calcula el servidor; el reembolso no se duplica." |
| B3 Sin pago aprobado no va a cocina ni se despacha | Parcial (decisión) | `exigirPago` solo si `pago_requerido=1`: delivery y retiro sí, **mesas no** | Defender: en salón se cobra al final (ver §4). Preguntar a Pereyra. |
| C1 Descuento automático al confirmar | **Falta** | `comida_stock` no tiene cantidad por plato | Ver diseño §5. |
| C2 Validar disponibilidad (no se puede elegir sin stock) | Parcial | Solo `comidas.disponible` manual (chef/admin) | "Hoy el chef marca agotado; falta calcularlo del stock." |
| C3 Reposición si se cancela antes de despachar | **Falta** | — | Ver diseño §5. |

## 2. Criterios de evaluación

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Funcionalidad / sin errores / responsive | Parcial | Circuito completo probado; stock incompleto. Responsive verificado a 375 px sin scroll horizontal. |
| Escalabilidad: modularidad, versionado, docs | Cumple | Módulos por dominio, migraciones repetibles, ramas por etapa, docs por tema. |
| Estándares: validación, usabilidad | Cumple | Validación en backend en cada ruta; permisos por rol en backend. |
| Usabilidad: claro/oscuro, espacio, orden | Cumple (nuevo) | Modo oscuro con contraste AA verificado en todas las pantallas. |
| BD: seguridad, 3FN, SQL relacional | Parcial | FKs, CHECKs, transacciones, consultas parametrizadas. Ver §3. |

## 3. Normalización: qué defender y qué corregir

- **Desnormalización intencional (instantáneas históricas):** `pedidos_comida.precio_unitario` y
  `nombre_comida`, `envio_modalidad.costo`, `pedidos.numero_mesa`, `pedidos.mozo_nombre`,
  `envios.repartidor_nombre`. Justificación: el pedido debe mostrar lo que se cobró y quién lo
  atendió aunque después cambie el precio, la mesa se renumere o la cuenta se edite.
- **Débil de verdad:**
  - `envios.repartidor_id` y `pedidos.mozo_id` son `VARCHAR` **sin FK** a `usuarios`
    (`pedidos.id_mesero` sí tiene FK). Próximo paso: FK `INT` aditiva.
  - `pedidos.historial` es JSON en `LONGTEXT`: un atributo multivaluado (no cumple 1FN en
    sentido estricto). Se defiende como registro de auditoría de solo-agregar; la alternativa
    normalizada es una tabla `pedidos_estados`.
  - Nombres: `Unidades` y `Stock` con mayúscula frente al resto en minúscula. En Windows da
    igual; en Linux distingue. Se dejaron así porque Elías los pidió "exactamente"; renombrar
    a minúsculas es un cambio a acordar con él.

## 4. Decisiones a defender

**"El cliente podrá realizar pedidos".** NÁCAR es un sistema interno: el cliente pide al mozo
(en la mesa o por teléfono/mensaje para delivery) y el mozo lo registra; el cliente participa
pagando desde su teléfono con el QR o el enlace, sin crear cuenta. Elegimos esto porque evita
exponer un registro público y datos personales, y porque el circuito de validación
(stock, pago, cocina) es el mismo: una pantalla pública sería otra vista sobre la misma API.
Preguntas para Pereyra: ¿espera una pantalla pública de pedidos o alcanza con que el cliente
pague sin intervención del personal? ¿El pago con QR cuenta como "el cliente realiza el pedido"?

**Mesas sin prepago.** En salón se consume primero y se paga al final; exigir el pago antes de
cocinar obligaría a cobrar cada ronda. Delivery y retiro sí exigen pago aprobado porque el
cliente no está presente. Pregunta: ¿quiere prepago también en mesa? En el backend es poner
`pago_requerido=1` al crear el pedido de mesa; falta verificar que la pantalla de mesa
ofrezca el botón de cobro (a verificar).

**Pasarelas.** `pasarelas.js` es un registro `Map` de adaptadores con `preparar`, `crear`,
`consultar`, `reembolsar` y `cancelar`. Una transferencia con confirmación manual sería un
adaptador cuyo `crear` devuelve los datos del CBU/alias y cuyo `consultar` lee un estado que
el admin marca a mano. No se tocan `pagos.js` ni las rutas.

## 5. Diseño propuesto de stock (ESPERA APROBACIÓN, no está implementado)

### Esquema (migración aditiva y repetible)

1. `comida_stock.cantidad_requerida DECIMAL(12,3) NOT NULL DEFAULT 1 CHECK (> 0)`, en la unidad
   del insumo. Es un atributo de la relación plato–insumo: depende de la clave completa
   `(id_comida, id_stock)` → 3FN. **A confirmar con Elías** (altera la tabla acordada; el
   validador de `migrate-stock.js` exige hoy exactamente dos columnas y hay que actualizarlo).
2. Tabla nueva `movimientos_stock` (**a confirmar con Elías**):
   `id_movimiento PK`, `id_pedido FK`, `id_stock FK`, `tipo` (`consumo` | `reposicion` |
   `ajuste`), `cantidad DECIMAL(12,3) > 0`, `creado_en`, `id_usuario FK NULL`, con
   `UNIQUE (id_pedido, id_stock, tipo)`. Guarda lo que **realmente** se descontó: si después
   cambia la receta, la reposición devuelve exactamente eso. El `UNIQUE` impide reponer dos
   veces. Cada fila depende solo de su clave → 3FN.

### Reglas

- **Cuándo se descuenta:** al registrar el pedido (mesa) o el envío (delivery/retiro), dentro
  de la misma transacción. Es el momento en que la cocina lo ve. En delivery funciona como
  reserva: si el cliente nunca paga y se cancela, se repone.
- **Edición de un pedido pendiente:** se repone lo consumido y se vuelve a descontar con los
  ítems nuevos, en una transacción (si no alcanza, no se guarda nada).
- **Concurrencia:** `SELECT ... FROM Stock WHERE id_stock IN (...) ORDER BY id_stock FOR UPDATE`
  (orden fijo para evitar deadlocks), se valida `cantidad >= requerido` y recién ahí `UPDATE`.
  Dos mozos con el último plato: el segundo espera el bloqueo, relee y recibe "Sin stock de X".
  El `CHECK (cantidad >= 0)` queda como última defensa.
- **Cancelación:** cualquier cancelación posible (siempre es antes de entregado/en camino)
  repone desde `movimientos_stock`; las tres rutas de cancelación (`cambiarEstadoPedido`,
  `reembolsarPago`, `cancelarConBloqueo`) llaman a la misma función. Dos cancelaciones no
  duplican gracias al `UNIQUE`.
- **Plato sin receta:** se puede vender (no descuenta) y el admin ve el aviso "Sin receta: no
  descuenta stock". Bloquearlo rompería la demo con platos ya cargados.
- **Disponibilidad en la UI:** `listarTodasLasComidas` devuelve `porciones_disponibles =
  MIN(FLOOR(Stock.cantidad / cantidad_requerida))`. Con 0 el plato queda deshabilitado con el
  motivo "Sin stock: falta Carne". El backend vuelve a validar al guardar.
- **ABM de inventario (solo admin):** unidades, insumos, ajuste de cantidad (registrado como
  `ajuste`) y receta de cada plato. Validación en formulario y en backend.

### Pruebas a escribir

Descuento al crear, rechazo por falta de stock sin cambios parciales, edición, cancelación,
doble cancelación, reembolso que repone, dos pedidos simultáneos por la última unidad.

**Esfuerzo:** 1,5 a 2 días. **Riesgo:** alto (toca crear/editar/cancelar). **Dueño sugerido:**
Laureano (bloque de base de datos).

## 6. Pendientes fuera de esta revisión

- Rotar las claves que estuvieron en el historial (ver `backend/ACCESOS-EQUIPO.md`).
- CSP (Content-Security-Policy): requiere permitir Google Fonts y el script inline del tema.
- Webhook de Mercado Pago (hoy consulta cada 10 s con el diálogo abierto).
- FK de `repartidor_id`; prueba end-to-end automatizada del circuito completo.
- Confirmar con el equipo si se borran `frontend/src/mocks/restaurant.ts` (no se importa en
  ningún lado) y `frontend/src.zip` (subido el 22/10).
