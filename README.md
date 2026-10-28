# NÁCAR Restaurante — "El restó de la 5"

Sistema interno para el personal de un restaurante: salón, cocina, delivery, cobros con
Mercado Pago (entorno de prueba) y administración del equipo.

- Frontend: React 19 + TypeScript + Vite (`frontend/`)
- Backend: Node.js + Express 5 + mysql2 sin ORM (`backend/`)
- Base: MariaDB 10.4 / MySQL 8 (`frontend/database/restaurante.sql` + migraciones)

Documentación por tema: [LOGIN.md](backend/LOGIN.md) · [ENVIOS-PAGOS.md](backend/ENVIOS-PAGOS.md) ·
[ACCESOS-EQUIPO.md](backend/ACCESOS-EQUIPO.md) · [database/README.md](frontend/database/README.md)

## Modo local

Cada integrante usa su propia base. Git comparte código y migraciones, no datos.

1. Iniciar MySQL/MariaDB (XAMPP).
2. En `backend/`: copiar `.env.example` a `.env` y revisar `DB_*`. Copiar las plantillas
   `*.example.json` sin el `.example` y completar las claves de prueba (ver
   [ACCESOS-EQUIPO.md](backend/ACCESOS-EQUIPO.md)).
3. Backend: `npm ci` y `npm run iniciar:equipo` (instala o migra la base y arranca en 3005).
4. Frontend: en `frontend/`, `npm ci` y `npm run dev` (5173, con proxy `/api` de Vite).

En la PC de Martín siguen funcionando `Iniciar-Nacar.ps1` y `Ver-Base-Nacar.ps1` sin cambios.

Pruebas: `npm test` en `backend/` (usa bases temporales `codex_restaurante_test_*` y las
borra); `npm run lint`, `npm run build` y `node --test tests/*.integration.mjs` en `frontend/`.

## Modo online

Un solo servicio: Express sirve el frontend compilado y la API en la **misma dirección**.
Así no hace falta el proxy de Vite (que solo existe en desarrollo), no hay CORS y la cookie
de sesión funciona con `SameSite=Lax` + `Secure`.

Recomendación (planes gratis consultados en octubre de 2026, verificar antes de usar):

| Pieza          | Servicio                       | Plan gratis                                     |
| -------------- | ------------------------------ | ----------------------------------------------- |
| App (Node)     | Render — Web Service           | Se duerme a los 15 min sin uso; tarda ~1 min en despertar |
| Base de datos  | Aiven — MySQL                  | 1 nodo, 1 GB de disco, sin tarjeta; exige TLS   |

Render no ofrece MySQL gratis; por eso la base va en Aiven. No conviene migrar a
PostgreSQL: habría que reescribir consultas, restricciones y migraciones.

### Paso a paso (todo desde los paneles web)

1. **Base en Aiven:** crear cuenta → *Create service* → MySQL → plan *Free*. Al terminar,
   en *Overview* copiar Host, Port, User, Password y descargar el **CA certificate**.
2. **App en Render:** *New* → *Web Service* → conectar el repo de GitHub y elegir la rama.
   - Runtime: Node · Build Command: `npm run build` · Start Command: `npm start`
   - Instance type: *Free*
3. **Variables de entorno** (Render → *Environment*). Nunca se escriben en el repo:

   | Variable          | Valor                                                     |
   | ----------------- | --------------------------------------------------------- |
   | `NODE_ENV`        | `production`                                              |
   | `TZ`              | `America/Argentina/Buenos_Aires`                          |
   | `FRONTEND_ORIGIN` | la URL pública, p. ej. `https://nacar.onrender.com`       |
   | `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` | los de Aiven              |
   | `DB_DATABASE`     | `nacar` (se crea sola)                                    |
   | `DB_SSL`          | `1`                                                       |
   | `DB_SSL_CA`       | el contenido completo del certificado CA de Aiven         |
   | `ADMIN_USERNAME` / `ADMIN_NAME` / `ADMIN_PASSWORD` | el admin inicial (clave nueva, 10+ caracteres) |
   | `MP_ACCESS_TOKEN` / `MP_TEST_BUYER_IDS` | credencial **renovada** del vendedor de prueba |

4. *Deploy*. En cada arranque `npm start` instala las tablas si la base está vacía,
   aplica migraciones y crea el admin si no existe; después inicia el servidor.
5. Entrar con el admin y crear el resto de las cuentas desde **Equipo**.

### Datos de demostración

No se sube ningún volcado con datos reales ni hashes de contraseñas. Las mesas y platos
de ejemplo se cargan desde la interfaz (o con un script que use la API). Si alguna vez se
exporta una base local, **no** importarla en la nube: en Windows los nombres de tabla se
guardan en minúsculas (`stock`, `unidades`) y en Linux el código busca `Stock` y `Unidades`.

### El día de la evaluación

- Abrir la URL 10 minutos antes (el plan gratis tarda hasta un minuto en despertar) y
  dejar una pestaña abierta.
- Tener el **modo local** listo como respaldo: es la versión de referencia.
- Mercado Pago necesita `FRONTEND_ORIGIN` con `https://` para mandar las `back_urls`.
