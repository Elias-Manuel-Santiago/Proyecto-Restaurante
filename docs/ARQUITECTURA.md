# Arquitectura de NÁCAR Restaurante

NÁCAR separa la interfaz del restaurante, la API de negocio y la persistencia.
El navegador usa React y TypeScript; Axios llama a `/api`. Vite reenvía esas
solicitudes en desarrollo. En el modo en línea, Express puede servir también
la interfaz compilada. Node se conecta a MySQL/MariaDB mediante `mysql2/promise`.

## Dónde encontrar cada parte

| Carpeta o archivo | Responsabilidad |
| --- | --- |
| `frontend/src/pages/` | Pantallas de salón, cocina, pedidos, inventario, reparto y administración. |
| `frontend/src/features/floor-plan/` | Editor del plano, interacción, piezas SVG y CSS del módulo. |
| `frontend/src/features/table-service/` | Control de la visita activa: apertura, cierre, consumo y despacho de pedidos de mesa. |
| `frontend/src/components/` | Diálogos, tarjetas, formularios y piezas que se reutilizan entre pantallas. |
| `frontend/src/state/` | Store compartido, acciones por rol, reglas de dominio y geometría común del plano. |
| `frontend/src/services/` y `frontend/src/types/` | Llamadas HTTP, adaptación de filas SQL y contratos TypeScript. |
| `frontend/src/App.css` | Estilos compartidos; el editor usa su propio `FloorPlan.css`. |
| `backend/app.js` y `backend/modules/rutas-acceso.js` | Rutas Express, sesión y autorización por rol. |
| `backend/modules/` | Servicios de mesas y pedidos, plano, usuarios, stock, reparto, pagos y migraciones. |
| `frontend/database/` | Esquema SQL de instalación y verificador de integración. |
| `frontend/tests/` y `backend/tests/` | Geometría, API, integración, regresión y escenarios del restaurante. |

## Plano interactivo y servicio de mesas

- **FloorPlan** compone el módulo y es la entrada común de Administración y Mesas.
  **FloorToolbar** y **FloorTools** muestran controles y emiten acciones. Los
  campos de forma y capacidad son locales al formulario.
- **FloorCanvas** conecta los eventos del SVG con el editor. **FloorTableGlyph**
  dibuja cada mesa y **ResizeHandles** dibuja sus asas. Ninguno persiste datos.
- **useFloorEditor** mantiene el borrador, la mesa seleccionada y los mensajes.
  Guarda una copia del plano original al comenzar, aunque el servicio se refresque.
  Cancelar descarta el borrador; un error de guardado permite reintentar.
- **useFloorPointer** convierte píxeles de pantalla a coordenadas del SVG con la
  matriz inversa y administra la captura del puntero. **floorTransforms** proyecta
  el movimiento sobre los ejes de la mesa y recorre posiciones intermedias.
- **floorGeometry** valida dimensiones, límites y colisiones de círculos y
  rectángulos rotados. Se comparte con Express mediante el módulo generado.
- **useTableService** usa la visita vigente para calcular el consumo y coordinar
  apertura, cierre y entrega. La distribución física y el servicio son distintos:
  guardar el plano no debe reiniciar comensales, visitas ni pedidos.

Las coordenadas representan el centro de una mesa dentro de un espacio lógico de
1200 × 800. El zoom y el tamaño de la ventana no cambian los valores guardados.
Para dos rectángulos se prueban los ejes de ambas figuras; para un círculo frente
a un rectángulo se calcula la distancia al punto más cercano del rectángulo.

## Permisos y persistencia

El administrador edita el plano. El mozo consulta la distribución y opera el
servicio. Ocultar un control es una ayuda de interfaz: Express vuelve a verificar
la sesión y el rol para cada acción.

El editor envía `PUT /api/mesas/plano` con `{ base, tables }`. El store verifica la
propuesta y publica las filas confirmadas por la API. En el servidor,
`plano.js` valida la geometría, bloquea las mesas y comprueba que la firma de
`base` siga vigente. Después comprueba ocupación, capacidad y pedidos activos
antes de escribir. Los cambios se confirman en una transacción; un borrador
obsoleto recibe 409. Las bajas son lógicas para conservar referencias históricas.

## Flujo del restaurante

- **Sesiones y estado compartido.** `autenticacion.js` comprueba la sesión SQL y
  `rutas-acceso.js` autoriza cada ruta. En el navegador, `store.ts` recupera la
  sesión, coordina las acciones y publica los cambios a través de
  `useRestaurant`. Los formularios conservan sus borradores localmente.
- **Pedidos y cocina.** `restaurante.js` controla las transiciones de estado y
  protege las visitas abiertas. La cola de prioridad se comparte por eventos
  SSE. La geometría del plano no interviene en esos cambios.
- **Reparto y cobros.** `repartos.js` guarda asignación y estado del envío.
  `pagos.js` aplica el prepago cuando corresponde y `pasarelas.js` encapsula
  Mercado Pago. Un envío pendiente de pago se muestra sin habilitar preparación.
- **Stock.** Las recetas relacionan comidas e insumos con cantidades por porción.
  El backend valida disponibilidad, registra movimientos y coordina la
  reposición en las cancelaciones. El [detalle de inventario](../backend/STOCK.md)
  explica su relación con pedidos y envíos.

## Convenciones para contribuir

1. Usar PascalCase para componentes y camelCase para funciones; conservar los
   nombres de dominio que ya usa la capa correspondiente. Mantener el texto
   visible y la documentación en español.
2. Pasar datos y acciones por props a los componentes de presentación. Las
   decisiones de negocio van en hooks, funciones puras o servicios; el acceso
   a HTTP o SQL no va dentro de un componente de dibujo.
3. Comentar las razones y contratos que no se deducen del código (coordenadas,
   roles, bloqueo y rollback), sin repetir en comentarios lo que dice cada línea.
4. Mantener el contrato de la API compatible. Validar también en el backend,
   parametrizar SQL y agrupar escrituras dependientes en transacciones.
5. Si cambia `floorGeometry.ts`, ejecutar `npm run sync:floor-geometry` desde
   frontend. No editar directamente `backend/modules/plano-geometria.js`.
6. Probar sobre un esquema temporal. No usar los datos de producción para probar
   cambios de plano, pedidos o inventario.

## Comprobación

Instalar dependencias con `npm ci` en frontend y backend. Desde frontend:

```sh
npm run lint
npm run test:floor
npm run build
node database/verify.mjs
```

`test:floor` cubre la geometría compartida, las transformaciones y el contrato
HTTP con SQL simulado. `database/verify.mjs` requiere MySQL/MariaDB real y permisos
para crear y borrar un esquema **temporal**: importa el SQL completo, ejecuta
migraciones y escenarios del restaurante con Express y el store del frontend.
Admite `DB_HOST`, `DB_PORT`, `DB_USER` y `DB_PASSWORD`; el nombre de la base de
pruebas se genera automáticamente. El escenario del plano verifica permisos,
colisiones, alta, baja, conflicto y conservación de un pedido en una mesa abierta.

Ver también la [guía de uso del plano](../frontend/PLANO-MESAS.md), la
[configuración de acceso](../backend/LOGIN.md) y el
[circuito de envíos y pagos](../backend/ENVIOS-PAGOS.md).
