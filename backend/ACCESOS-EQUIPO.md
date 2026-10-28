# Accesos del equipo para la presentación

Las contraseñas **no están en el repositorio**. Cada integrante guarda sus claves de
prueba en archivos locales que Git ignora:

| Archivo local (ignorado)          | Plantilla versionada                      | Contenido                                  |
| --------------------------------- | ----------------------------------------- | ------------------------------------------ |
| `accesos-equipo-pruebas.json`     | `accesos-equipo-pruebas.example.json`     | Claves iniciales de las cuentas del equipo |
| `mercadopago-equipo-pruebas.json` | `mercadopago-equipo-pruebas.example.json` | Credencial del vendedor de PRUEBA de MP    |

`ADMIN_PASSWORD` corresponde al administrador (`ADMIN_USERNAME`); cada `SEED_PASSWORD_X`
corresponde al usuario indicado. La lista de cuentas puede cambiarse con la clave
`EQUIPO` del JSON (o `SEED_EQUIPO` en `.env`); si no se define, se usa la lista de abajo.
Si el archivo no existe, la carga toma las mismas variables desde `backend/.env`.

| Usuario  | Nombre                | Rol           |
| -------- | --------------------- | ------------- |
| elias    | Elías Manuel Santiago | Administrador |
| martin   | Martín Porcelli       | Mozo          |
| laureano | Laureano Desantadina  | Chef          |
| santiago | Santiago Oviedo       | Repartidor    |
| nehuen   | Parrondo Nehuen       | Mozo          |

Yeray reemplaza a Nehuen en la presentación: su cuenta se crea desde la pantalla
**Equipo** (administrador). La cuenta `nehuen` se desactiva, no se borra, para conservar
el historial de pedidos.

## Preparar otra computadora

1. Configurar `backend/.env` con la conexión a su base SQL (copiar `.env.example`).
2. Copiar las dos plantillas `*.example.json` sin el `.example` y completar las claves.
   Las claves se piden por privado; nunca se pegan en GitHub, issues ni chats públicos.
3. Iniciar MySQL/MariaDB y, desde `backend`:

```powershell
npm ci
npm run iniciar:equipo
```

Desde `frontend`: `npm ci` y `npm run dev`.

Repetir la carga conserva las cuentas y contraseñas existentes: si una cuenta ya existía
con otra clave, no se cambia. Un administrador puede restablecerla desde Equipo.
El comando rechaza `NODE_ENV=production`.

## Rotación de claves (obligatoria antes de publicar)

Hasta el commit `c16fda4` estas claves y el token de prueba de Mercado Pago estuvieron
versionados. Siguen en el historial de Git, así que se consideran **comprometidos**:

1. **Cuentas NÁCAR:** en cada base, el admin cambia la contraseña de cada cuenta desde
   Equipo (eso revoca sus sesiones). Actualizar el JSON local con las nuevas.
2. **Mercado Pago:** en el panel de desarrolladores, cuenta vendedora de prueba →
   Credenciales de prueba → renovar el Access Token. Guardarlo solo en el JSON local o
   en `.env`, y en el panel del hosting como variable de entorno.
3. Una base publicada en Internet nunca usa las claves viejas.
