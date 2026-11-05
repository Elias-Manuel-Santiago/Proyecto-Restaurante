# Editor del plano del salón

Disponible en **Administración** y **Mesas → Mapa de mesas**. Solo el administrador
puede activar **Modo Edición**. El mozo ve la misma distribución y conserva la
apertura, consulta y cierre de visitas desde cada mesa.

- **Agregar mesa:** elegir rectangular/cuadrada o redonda y capacidad de 1 a 30.
  Se asigna el siguiente número disponible y se busca una ubicación libre.
- **Mover:** arrastrar la superficie. La mesa se detiene antes de salir del salón
  o atravesar otra mesa, incluso con movimientos rápidos del cursor.
- **Tamaño:** seleccionar una mesa. Las asas derecha e inferior cambian ancho y
  alto independientemente; la esquina cambia ambos. En mesas redondas hay una
  sola asa, que cambia el diámetro uniformemente. El centro permanece fijo.
- **Girar:** usar los botones de 45° a izquierda o derecha. Un giro que provoque
  una colisión o deje esquinas fuera del salón se rechaza con un mensaje.
- **Eliminar:** seleccionar una mesa y pulsar Eliminar mesa. Las mesas ocupadas
  deben cerrarse antes; el historial de pedidos se conserva.
- **Guardar plano:** confirma altas, bajas y distribución en una sola transacción
  y sale del modo edición. Si falla, mantiene el borrador para corregir/reintentar.
- **Cancelar:** descarta todo el borrador y sale sin escribir en la API.

Con una mesa enfocada, las flechas mueven 2 unidades; Mayús + flechas mueven 10.
R y Mayús + R giran 45°. Las asas también admiten flechas para redimensionar.
En pantallas pequeñas el plano se desplaza horizontalmente; admite mouse, lápiz
y entrada táctil a través de Pointer Events.

El salón usa coordenadas lógicas de 1200 × 800. Los tamaños admitidos van de
64 a 400 unidades por eje. Se permiten hasta 150 mesas. El zoom o el tamaño de
pantalla no cambia las coordenadas guardadas. Las mesas antiguas sin geometría
reciben una distribución inicial sin colisiones; se persiste al guardar por
primera vez. Si el salón está lleno, las mesas sin ubicación aparecen fuera del
lienzo como pendientes de ubicar, y el guardado permanece bloqueado hasta resolverlo.
Los filtros de disponibilidad atenúan las otras mesas; al editar se muestran todas.

## Instalación en una base existente

Con la configuración habitual de MySQL, ejecutar desde `backend/`:

```sh
npm run migrate
```

La migración aditiva e idempotente agrega `mesas.plano LONGTEXT NULL`; no borra
mesas ni pedidos. El SQL de instalaciones nuevas en `database/restaurante.sql`
ya incluye la columna. Reiniciar el backend para cargar la ruta nueva.

`PUT /api/mesas/plano` recibe `{ base, tables }`. Cada elemento contiene
`id`, `number`, `capacity` y `layout` (`shape`, `x`, `y`, `width`, `height`,
`rotation`). `x` e `y` son el centro. Los IDs temporales de altas usan
`new:<UUID>`; el servidor asigna los IDs definitivos y devuelve las filas guardadas.

El middleware existente exige una sesión de administrador. El servidor vuelve
a validar formas, dimensiones, rotaciones, números, capacidades, límites y
colisiones exactas (rectángulos rotados, círculos y formas mixtas). Bloquea las
mesas durante la transacción y comprueba que el plano original siga vigente;
responde 409 si otro administrador lo modificó. Los cambios de ocupación no
invalidan el borrador, pero impiden borrar mesas abiertas o reducir su capacidad
por debajo de los comensales. Un error revierte todas las escrituras.

## Verificación y mantenimiento

Desde `frontend/`:

```sh
npm run test:floor
npm run build
```

Las pruebas HTTP usan la API Express real y una conexión SQL simulada: no
modifican la base del restaurante. Cubren roles, colisiones, límites, conflictos,
IDs nuevos, conservación de visitas y rollback ante fallos durante el guardado.

La geometría fuente está en `src/state/floorGeometry.ts`. Si se modifica,
ejecutar `npm run sync:floor-geometry` para regenerar
`backend/modules/plano-geometria.js`. Una prueba compara ambos módulos para
evitar que frontend y servidor acepten distribuciones diferentes.
