# Accesos compartidos para la presentación

Las cinco cuentas usan las mismas contraseñas que en la base aislada de Martín.
Los accesos están publicados por acuerdo del equipo para probar y presentar el trabajo.
Las contraseñas se consultan en [accesos-equipo-pruebas.json](accesos-equipo-pruebas.json).
ADMIN_PASSWORD corresponde a elias; las variables SEED_PASSWORD corresponden al usuario
indicado en su nombre. No son contraseñas de conexión a MySQL ni tokens de sesión.

| Usuario  | Nombre                | Rol           |
| -------- | --------------------- | ------------- |
| elias    | Elías Manuel Santiago | Administrador |
| martin   | Martín Porcelli       | Mozo          |
| laureano | Laureano Desantadina  | Chef          |
| santiago | Santiago Oviedo       | Repartidor    |
| nehuen   | Parrondo Nehuen       | Mozo          |

## Cargar en la computadora de Elías

1. Descargar los cambios y configurar backend/.env con la conexión a su base SQL.
   Si no existe, copiar backend/.env.example. No reemplazar un .env ya configurado.
2. Iniciar MySQL/MariaDB. El comando siguiente detecta base vacía o existente;
   no hay que importar SQL manualmente ni reemplazar una base con datos.
3. Desde backend ejecutar:

```powershell
npm ci
npm run iniciar:equipo
```

Desde frontend ejecutar npm ci y npm run dev. Ingresar con uno de los usuarios de la
tabla y su contraseña del JSON. No hace falta copiar las contraseñas al .env.
El comando de carga las convierte a hashes Argon2id al insertarlas en SQL.

Repetir la carga conserva las cuentas y contraseñas existentes. Si una cuenta ya
existía con otra clave, no se cambia automáticamente: un admin puede restablecerla
desde Equipo. Cambiar una contraseña desde la pantalla no actualiza el archivo JSON.

La configuración de la base sigue siendo propia de cada PC. Estos accesos compartidos
solo se cargan al ejecutar el comando explícito; no se habilitan al iniciar el servidor.
El comando rechaza NODE_ENV=production. Para cuentas con claves privadas sigue
existiendo el flujo seed:admin / seed:equipo documentado en [LOGIN.md](LOGIN.md).
