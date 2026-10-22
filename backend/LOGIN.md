# Acceso real y sesión persistente

Requiere Node.js 22.16+ o 24, MySQL 8.0.16+ / MariaDB 10.4+ y una base operativa.
Cada integrante configura su conexión local: GitHub comparte código y esquema,
pero no sincroniza usuarios, contraseñas ni pedidos entre computadoras.

## Actualizar una instalación existente

Desde backend, conservar el archivo .env si ya existe. Si no existe:

```powershell
Copy-Item .env.example .env
```

Configurar DB_HOST, DB_PORT, DB_USER, DB_PASSWORD y DB_DATABASE. Definir
ADMIN_USERNAME (por defecto elias), ADMIN_NAME y una ADMIN_PASSWORD de 10 a 128
caracteres. No publicar el .env ni compartir contraseñas mediante commits.

```powershell
npm ci
npm run migrate
npm run seed:admin
npm start
```

La migración no elimina datos, reutiliza usuarios y sesiones_usuarios y agrega el
rol repartidor a la restricción existente. Continúan siendo doce tablas. El seed
crea el administrador solo si no existe: nunca reinicia ni cambia claves existentes.
Si encuentra ese usuario desactivado o con otro rol, se detiene sin modificarlo.
En una instalación vacía, importar primero frontend/database/restaurante.sql.
No importar ese instalador encima de una base con datos.

En frontend ejecutar npm ci y npm run dev, e ingresar con las credenciales del seed.
Se recomienda usar siempre el mismo host (localhost o 127.0.0.1), porque sus cookies
son distintas. La configuración habitual usa el proxy /api de Vite.

## Cargar al equipo, opcional

En .env definir SEED_EQUIPO_PASSWORD o, preferiblemente, las cuatro variables
SEED_PASSWORD_MARTIN, SEED_PASSWORD_LAUREANO, SEED_PASSWORD_SANTIAGO y
SEED_PASSWORD_NEHUEN. Luego ejecutar:

```powershell
npm run seed:equipo
```

| Usuario                  | Nombre                               | Rol inicial   |
| ------------------------ | ------------------------------------ | ------------- |
| elias (o ADMIN_USERNAME) | Elías Manuel Santiago (o ADMIN_NAME) | Administrador |
| martin                   | Martín Porcelli                      | Mozo          |
| laureano                 | Laureano Desantadina                 | Chef          |
| santiago                 | Santiago Oviedo                      | Repartidor    |
| nehuen                   | Parrondo Nehuen                      | Mozo          |

No hay contraseñas de fábrica. Las cuentas existentes se conservan; repetir el
script no duplica cuentas ni altera nombres, roles o claves. Desde Equipo el admin
puede crear otros administradores, editar perfiles, restablecer contraseñas y
desactivar cuentas. No hay registro público ni eliminación física de usuarios.
Las cuentas se pueden reactivar al editarlas y los históricos se conservan.

Los perfiles de la antigua demo en localStorage no se convierten en cuentas reales
ni autorizan acciones. El equipo debe crear las cuentas desde el seed o Equipo.
Los pedidos anteriores conservan sus identificadores y nombres históricos. Si hay
envíos activos asignados a perfiles locales antiguos, completar su entrega antes
de actualizar o acordar con el responsable la reasignación al nuevo ID SQL; no se
asignan automáticamente por coincidencia de nombre.

## Sesiones y permisos

- Argon2id en el servidor; nunca se envía el hash al frontend.
- Token aleatorio de 256 bits en cookie HttpOnly, SameSite=Lax, con expiración.
  En SQL solo se almacena SHA-256 del token. SESSION_HOURS vale 8 por defecto.
- Cada petición valida expiración, revocación y cuenta activa. Actualizar la página
  consulta GET /api/auth/session antes de decidir la ruta, conservando la vista.
  La sesión también puede recuperarse al reabrir el navegador antes de su vencimiento.
- Logout revoca la sesión SQL y elimina la cookie. Cambiar contraseña, desactivar
  o cambiar el rol revoca las sesiones de esa cuenta. SSE se revisa cada 15 segundos.
- Todas las operaciones de negocio exigen sesión y rol. Los actores de pedidos y
  la identidad del repartidor se obtienen de la sesión, no del cuerpo del cliente.
- Los cambios exigen X-Nacar-Request: 1 y validan Origin. Axios lo envía
  automáticamente. El login limita intentos fallidos y devuelve un mensaje común.
- El admin no puede desactivarse ni quitarse el rol. Cambios concurrentes bloquean
  las cuentas en orden y verifican que quede un administrador activo.
- No se desactiva ni cambia el rol de alguien con pedidos o envíos activos.
- El catálogo para filtros y asignaciones solo incluye ID, nombre, rol y estado;
  el listado administrativo completo exige admin. Las contraseñas no se consultan.

Para usar otra API/origen configurar FRONTEND_ORIGIN y las variables de Vite;
las solicitudes con cookies requieren un origen explícito. En producción usar
HTTPS y NODE_ENV=production, que activa cookies Secure. Para localhost HTTP se
deja NODE_ENV en desarrollo. Esta entrega no configura hosting ni acceso remoto.

## API

| Método | Ruta                   | Acceso                                         |
| ------ | ---------------------- | ---------------------------------------------- |
| POST   | /api/auth/login        | Credenciales username y password               |
| GET    | /api/auth/session      | Sesión válida                                  |
| POST   | /api/auth/logout       | Revoca la cookie presentada                    |
| GET    | /api/usuarios          | Admin                                          |
| POST   | /api/usuarios          | Admin: username, name, role, active y password |
| PUT    | /api/usuarios/:id      | Admin: mismo perfil; password opcional         |
| GET    | /api/usuarios/catalogo | Admin, mozo, chef: filtros y asignación        |

Sin sesión: 401. Rol u origen no permitido: 403. Credenciales incorrectas: 401.
Usuario duplicado: 409. Exceso de intentos: 429. Los errores no exponen SQL ni stack.

## Probar

1. Ingresar como Elías. Usuario inexistente o clave incorrecta deben rechazarse.
2. Desde Equipo crear una cuenta; salir e ingresar con esas credenciales.
3. Actualizar desde una pantalla interna: deben conservarse usuario y ruta.
4. Cerrar sesión: recargar o volver atrás no debe dar acceso a datos protegidos.
5. Desde otro navegador desactivar una cuenta o cambiar su clave: su sesión anterior
   debe dejar de funcionar. Probar también permisos de mozo, chef y repartidor.
6. Repetir migrate y seed:admin: deben conservarse cuentas, claves y pedidos.

Backend: npm test. SQL se verifica en bases temporales eliminadas al terminar.
Frontend: npm run lint, npm run build y
node --test tests/courier.integration.mjs tests/priority.integration.mjs.
