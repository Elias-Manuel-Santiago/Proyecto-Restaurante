# Backend del restaurante

Para la presentación: [accesos compartidos del equipo](ACCESOS-EQUIPO.md).
API Express con MySQL y consultas parametrizadas. Incluye autenticación real, sesiones SQL y permisos por rol.
Ver [LOGIN.md](LOGIN.md) antes de iniciar o actualizar.

Envíos, modalidades y Mercado Pago de prueba: [ENVIOS-PAGOS.md](ENVIOS-PAGOS.md).

## Ejecutar

```sh
npm ci
npm run iniciar:equipo
```

`iniciar:equipo` prepara la base y los accesos y luego inicia el servidor.
`preparar:equipo` también puede ejecutarse por separado. Usa la conexión de `.env` (si falta, crea la configuración local
predeterminada de XAMPP), instala las tablas si la base está vacía o migra la
existente, crea las cuentas de prueba que falten y configura Mercado Pago de
prueba. No cambia las contraseñas de cuentas existentes. XAMPP/MySQL debe estar
iniciado; si tu conexión es diferente, ajustar `DB_*` antes de ejecutarlo.
Se puede repetir. Para cuentas privadas siguen disponibles `migrate` y `seed:admin`.

`npm run dev` reinicia el servidor al editar archivos. El puerto predeterminado es
3005; puede cambiarse con `PORT`. La conexión existente está en `modules/db.js` y usa
un pool para las transacciones. `DB_DATABASE` permite elegir otra base.
`FRONTEND_ORIGIN` configura el origen CORS; el valor inicial es `http://localhost:5173`.
Se admite `PATCH`, necesario para estados, disponibilidad y apertura/cierre de mesas.

## Código

- `app.js`: rutas HTTP y un único try/catch por solicitud. Los errores se devuelven
  con un mensaje de negocio, sin exponer SQL, hashes ni stack.
- `modules/restaurante.js`: operaciones de mesas, comidas y pedidos. Las escrituras
  en varias tablas usan transacciones y revierten ante errores.
- `modules/consultas.js`: consultas de resúmenes y sus posiciones.
- `modules/migrate.js`: migración repetible de los campos que necesita el frontend.
- `modules/migrate-stock.js`: migración aditiva de las cuatro tablas de inventario.
- `modules/inventario.js`: descuento, validación y reposición de stock; ABM de
  inventario y recetas.

`npm run migrate:stock` crea `Unidades`, `Stock`, `comida_stock` y
`movimientos_stock` si faltan, y agrega `comida_stock.cantidad_requerida` a las bases
anteriores, validando primero las estructuras existentes. La migración general
también incluye este paso. Reglas, API y pruebas: [STOCK.md](STOCK.md).

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
para conservar pedidos anteriores sin cuenta SQL asociada. Las altas actuales registran el usuario autenticado.
`mozo_id` y `mozo_nombre` conservan la identidad y el nombre histórico al registrar el pedido.

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

## Prioridad temporal de cocina

La cola de pedidos activos se guarda solo en memoria del proceso Express, sin
escrituras en MySQL ni migraciones. Al reiniciar, se reconstruye por antigüedad;
los pedidos nuevos se agregan al final y los entregados/cancelados se retiran.
Se conserva la prioridad al avanzar de estado.

El listado POST /api/pedidos/obtener agrega prioridad (posición desde 1) a cada
fila activa; en pedidos finalizados devuelve null. PATCH /api/pedidos/:id/prioridad
recibe { destino: ID, antes: boolean } y mueve un pedido respecto de otro del
mismo estado, conservando los pedidos ocultos por filtros o paginación.
Esta acción corresponde al chef. La API exige una sesión SQL y valida ese permiso.
Ver LOGIN.md.

Pruebas de la cola sin MySQL: node --test tests/prioridad.test.js.

## Avisos de prioridad en vivo (SSE)

GET /api/pedidos/eventos mantiene un stream text/event-stream. Cada movimiento
confirmado emite el evento prioridad con data {} a todos los clientes conectados;
los movimientos inválidos no emiten avisos. El frontend consulta el orden actual
al recibir el evento y al abrir/reabrir la conexión. EventSource reconecta
automáticamente; cerrar sesión cierra el stream. Los datos siguen en memoria.

Se envía un comentario de mantenimiento cada 25 segundos, sin refrescar datos.
Las conexiones y sus temporizadores se eliminan al desconectar. El proxy de
producción debe permitir streaming sin buffering (se envía X-Accel-Buffering: no).
La consulta periódica de diez segundos se conserva para los demás cambios.

Pruebas sin MySQL: node --test tests/prioridad*.test.js.
