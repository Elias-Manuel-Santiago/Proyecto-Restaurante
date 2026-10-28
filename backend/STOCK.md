# Control de stock (Parte C)

Cada plato puede tener una **receta**: qué insumos usa y cuánto por porción. Al registrar
un pedido se descuentan esos insumos; si no alcanzan, el pedido no se guarda. Al
cancelarlo antes del despacho, se devuelve exactamente lo descontado.

## Esquema (16 tablas)

| Tabla               | Qué guarda                                                                    |
| ------------------- | ----------------------------------------------------------------------------- |
| `Unidades`          | g, kg, unidad, litro… (sin conversiones automáticas)                          |
| `Stock`             | cada insumo con su existencia `DECIMAL(12,3)`, `CHECK (cantidad >= 0)`        |
| `comida_stock`      | receta: `cantidad_requerida` por porción, `CHECK (> 0)`, PK `(id_comida,id_stock)` |
| `movimientos_stock` | `consumo`, `reposicion` o `ajuste`, con pedido, usuario y fecha               |

- `cantidad_requerida` depende de la clave completa `(id_comida, id_stock)`: es un
  atributo de la relación plato–insumo (3FN).
- `movimientos_stock` guarda lo que **realmente** se descontó. Si después cambia la
  receta, la cancelación devuelve lo descontado y no lo que diga la receta nueva.
- `UNIQUE (id_pedido, id_stock, tipo)`: un pedido tiene a lo sumo un consumo y una
  reposición por insumo. Es la última defensa contra reponer dos veces.
- CHECK: los ajustes no llevan pedido y los consumos/reposiciones sí; la cantidad
  nunca es cero y solo un ajuste puede ser negativo.

Para bases existentes, `npm run migrate` (o `npm run migrate:stock`) crea
`movimientos_stock` y agrega `comida_stock.cantidad_requerida` con valor 1 a las
recetas que ya existían. No borra ni cambia filas. Si una tabla tiene otra estructura,
la rechaza antes del primer cambio.

## Reglas

| Momento                            | Qué pasa con el stock                                               |
| ---------------------------------- | ------------------------------------------------------------------- |
| Mozo registra pedido de mesa       | Se descuenta en la misma transacción que guarda los ítems           |
| Mozo registra envío o retiro       | Se descuenta (reserva) aunque el pago esté pendiente                |
| Se edita un pedido pendiente       | Solo se descuenta o devuelve la diferencia                          |
| No alcanza un insumo               | Error "Sin stock suficiente de X…" y **no se guarda nada**          |
| Cancelación (cocina, mozo, admin)  | Se repone desde `movimientos_stock`                                 |
| Cancelar cobro / reembolsar        | Mismo `reponerStock`: se repone una sola vez                        |
| Plato sin receta                   | Se vende sin descontar; el admin ve el aviso "Sin receta"           |

Las cancelaciones solo son posibles antes de "en camino" o "entregado", así que el
stock vuelve únicamente si el pedido no salió.

**Concurrencia.** Se bloquean las filas de `Stock` con
`SELECT … ORDER BY id_stock FOR UPDATE` (orden fijo para evitar bloqueos cruzados).
Se valida todo primero y recién después se escribe. Si dos mozos piden la última
porción al mismo tiempo, el segundo espera el bloqueo, relee y recibe el error.
`CHECK (cantidad >= 0)` es la defensa final en la base.

**Disponibilidad.** `POST /api/comidas/obtener` devuelve `porciones_disponibles`
(cuántas porciones permite el insumo más escaso, `NULL` si no tiene receta) e
`insumo_faltante`. La carta muestra "Stock para N porciones" o "Sin stock: falta X",
y el formulario de pedido no deja sumar más porciones de las que alcanzan. El
backend vuelve a validar al guardar. El indicador manual de "Agotado" del chef sigue
funcionando igual.

## API (solo admin)

| Método y ruta                             | Cuerpo                                         |
| ----------------------------------------- | ---------------------------------------------- |
| `GET /api/inventario`                     | — (unidades, insumos, recetas, 30 movimientos) |
| `POST /api/inventario/unidades`           | `nombre`                                       |
| `POST /api/inventario/insumos`            | `nombre`, `id_unidad`, `cantidad` inicial      |
| `PUT /api/inventario/insumos/:id`         | `nombre`, `id_unidad`                          |
| `POST /api/inventario/insumos/:id/ajuste` | `cantidad` (+ compra, − merma)                 |
| `PUT /api/inventario/recetas/:id_comida`  | `insumos: [{ id_stock, cantidad_requerida }]`  |

En la interfaz: **Administración → Inventario y recetas**.

## Pruebas

`tests/stock-scenario.js` (dentro de `npm test`, base temporal) cubre: validaciones,
descuento al crear, edición que ajusta la diferencia, rechazo sin cambios parciales,
porciones y faltante, cambio de receta con pedido abierto, cancelación y doble
cancelación, ajustes, mesa y envío compitiendo por la última porción, reembolso y
cancelación de cobro que reponen una sola vez. `tests/stock.test.js` prueba la
migración en una base nueva y en una con la versión anterior de `comida_stock`.

## Para la demo

`node modules/datos-demo.js` (o `NACAR_DATOS_DEMO=1` online) carga 18 insumos y la
receta de 12 platos; la hamburguesa queda con 900 g de carne picada a 180 g por porción.

1. Admin → Inventario y recetas: con los datos de ejemplo ya está cargado; si no, crear
   la unidad "g", el insumo "Carne" con 900 y la receta de la hamburguesa con 180 g.
   La carta muestra "Stock para 5 porciones".
2. Mozo: pedir 5 hamburguesas. El botón "+" se bloquea y la carta pasa a "Sin stock".
3. Cancelar el pedido: el stock vuelve a 900 y aparece la reposición en
   "Últimos movimientos".
