# Backend del restaurante

API Express con MySQL y consultas parametrizadas. No agrega conexiones de usuarios.

## Ejecutar

```sh
npm ci
npm run migrate
npm start
```

`npm run dev` reinicia el servidor al editar archivos. El puerto predeterminado es
3005; puede cambiarse con `PORT`. La conexión existente está en `modules/db.js` y usa
un pool para las transacciones. `DB_DATABASE` permite elegir otra base.
`FRONTEND_ORIGIN` configura el origen CORS; el valor inicial es `http://localhost:5173`.
Se admite `PATCH`, necesario para estados, disponibilidad y apertura/cierre de mesas.

## Código

- `app.js`: rutas HTTP y un único try/catch por solicitud. Los errores se devuelven
  con sus propiedades, mensaje y stack. Es un manejo simple para esta etapa local.
- `modules/restaurante.js`: operaciones de mesas, comidas y pedidos. Las escrituras
  en varias tablas usan transacciones y revierten ante errores.
- `modules/consultas.js`: consultas de resúmenes y sus posiciones.
- `modules/migrate.js`: migración repetible de los campos que necesita el frontend.

Las rutas y ejemplos de uso se documentan también en `../frontend/README.md`.

## Parámetros principales

| Operación              | Cuerpo JSON                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------- |
| Crear/editar mesa      | `numero`, `cantidad_personas`                                                       |
| Abrir mesa             | `comensales`                                                                        |
| Cerrar mesa            | sin parámetros                                                                      |
| Crear/editar comida    | `tipo`, `nombre`, `descripcion`, `precio`, `imagen`, `disponible`                   |
| Cambiar disponibilidad | `disponible` booleano                                                               |
| Crear pedido           | `id_mesa`, `mozo_id`, `mozo_nombre`, `comidas: [{ id_comida, cantidad, notas }]`    |
| Editar pedido          | `comidas` con el mismo formato; solo mientras esté pendiente                        |
| Cambiar estado         | `estado`, `actor`                                                                   |
| Crear resumen          | `tipo`, `ganancias`, `pedidos`, `pedidos_cancelados`, `comidas_posiciones` opcional |
| Detalle de resumen     | `id_resumen`                                                                        |

Los IDs del restaurante los genera MySQL. `numero` puede omitirse al crear una mesa
para usar el siguiente disponible. Las categorías admitidas para nuevas escrituras
son Entradas, Principales, Postres y Bebidas.

Estados: pendiente → preparacion → listo → entregado. Se permite cancelar cualquiera
de los tres estados activos. No se puede cerrar una mesa con pedidos activos ni
eliminar una comida que forme parte de ellos. Mesas y comidas usan borrado lógico.
Nuevos pedidos guardan nombre y precio de cada ítem, número de mesa, visita, fecha y
historial; la carta puede cambiar sin alterar esos pedidos. Editar un pedido pendiente
vuelve a fijar los precios de sus ítems con la carta vigente.

## Migración y datos anteriores

La migración agrega campos sin borrar registros. También amplía `comidas.descripcion`
a TEXT para admitir los 500 caracteres del frontend. Hace nullable `pedidos.id_mesero`
para permitir pedidos de mozos locales sin consultar ni modificar las tablas de usuarios.
`mozo_id` y `mozo_nombre` son datos descriptivos del pedido, no una integración de usuarios.

Los pedidos anteriores despachados se muestran como entregados. Los pedidos activos
anteriores se asocian a una visita anterior de su mesa. No se inventan fechas ni actores
faltantes. Cuando no existe un precio histórico, el listado usa el precio disponible
en la carta; los pedidos nuevos almacenan su propio precio.

## Pruebas

```sh
npm test
```

Crea una base MySQL temporal con prefijo `codex_restaurante_test_`, copia las estructuras
operativas y prueba migración repetible, CRUD, cancelación, estados, bloqueo de cierre,
rollback, precios históricos y resúmenes. También prueba el store y Axios del frontend
contra la API real de esa base. No copia usuarios ni datos del restaurante y elimina
la base temporal al terminar. Requiere dependencias de ambas carpetas y permisos para
crear/eliminar la base temporal. Los errores de validación esperados se imprimen completos.
