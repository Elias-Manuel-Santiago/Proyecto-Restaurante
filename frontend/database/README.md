## Envíos y pagos (actualización vigente)

El esquema completo tiene **15 tablas**. Se agregan `modalidades_envio`,
`envio_modalidad` y `pagos`, sin cambiar las tres tablas de inventario.
Para una base existente ejecutar `npm run migrate` desde `backend/`; para una
base vacía importar `restaurante.sql` y luego ejecutar la misma migración.
La migración carga las modalidades iniciales y conserva pedidos históricos.

La configuración y las pruebas están en [ENVIOS-PAGOS.md](../../backend/ENVIOS-PAGOS.md).
Los apartados que siguen documentan las etapas anteriores; sus recuentos de tablas
y referencias a funciones pendientes corresponden a esas entregas.

## Acceso real

Usuarios y sesiones_usuarios ya se utilizan para autenticación. La migración agrega
repartidor a los roles permitidos, sin duplicar tablas; el modelo sigue teniendo 12.
Ver [instalación, seed y sesiones](../../backend/LOGIN.md). Las referencias históricas
al acceso local más abajo describen la etapa anterior y quedan reemplazadas por esa guía.

## Actualización de reparto

La instalación nueva incluye 12 tablas. Para una base existente usar la migración
del backend: agrega `envios` y permite `pedidos.id_mesa = NULL` sin borrar pedidos.
Ver [configuración y circuito de reparto](../REPARTIDOR.md). El reporte de error 1932
más abajo corresponde a la revisión anterior; no implica que todas las bases lo tengan.

# Base de datos NÁCAR

`restaurante.sql` instala las once tablas del diagrama, ajustadas al backend actual.
Se verificó en MariaDB **10.4.32** con importación real, migración repetida, 37 solicitudes
HTTP y el store del frontend. También se probaron restricciones, claves compuestas,
cascadas, protección de históricos y las relaciones futuras de usuarios y sesiones.
El SQL utiliza sintaxis compatible con MySQL **8.0.16+**; no se ejecutó en ese motor.

## Importación

El archivo requiere una base **vacía seleccionada**. No contiene `DROP`, `USE`,
cuentas, contraseñas ni datos de ejemplo. No migra tablas existentes: si encuentra
una tabla con el mismo nombre, falla en lugar de ocultar una estructura incompatible.
El DDL no es atómico: si una importación falla a mitad, revisar las tablas creadas
antes de reintentar en esa misma base.

En phpMyAdmin, crear una base vacía (por ejemplo, `restaurante_nacar`), seleccionarla
y usar **Importar → restaurante.sql**. También se puede usar el cliente MySQL:

```sql
CREATE DATABASE restaurante_nacar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE restaurante_nacar;
SOURCE C:/Users/Elias/Documents/GitHub/Proyecto Restaurante/frontend/database/restaurante.sql;
```

En PowerShell, desde `backend/`, conectar el backend a esa base:

```powershell
$env:DB_DATABASE = 'restaurante_nacar'
npm run migrate
npm start
```

La variable debe estar definida cada vez que se inicie el backend. Desde `frontend/`,
ejecutar `npm run dev`. Crear las mesas y platos desde la interfaz; no se necesita
insertar usuarios SQL para operar en esta etapa.

## Problema encontrado en la base local

El servidor devuelve `10.4.32-MariaDB` y lista las ocho tablas de `restaurante`, pero
`SHOW CREATE TABLE mesas`, `usuarios` y `sesiones_usuarios` devuelve el error **1932:
Table … doesn't exist in engine**. La base existente no puede considerarse operativa.
No se modificó ni se intentó reparar. La comprobación se realizó en una base temporal
independiente, eliminada al terminar. Si hay datos que recuperar, conservar los archivos
originales y resolver ese problema antes de reemplazar la base.

## Inventario: incremento de tablas

Esta entrega agrega exactamente las columnas del diagrama acordado:

| Tabla          | Columnas                                                                |
| -------------- | ----------------------------------------------------------------------- |
| `Unidades`     | `id_unidad` (PK autoincremental), `nombre`                              |
| `Stock`        | `id_stock` (PK autoincremental), `nombre`, `cantidad`, `id_unidad` (FK) |
| `comida_stock` | `id_comida` (FK), `id_stock` (FK), ambas forman la PK compuesta         |

`comida_stock.id_comida` referencia la tabla existente `comidas.id_comida`.
Las otras FK son `Stock.id_unidad → Unidades.id_unidad` y
`comida_stock.id_stock → Stock.id_stock`. Se usan nombres de tabla `Unidades` y
`Stock` tal como fueron pedidos. Windows puede almacenarlos en minúsculas según
`lower_case_table_names`; se debe conservar el mismo uso de mayúsculas en el SQL.

Los nombres son obligatorios, de hasta 100 caracteres, y no admiten cadenas vacías
o solo espacios. `cantidad` usa `DECIMAL(12,3)`, admite cero y fracciones, tiene valor
inicial cero y rechaza negativos. Cada cantidad se expresa en la unidad del insumo;
no hay conversiones automáticas entre unidades. No se agregan unidades ni insumos
de ejemplo. No se impone unicidad a los nombres.

Las FK usan `RESTRICT`: una unidad o insumo referenciado no puede borrarse ni
cambiar su identificador. El vínculo con comidas respeta el borrado lógico actual.
La PK compuesta impide repetir un mismo insumo dentro de un plato. El insumo puede
aparecer en varios platos y cada plato puede tener varios insumos.

### Base existente

No importar `restaurante.sql` sobre una base existente. Conservar una copia de
respaldo, verificar la base elegida y, desde `backend/`, ejecutar:

```powershell
$env:DB_DATABASE = 'nombre_de_la_base_existente'
npm run migrate:stock
```

Este comando valida `comidas.id_comida` y las tablas de inventario que ya existan
antes del primer `CREATE`. Comprueba motor InnoDB, columnas, tipos, nulabilidad,
autoincrementos, PK, FK y restricciones CHECK. Si encuentra una estructura
incompatible, informa el problema y no intenta alterarla ni repararla. Puede
repetirse sobre las tablas compatibles sin borrar sus datos. El DDL no es atómico:
un error del motor o una interrupción durante la creación puede dejar tablas
parcialmente creadas; revisar el error antes de reintentar.

El SQL aditivo está en `inventario.sql`. Se recomienda el comando anterior en lugar
de importarlo manualmente: `IF NOT EXISTS` por sí solo no valida tablas existentes.
`npm run migrate` también incluye esta migración y conserva las operaciones
anteriores del migrador. Para una instalación nueva, `restaurante.sql` ya incluye
las once tablas y no requiere importar por separado `inventario.sql`.

### Alcance y pruebas

Todavía no hay pantallas ni endpoints de inventario, descuento automático,
disponibilidad por insumos ni reintegro por cancelación. `comida_stock` guarda
composición, pero no cuánto consume cada plato. Agregar `cantidad_requerida`
requiere otra aprobación; no se presupone una unidad por plato ni se descuentan
pedidos históricos. Delivery y pagos permanecen fuera de esta entrega.

Desde `backend/`, `node --test tests/stock.test.js` crea su propia base temporal y
prueba migración sobre las ocho tablas anteriores, conservación de estructuras y
datos, repetición, fracciones, cero, FK, duplicados, nombres, negativos y rechazo
de estructuras incompatibles antes de crear tablas faltantes. El test verifica
que el inventario del SQL completo coincida con `inventario.sql`. No usa datos
del restaurante. Requiere MySQL/MariaDB local con la conexión de pruebas actual.

La integración se verificó en una instancia aislada de MariaDB 10.4.32, con datos
y archivos separados de XAMPP. La prueba existente de API se ajustó para quitar
la FK futura de usuarios sin perder la coma entre las demás restricciones.

## Ajustes respecto del diagrama original

- Se mantienen las ocho tablas anteriores y los nombres en minúsculas usados por la API.
  Se agregan las tres tablas de inventario descritas arriba.
  Se conserva `pedidos.id_pedidos` y su referencia `pedidos_comida.id_pedido`.
- Las tablas intermedias tienen PK compuestas. Una comida aparece una sola vez por
  pedido, con cantidad de 1 a 99; también una sola vez por resumen.
- Mesas incluyen número único reutilizable tras borrado lógico, capacidad, ocupación,
  comensales, identificador de visita y borrado lógico. `cantidad_personas` es capacidad.
- Pedidos incluyen fecha, número histórico de mesa, visita, datos descriptivos del mozo
  local e historial JSON serializado. La prioridad de cocina continúa solo en memoria.
- Cada ítem conserva nombre y precio de venta. Su modificación posterior en la carta
  no altera las ventas anteriores. Se admiten valores históricos nulos por compatibilidad
  con el listado y la migración; los pedidos nuevos completan estos campos desde la API.
- Se usan importes `DECIMAL`, indicadores 0/1 y restricciones de categorías, estados,
  cantidades, capacidades y JSON. Las reglas entre filas (transiciones, pedidos activos,
  apertura/cierre) se aplican en las transacciones existentes de la API.
- Las FK impiden borrar físicamente mesas o comidas referenciadas. El borrado lógico
  conserva ventas. Borrar un resumen elimina sus posiciones mediante `ON DELETE CASCADE`,
  que necesita la consulta de borrado actual. Borrar físicamente un pedido elimina sus
  ítems, aunque la API solo cancela pedidos.
- Resúmenes tienen fecha automática. Ganancias y contadores son valores ingresados
  manualmente, no cálculos automáticos de ventas. `pedidos` y `pedidos_cancelados` se
  mantienen como contadores independientes: el sistema actual no establece que el segundo
  sea un subconjunto del primero. Se permiten posiciones empatadas y se impiden negativas.
- Usuarios añaden identificador de acceso único, nombre y estado activo; roles `admin`,
  `chef`, `mozo`. Sesiones añaden creación, vencimiento, revocación y token hash SHA-256
  único (64 caracteres hexadecimales). Son previsiones de estructura, sin endpoints de
  autenticación ni cuentas iniciales. El código futuro deberá generar y validar los hashes.
- `pedidos.id_mesero` es una FK **nullable**: hoy la API escribe `NULL`; el mozo local se
  guarda en `mozo_id`/`mozo_nombre`. El acceso simulado y los perfiles locales existentes
  permanecen como estaban. Borrar un usuario deja esa FK en `NULL` y elimina sus sesiones.
- Las imágenes no se solicitan ni se muestran en la carta. Se conserva la columna vacía
  `comidas.imagen` porque las consultas actuales del backend la incluyen; eliminarla sin
  modificar ese backend rompería crear/editar platos. No es necesaria para operar.

## Diagrama y reproducción

- `diagrama.png`: imagen para consultar y compartir.
- `diagrama.svg`: versión vectorial, con todas las columnas y su nulabilidad.
- `diagrama.drawio`: versión editable en diagrams.net.
- `generar-diagrama.py`: obtiene columnas, tipos y claves del SQL y genera SVG/draw.io.
- `render-diagrama.ps1`: genera el PNG en Windows con System.Drawing.

```powershell
python database/generar-diagrama.py
powershell -NoProfile -File database/render-diagrama.ps1
node database/verify.mjs
```

La verificación requiere las dependencias de frontend y backend y MySQL/MariaDB local
con la conexión actual (`localhost`, `root`, contraseña vacía). Crea y elimina únicamente
una base con nombre aleatorio `codex_restaurante_test_*`; no usa los datos de `restaurante`.
El log del escenario queda en `.verification/schema-api.log`.

Referencias oficiales: [claves foráneas y acciones de borrado](https://dev.mysql.com/doc/refman/8.0/en/create-table-foreign-keys.html)
y [restricciones CHECK desde MySQL 8.0.16](https://docs.oracle.com/cd/E17952_01/mysql-8.0-en/create-table-check-constraints.html).
