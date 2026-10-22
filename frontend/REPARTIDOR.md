# SCRUM-33: vista del repartidor

Entrega de frontend. El repartidor usa el mismo acceso de demostración por rol que
mozo, chef y administrador. No se agregó una API de acceso, no se modificó el backend
y no se ejecutaron migraciones ni cambios de base de datos.

## Probar la pantalla

Desde la carpeta del frontend:

```sh
npm ci
npm run dev
```

1. Abrir la dirección que informa Vite.
2. Elegir **Repartidor** en la pantalla de acceso. Completar usuario y contraseña
   ficticios; el acceso actual sigue siendo una demostración, sin verificar credenciales.
3. La ruta `/reparto` muestra un aviso de integración pendiente, sin afirmar que
   se consultaron entregas reales.
4. Pulsar **Ver demostración** para cargar cuatro entregas ficticias.
5. Buscar por pedido, cliente o dirección y filtrar por estado.
6. Abrir **Ver detalle** para consultar contenido, observaciones e indicaciones.
7. **Retirar pedido** cambia un ejemplo de Listo para retirar a En camino.
   **Confirmar entrega** cambia un ejemplo de En camino a Entregado. Ambas acciones
   requieren confirmación y actualizan los contadores. Cancelar el diálogo no cambia datos.
8. **Reiniciar demo** restablece los ejemplos y limpia los filtros; **Salir de la demo**
   vuelve a la pantalla inicial y elimina los cambios de la demostración.

Las entregas de ejemplo viven solo en memoria y se descartan al salir de la vista o
recargar. No se guardan en localStorage ni se mezclan con los pedidos reales de mesas.
El rol no puede ejecutar acciones de mesas, menú o cocina mediante el store actual.
La vista no llama a la API del salón ni abre SSE o consultas periódicas.

## Perfiles guardados anteriormente

Una instalación sin perfiles guardados incluye un perfil Repartidor demo. Si ya hay
perfiles locales, se conservan exactamente como estaban: no se reemplazan ni se
agregan usuarios automáticamente. Si el botón Repartidor aparece deshabilitado,
ingresar como administrador y crear desde **Equipo** un usuario con rol Repartidor.
No es necesario borrar el almacenamiento del navegador.

## Guía para quienes conecten los pedidos de reparto

El contrato de presentación propuesto está en `src/types/delivery.ts`. La composición
de la pantalla no depende de SQL ni de una respuesta concreta del backend. Hoy los
pedidos del salón requieren mesa y no incluyen dirección de envío; por eso no se
convierten pedidos de mesa en envíos ni se inventan direcciones para datos reales.

La pantalla necesita estos datos, cuyos nombres de API y tablas debe acordar el equipo:

| Campo de presentación | Contenido                                      |
| --------------------- | ---------------------------------------------- |
| `id`                  | Identificador del envío/pedido que corresponda |
| `customerName`        | Nombre del destinatario                        |
| `address`             | Dirección de entrega                           |
| `addressNotes`        | Referencias e indicaciones opcionales          |
| `items`               | Nombre, cantidad y observaciones de cada plato |
| `status`              | Estado del reparto según el mapeo acordado     |

Los estados **propuestos para la demostración** son `listo`, `en_camino` y `entregado`.
No reemplazan ni amplían el `OrderStatus` existente del salón. El equipo debe confirmar
la correspondencia con su circuito real, cuándo se asigna un repartidor y qué entregas
puede consultar. La selección de envíos y los permisos reales deberán comprobarse en
el servidor cuando se conecte; el acceso local actual no autentica al usuario.

Para integrar los datos reales, usar las convenciones existentes: solicitudes en
services, adaptación del contrato al modelo de presentación y estado remoto separado
de la demostración. Los componentes DeliveryCard y DeliveryDetail reciben sus datos
por props. Sustituir o extender el hook de entregas al incorporar la fuente acordada;
la demo debe seguir siendo explícita y nunca actuar como fallback de una API fallida.
Confirmar cambios con el servidor antes de presentarlos como guardados y manejar
errores, duplicados y transiciones inválidas.

No se entregan consultas SQL sobre tablas de delivery inexistentes. Esta guía indica
los datos y operaciones necesarios para que los responsables de backend definan la
integración sobre su modelo. No se agregó pago, geolocalización ni cancelación de envíos.

## Verificaciones

```sh
npm run lint
npm run build
node --test tests/courier.integration.mjs tests/priority.integration.mjs
npx prettier --check --end-of-line auto .
```

La prueba nueva comprueba conservación de perfiles anteriores, creación local de un
repartidor desde administración, acceso y ruta correctos, rutas iniciales de los otros
roles y ausencia de llamadas HTTP al actualizar o intentar acciones del salón.
No requiere iniciar MySQL. La prueba de prioridad existente sigue usando filas
simuladas. También se verifican visualmente el recorrido de demo, los filtros,
diálogos, reinicio y adaptación a pantallas pequeñas.
