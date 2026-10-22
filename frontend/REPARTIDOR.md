# Repartidor conectado a SQL

Los envíos se registran desde **Pedidos → Crear envío**, con destinatario, dirección,
indicaciones, repartidor y platos. Cocina usa los mismos pedidos y estados del salón.
Reparto consulta sus asignaciones en SQL cada 10 segundos y al pulsar Actualizar.
No hay ejemplos, demo ni reemplazo por datos ficticios si falla la conexión.

## Instalación sobre una base existente

Requiere Node.js 22.16+ o 24 y MySQL/MariaDB en ejecución. En `backend/`:

```powershell
Copy-Item .env.example .env
npm ci
npm run migrate
npm start
```

Editar `.env` con DB_HOST, DB_PORT, DB_USER, DB_PASSWORD y DB_DATABASE de la base
real **antes de migrar**. Conservar el `.env` existente si ya está configurado.
La migración completa incluye inventario y reparto; `npm run migrate:reparto` sirve
si la base ya tiene todas las migraciones anteriores. Las credenciales no se suben.
No importar `restaurante.sql` encima de una base existente: ese archivo instala
una base vacía. Configurar VITE_API_ROUTE si la API no usa el proxy local de Vite.

En otra terminal, desde `frontend/`, ejecutar `npm ci` y `npm run dev`.
Cada integrante debe configurar y migrar su propia base. Descargar código o hacer
merge en GitHub no ejecuta SQL ni conecta automáticamente las bases de dos equipos.

## Probar el circuito

1. Como administrador, tener al menos un plato disponible y un perfil activo con rol
   Repartidor en Equipo. Se conservan todos los perfiles locales anteriores.
2. Como mozo o administrador, abrir Pedidos, pulsar Crear envío y completar los datos.
   Elegir platos y enviar a cocina. El envío queda guardado con `id_mesa = NULL`.
3. Como chef, pasar ese pedido por En preparación y Listo.
4. Ingresar con el perfil del repartidor asignado. Consultar el detalle y Retirar pedido.
5. Confirmar entrega. Al recargar, el envío sigue Entregado y el pedido también.
6. Un envío se puede cancelar desde Pedidos antes del retiro. Luego no se permite.
   No se puede retirar antes de que cocina lo marque listo, saltar estados ni cambiar
   un envío asignado a otro identificador de repartidor.

## Modelo y operaciones

`envios.id_pedido` es PK y FK a `pedidos.id_pedidos` (un pedido, cero o un envío).
La tabla contiene destinatario, dirección, indicaciones, identificador y nombre del
repartidor, estado, retirado_en y entregado_en. Los platos siguen en pedidos_comida.
El único cambio en pedidos permite NULL en id_mesa; se conservan los pedidos y FK.
La migración es repetible y rechaza una tabla envios existente incompatible.
Las transacciones bloquean pedido y envío, revierten altas inválidas y permiten
reintentos de retiro/entrega sin duplicar el historial ni cambiar la hora de retiro.

- POST /api/envios: registra el pedido y su envío en una sola transacción.
- POST /api/envios/obtener: consulta por repartidor_id y omite cancelados.
- PATCH /api/envios/:id/estado: confirma en_camino o entregado.

Los perfiles y el acceso siguen siendo los locales del proyecto: el identificador
asignado se comprueba en SQL, pero todavía no existe autenticación de servidor.
Para trabajar desde dispositivos distintos, el perfil debe conservar el mismo ID;
crear dos perfiles con el mismo nombre no los convierte en el mismo usuario.
El registro y los permisos con sesión de servidor son el próximo incremento.
Inventario mantiene exactamente sus tres tablas: no se agregó consumo automático,
ni cantidades por plato. No se implementaron pagos ni geolocalización.

## Verificación

Desde backend: `npm test` (requiere una base configurada con el esquema instalado).
Cada escenario SQL usa una base temporal que elimina al terminar. Incluye pedidos
de mesa, envío completo, cancelaciones, rollback y reintentos concurrentes.
Desde frontend: `npm run lint`, `npm run build` y
`node --test tests/courier.integration.mjs tests/priority.integration.mjs`.
