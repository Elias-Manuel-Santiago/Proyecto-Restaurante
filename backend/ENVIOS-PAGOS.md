# Envíos y Mercado Pago de prueba

Esta entrega conserva el login corregido por Elías y agrega modalidades, tarifas,
cobros y devoluciones al circuito existente. Mozo/admin registra el pedido desde
Pedidos; no se agregó registro público ni un rol cliente.

Por decisión del equipo, **solo delivery y retiro exigen pago antes de Cocina**.
Las mesas mantienen su circuito. Los pedidos históricos también conservan su
comportamiento: no se inventan pagos ni se cobran pedidos ya registrados.
Esto difiere de una interpretación de la consigna que exigiría prepago para todas
las órdenes; confirmar ese alcance con Pereyra antes de la presentación.

## Instalación en la computadora de Elías

Cada computadora usa su propia base SQL. Git comparte código y migraciones;
no sincroniza los datos ni necesita un servidor compartido.

1. Integrar esta rama conservando las correcciones posteriores de `main` e iniciar
   MySQL/MariaDB. Si ya hay `.env`, conservar su conexión SQL. Si falta, el
   preparador usa la conexión habitual de XAMPP (`127.0.0.1:3306`, `root`, clave
   vacía, base `restaurante`); ajustar `DB_*` si esa PC usa otra conexión.
2. En `backend/`: `npm ci`, `npm run iniciar:equipo` (prepara la base y arranca).
3. En `frontend/`: `npm ci`, `npm run dev`.

`preparar:equipo` instala las 15 tablas si la base está vacía, o aplica migraciones
si tiene el esquema existente. Crea las cinco cuentas de prueba que falten y
configura Mercado Pago compartido. Se puede repetir; conserva pedidos, cuentas
y contraseñas anteriores. Muestra qué cuentas creó y cuáles conservó: si una
cuenta existente tiene otra clave, esa clave sigue vigente. No cargar nuevamente
el SQL ni cambiar claves manualmente para probar esta actualización. La prueba
del preparador cubre base vacía y una copia del esquema anterior con datos y
admin con contraseña propia. El seed privado sigue disponible por separado.

El comando de Mercado Pago carga `MP_ACCESS_TOKEN` y `MP_TEST_BUYER_IDS`, conservando la
conexión SQL. Verifica contra `/users/me` que sea el vendedor de prueba esperado.
La credencial está en `mercadopago-equipo-pruebas.json`, un archivo **local e
ignorado por Git** (plantilla: `mercadopago-equipo-pruebas.example.json`). Estuvo
versionado hasta `c16fda4`, por eso hay que renovarla (ver
[ACCESOS-EQUIPO.md](ACCESOS-EQUIPO.md)). Si el archivo falta, el preparador conserva
el `MP_ACCESS_TOKEN` del `.env`. Nunca colocar una credencial de producción.
Las contraseñas de cuentas comprador/vendedor de Mercado Pago no se necesitan
en el código ni son las contraseñas de los usuarios NÁCAR.

Si falta la estructura inicial, crear una base vacía e importar
`frontend/database/restaurante.sql`; luego ejecutar `npm run migrate`. **No
importar el instalador sobre la base del equipo ya cargada.**

## Modalidades y tarifas

El admin abre **Modalidades de entrega** en Administración. Hay tres modalidades:

| Modalidad | Dirección | Repartidor interno | Tarifa inicial |
| --- | --- | --- | --- |
| Moto propia | Sí | Sí | Sin configurar |
| Cadetería externa | Sí | No | Sin configurar |
| Retiro en local | No | No | $0 |

Configurar los precios del negocio antes de usar moto/cadetería. No se inventaron
tarifas. Se pueden agregar modalidades con código, nombre, costo y requisitos
desde esa pantalla, sin modificar el core. Las tarifas son fijas por modalidad;
no se calcula distancia ni se contrata automáticamente una empresa de cadetería.
No se pueden cambiar los requisitos de una modalidad ya usada: crear otra.

El servidor valida modalidad activa, tarifa, dirección y repartidor SQL activo.
Guarda el costo de envío al crear el pedido; una modificación posterior de tarifa
no modifica ese costo histórico. También detecta una tarifa cambiada mientras
el formulario estaba abierto. Los importes se suman en centavos en el servidor.

## Circuito para presentar

1. Ingresar como mozo/admin y usar **Crear envío** desde Mesas o Pedidos.
2. Elegir modalidad y completar destinatario, dirección/indicaciones cuando
   corresponda, elegir explícitamente el repartidor interno si corresponde y comidas.
3. Registrar el pedido. En su tarjeta abrir **Cobrar pedido → Iniciar cobro**.
4. Mostrar el **QR del pedido** al cliente, que lo escanea con la cámara de su
   teléfono y paga en el checkout público de Mercado Pago. Para delivery usar
   **Copiar enlace de pago** y compartirlo por el canal habitual. El cliente no
   necesita cuenta de NÁCAR ni acceso al admin. El QR se genera localmente y
   codifica la URL HTTPS del checkout; no es un QR fijo de transferencia ni una
   integración de Point. El backend puede seguir en localhost: el teléfono abre
   Mercado Pago en Internet, sin conectarse a la PC del restaurante.
   En la prueba usar el comprador de prueba, incluso en el teléfono. El diálogo
   consulta el estado cada 10 s y tiene **Consultar estado**. No cerrar el backend.
5. Cocina muestra los pedidos nuevos en **Esperando pago**, sin controles de
   preparación. Reparto distingue ese estado de **En cocina**. Solo una aprobación
   consultada al servidor habilita la cola de preparación. La URL de regreso,
   un parámetro del navegador o un clic del usuario no aprueban el pago.
6. Chef pasa pendiente → preparación → listo.
7. Moto: el repartidor asignado retira y entrega desde Reparto. Cadetería: mozo/admin
   registra salida y entrega desde Pedidos. Retiro: mozo/admin confirma el retiro.
   Las tarjetas de Pedidos y Cocina muestran el repartidor asignado y el próximo
   paso. Reparto ofrece **Retirar pedido** únicamente al estar listo y pagado, y
   **Confirmar entrega** después de iniciar el viaje.
8. Antes de despachar/entregar, **Cancelar y reembolsar** cancela la orden y pide
   devolución total a Mercado Pago. También expira el enlace para impedir otro cobro.
   Si demora, queda Reembolso pendiente y se
   reintenta con la misma clave para evitar duplicados. Tras despachar se bloquea.
9. Para cobros aún pendientes/rechazados usar **Cancelar cobro pendiente**: se
   cancela el pedido, expira el enlace y se cancela el pago pendiente si existe.
   Si la pasarela demora queda Cancelación pendiente, sin habilitar Cocina.

Un cobro iniciado bloquea la edición de comidas/importes. Para cambiarlo hay que
cancelar el circuito y registrar otro pedido. Si un intento abierto se aprueba
después de la cancelación, al consultar se solicita el reembolso; el pedido no
vuelve a Cocina. Sin un proceso abierto que consulte no hay conciliación en
segundo plano: abrir el diálogo y consultar/reintentar para completar el circuito.

## Compras con cuentas de prueba

En Developers → Tus integraciones → NÁCAR Restaurante → Pruebas → Cuentas de
prueba, usar un **Comprador** de Argentina diferente del vendedor. Puede estar
creado automáticamente; si no, crear uno con saldo ficticio. Abrir el checkout
en incógnito para no mezclar la cuenta real con la cuenta compradora de prueba.
El usuario, contraseña y código de verificación se consultan en esa tabla.

Usar únicamente las tarjetas/datos de la documentación oficial:

- [Cuentas de prueba](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/test/accounts).
- [Compras de prueba y resultados aprobados/rechazados/pendientes](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/integration-test/test-purchases).
- [Tarjetas de prueba](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/test/cards).

Checkout Pro presenta los medios habilitados por Mercado Pago para esa cuenta.
Se integra una pasarela real en entorno de prueba, no un botón de aprobación
simulada. No se implementó una pasarela bancaria independiente ni validación
manual de transferencias; no afirmar que cualquier transferencia ya se valida
automáticamente. La arquitectura permite registrar otros adaptadores en
`modules/pasarelas.js` sin reescribir pedidos ni envíos.

## Modelo y API

El esquema pasa de 12 a 15 tablas. Se agregan `modalidades_envio` (catálogo),
`envio_modalidad` (modalidad/costo del envío) y `pagos` (un circuito de cobro por
pedido). `pedidos.pago_requerido` distingue pedidos nuevos con prepago de mesas e
históricos. Dirección y repartidor pueden ser NULL para retiro/cadetería. La
migración es aditiva y repetible; conserva tarifas ya configuradas y valida las
tablas nuevas existentes antes de modificar el esquema. El DDL de MySQL no es
atómico: ante un corte revisar el error y reejecutar, no borrar tablas.

| Ruta | Acceso | Función |
| --- | --- | --- |
| GET `/api/modalidades-envio` | Mozo/admin | Consultar modalidades |
| PUT `/api/modalidades-envio/:codigo` | Admin | Crear/configurar modalidad |
| POST `/api/pagos/:id` | Mozo/admin | Iniciar/reutilizar enlace de pago |
| GET `/api/pagos/:id` | Mozo/admin | Conciliar estado con Mercado Pago |
| POST `/api/pagos/:id/cancelar` | Mozo/admin | Cancelar cobro pendiente |
| POST `/api/pagos/:id/reembolsar` | Mozo/admin | Cancelar y devolver pago |

Se reutilizan las rutas de pedidos y envíos y sus permisos de sesión. El servidor
comprueba autorización, pago, estado y asignación aunque se llame la API sin UI.
No acepta importes finales ni una marca «aprobado» enviados por el navegador.
Al consultar valida referencia, vendedor, importe y moneda. El vendedor debe
estar identificado como `test_user` por Mercado Pago. Las operaciones con
`live_mode=false` usan ese entorno; se verificó que Checkout Pro con saldo de test
users también devuelve `live_mode=true`. En ese caso se exige que el comprador
esté en `MP_TEST_BUYER_IDS`, que su perfil API tenga el nickname `TESTUSER` generado
por Mercado Pago y que pertenezca al país del vendedor. Los IDs se copian de
Cuentas de prueba del panel; no se habilita un vendedor de producción.
`configurar:mp:pruebas` carga los dos compradores conocidos del equipo; para otro
comprador de prueba actualizar `compradores_ids` en la configuración compartida o
la variable local. El ID público por sí solo no sirve para iniciar sesión.
El token queda en el backend; no se envía al bundle React. No se necesita webhook
público para esta entrega local. El backend debe tener acceso a Internet.

## Validación y límites de esta entrega

- `npm test` en backend: API con SQL aislado, login/ABM/sesiones/roles, migraciones,
  mesas/comidas/pedidos previos, reparto y pagos. Los casos automáticos de pago
  usan un adaptador solo de test; el contrato HTTP de Mercado Pago se prueba aparte.
- `node database/verify.mjs` en frontend: importación real de las 15 tablas y
  escenario completo de API/store en una base temporal que se elimina al terminar.
- `node --test tests/courier.integration.mjs tests/priority.integration.mjs`,
  `npm run lint` y `npm run build` en frontend.
- `node --test tests/payment-qr.integration.mjs`: genera el PNG y lo decodifica
  con un lector independiente para comprobar el checkout exacto; rechaza enlaces
  ajenos a Mercado Pago y URLs HTTP. El portapapeles tiene alternativa manual.
- Verificación externa del 22/10/2026: preferencia real de Checkout Pro creada
  desde un pedido SQL, consulta pendiente con Cocina bloqueada, compra con saldo
  ficticio del comprador NÁCAR, aprobación guardada en SQL y transición a Cocina
  permitida. Operación `185565562706`, ARS 1.200,50; Mercado Pago confirmó el
  reembolso `3404376121` y estado `refunded`. El pedido quedó cancelado y repetir
  el reembolso devolvió la misma referencia. No se probaron todavía tarjetas ni
  transferencias bancarias reales; esta comprobación fue con `account_money` de
  cuentas de prueba. El ajuste de `live_mode` tiene pruebas automáticas que
  rechazan compradores sin configurar, perfiles habituales y vendedores reales.
- La revisión visual en navegador queda pendiente si la herramienta de control
  del navegador de la sesión está deshabilitada. Se reutilizan estilos responsive.

Se probó en MariaDB 10.4.32 aislada, sin modificar la base real del restaurante.
El control de consumo de stock sigue pendiente de acordar la cantidad por plato;
no se alteró `Unidades`, `Stock` ni `comida_stock`. Tampoco se agregó modo oscuro.

## Diagrama de la integración

`diagrama-clases-mercadopago.png` es la imagen para compartir; `.drawio` y `.mmd`
son editables, y `.svg` permite ampliar sin pérdida. Representa el contrato de
pasarela, módulos, componentes funcionales y objetos SQL reales, con sus estereotipos;
el backend no declara clases JavaScript. Para reproducirlo ejecutar
`python generar-diagrama-pagos.py` y `powershell -File render-diagrama-pagos.ps1`
desde `backend/`. Los archivos no contienen credenciales ni datos de clientes.
