# NÁCAR Restaurante

Para la presentación: [accesos compartidos del equipo](../backend/ACCESOS-EQUIPO.md).
La vista de repartidor está conectada a la API y a SQL. La configuración y el
circuito completo están en [REPARTIDOR.md](REPARTIDOR.md).

El SQL de instalación y el diagrama actualizado están en [database/README.md](database/README.md).
La importación se verificó en una base temporal MariaDB. La base local `restaurante`
presenta un error del motor (1932); consultar esa guía antes de importar o iniciar.

Frontend React + TypeScript conectado a la API Express/MySQL de `../backend`.
Mesas, comidas, pedidos y resúmenes se leen y guardan en el servidor. Los usuarios,
el acceso por roles y las sesiones también se guardan y verifican en SQL.
Ver [configuración del login real](../backend/LOGIN.md).

## Ejecutar

En `backend/`, con MySQL disponible y la conexión de `modules/db.js` configurada:

```sh
npm ci
npm run migrate
npm run seed:admin
npm start
```

La migración agrega los campos necesarios para la interfaz y puede ejecutarse de nuevo.
Conserva los registros existentes y habilita el rol repartidor en usuarios.
`pedidos.id_mesero` admite NULL para conservar pedidos históricos sin cuenta SQL.
`DB_DATABASE` permite elegir otra base; por defecto se usa la conexión existente.

En `frontend/`:

```sh
npm ci
npm run dev
```

La URL de API predeterminada es `/api`. Vite reenvía esas solicitudes a
`http://localhost:3005`, incluyendo `PATCH`. Las variables opcionales de `.env.example` son:

```dotenv
VITE_API_ROUTE=/api
VITE_API_TARGET=http://localhost:3005
```

Si creás o cambiás `.env`, reiniciá Vite. `API_ROUTE` sin el prefijo `VITE_` ya no se usa.
En producción, configurar el proxy `/api` en el servidor o establecer `VITE_API_ROUTE`
con la dirección pública del backend al compilar. Configurar `FRONTEND_ORIGIN` en el
backend si el origen del frontend es diferente de `http://localhost:5173`.
Las rutas de la SPA necesitan fallback a `index.html`.

## Organización del código

- `src/services/apiAccess.ts`: contratos y todas las solicitudes HTTP. Una función
  `consultar` usa `try/catch` y devuelve la respuesta Axios o el error original completo.
- `src/services/adapters.ts`: convierte los nombres del backend al modelo de la interfaz,
  agrupa las filas de pedidos y convierte importes de MySQL a números.
- `src/state/store.ts`: carga inicial, acciones remotas y recarga después de guardar.
  No crea datos operativos de demostración ni usa un fallback a mocks.
- `src/state/model.ts`: utilidades de presentación y rutas por rol.
- `src/mocks/restaurant.ts`: conserva únicamente los perfiles iniciales de usuarios.

El estado conserva el objeto de error completo. `ErrorMessage` muestra un mensaje en
pantalla sin reemplazarlo ni resumirlo en el servicio. No hay interceptores de errores,
reintentos automáticos ni un sistema adicional de manejo de errores.

Al ingresar se cargan los datos reales. Se actualizan cada diez segundos, con el botón
**Actualizar datos** y después de cada escritura. Mientras se guarda, los controles
operativos se deshabilitan para evitar envíos repetidos. Si falla una recarga después
de una escritura confirmada, se cierra el formulario y se muestra el error global.

El chef puede arrastrar desde el asa de cada comanda para reordenarla dentro de su
estado; también puede usar las flechas del teclado con el asa enfocada. Admite mouse
y pantallas táctiles. La prioridad se conserva con filtros y paginación, y el resto
del personal recibe un aviso SSE y actualiza inmediatamente al cambiar el orden.
También se consulta al abrir **Pedidos**, al actualizar y cada diez segundos.
Los pedidos activos se muestran primero por prioridad; el historial conserva su
orden por fecha. Los nuevos van al final de la cola.
Para arrastrar entre pedidos de distintas páginas de cocina, **Ver todos para
reordenar** despliega la cola completa del estado.

La prioridad vive solo en la memoria de una instancia del backend. No se escribe
en MySQL ni en el almacenamiento local del navegador. Reiniciar el backend vuelve
a ordenar por antigüedad. La ruta `PATCH /api/pedidos/:id/prioridad` recibe
`{ destino: ID, antes: boolean }`; el listado incorpora el campo `prioridad`.

`GET /api/pedidos/eventos` mantiene una conexión SSE por pantalla con sesión iniciada.
El navegador reconecta automáticamente si se interrumpe; al conectar o reconectar
vuelve a consultar los datos. La conexión se cierra al salir de la sesión. Si hay
un proxy en producción, debe permitir streaming SSE sin acumular las respuestas.

## Conexiones disponibles

Todas las rutas parten de `/api`.

| Recurso   | Lectura                                              | Escrituras                                                                                                |
| --------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Mesas     | `POST /mesas/obtener`                                | `POST /mesas`, `PUT /mesas/:id`, `DELETE /mesas/:id`, `PATCH /mesas/:id/abrir`, `PATCH /mesas/:id/cerrar` |
| Comidas   | `POST /comidas/obtener`                              | `POST /comidas`, `PUT /comidas/:id`, `DELETE /comidas/:id`, `PATCH /comidas/:id/disponibilidad`           |
| Pedidos   | `POST /pedidos/obtener`                              | `POST /pedidos`, `PUT /pedidos/:id`, `PATCH /pedidos/:id/estado`, `/cancelar`, `/despachar`               |
| Resúmenes | `POST /resumenes/obtener`, `POST /resumenes/detalle` | `POST /resumenes`, `DELETE /resumenes/:id`                                                                |

Las funciones exportadas tienen nombres explícitos: `obtenerMesas`, `cargarMesas`,
`editarMesa`, `abrirMesa`, `cerrarMesa`, `eliminarMesa`, sus equivalentes de comidas,
`cargarPedido`, `editarPedido`, `cambiarEstadoPedido` y las operaciones de resúmenes.

## Circuito y parámetros

1. **Administrador:** crea mesas con número y capacidad (1 a 30) y platos con categoría,
   nombre, descripción, precio y disponibilidad. Las imágenes no se usan.
2. **Mozo:** abre una mesa indicando comensales y crea el pedido. Las comidas envían
   `id_comida`, `cantidad` (1 a 99) y `notas` (hasta 300 caracteres). El servidor asigna
   IDs, visita y fecha; guarda los precios y nombres de los platos.
3. **Pedidos:** los pedidos pendientes pueden editarse; los precios de sus ítems se
   vuelven a fijar al guardar la edición. Los cambios posteriores de la carta no
   modifican los importes históricos ya guardados.
4. **Chef:** cambia `pendiente → preparacion → listo`. **Mozo:** confirma `entregado` en mesa. En envíos lo confirma el repartidor.
   Mozo o administrador pueden cancelar pedidos activos. Cada cambio guarda actor y fecha.
5. La mesa se cierra cuando no tiene pedidos activos. Reabrirla inicia otra visita.
   El borrado lógico de mesas y comidas conserva los pedidos y sus referencias.
6. **Administrador → Resúmenes guardados:** consulta, crea, ve detalles y elimina resúmenes.
   Se ingresan tipo, ganancias, pedidos y cancelados; las posiciones de platos son opcionales.
   Las ganancias se ingresan explícitamente y no se confunden con el consumo del salón.

Las categorías anteriores `Entrada`, `Principal`, `Postre` y `Bebida` se muestran con
los nombres plurales del frontend. Los registros antiguos sin fecha, mozo o historial
no reciben valores inventados. Los importes anteriores que no tenían precio histórico
usan el precio disponible en la base; los nuevos pedidos sí guardan su propio precio.

## Cuentas y sesiones SQL

Ingresar con usuario y contraseña creados por el administrador o el seed.
No hay registro público ni acceso por elegir un rol. Actualizar la página recupera
la sesión SQL y conserva la ruta permitida. Equipo administra cuentas reales;
ver [LOGIN.md](../backend/LOGIN.md) para el seed opcional del equipo y los permisos.

## Formato y verificaciones

```sh
npm run format
npm run format:check
npm run lint
npm run build
```

Prettier formatea el frontend completo (fuentes, estilos, configuración, HTML y documentación).
Excluye dependencias, compilados, archivos temporales y el lockfile generado.

Pruebas de prioridad sin MySQL (requieren dependencias de frontend y backend):

```sh
# Desde frontend/
node --test tests/priority.integration.mjs
# Desde backend/
node --test tests/prioridad.test.js tests/prioridad-api.test.js tests/prioridad-sse.test.js
```

Verifican la cola en memoria, los movimientos, la limpieza, las rutas HTTP y la
lectura del orden del chef por el mozo usando Axios, avisos SSE a varios clientes,
reconexión y avisos durante una carga. Las filas de MySQL se simulan;
se comprueba que reordenar no escribe en SQL ni en localStorage.

Desde `backend/`, `npm test` crea una base temporal, copia únicamente la estructura
operativa y comprueba la API, transacciones, migración repetible, historial, precios,
visitas y resúmenes. También ejecuta `frontend/tests/store.integration.mjs` con el store
y Axios reales contra esa API. La base temporal se elimina al finalizar; las pruebas
no escriben pedidos de prueba en la base del restaurante. Requiere permisos de MySQL
para crear y eliminar esa base temporal, además de las dependencias de ambas carpetas.
