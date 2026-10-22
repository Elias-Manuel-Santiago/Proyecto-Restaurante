import { readFile, writeFile } from "node:fs/promises";

// Credencial compartida del entorno académico, publicada a pedido del equipo.
// No usa credenciales de producción ni modifica la conexión SQL de cada integrante.
const datos = JSON.parse(
  await readFile(
    new URL("../mercadopago-equipo-pruebas.json", import.meta.url),
    "utf8",
  ),
);
const respuesta = await fetch("https://api.mercadopago.com/users/me", {
  headers: { Authorization: `Bearer ${datos.access_token}` },
  signal: AbortSignal.timeout(15000),
});
if (!respuesta.ok)
  throw new Error(
    "La credencial compartida no está disponible. Revisá o renová la cuenta de prueba.",
  );
const vendedor = await respuesta.json();
if (
  !vendedor.tags?.includes("test_user") ||
  String(vendedor.id) !== datos.vendedor_id
)
  throw new Error(
    "La credencial no corresponde al vendedor de prueba del equipo.",
  );
const destino = new URL("../.env", import.meta.url);
let contenido;
try {
  contenido = await readFile(destino, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  contenido = await readFile(
    new URL("../.env.example", import.meta.url),
    "utf8",
  );
}
for (const [nombre, valor] of Object.entries({
  MP_ACCESS_TOKEN: datos.access_token,
  MP_TEST_BUYER_IDS: (datos.compradores_ids || []).join(","),
})) {
  const patron = new RegExp(`^${nombre}=.*$`, "m");
  const linea = `${nombre}=${valor}`;
  contenido = patron.test(contenido)
    ? contenido.replace(patron, linea)
    : `${contenido.trimEnd()}\n${linea}\n`;
}
await writeFile(destino, contenido, "utf8");
console.log(
  "Mercado Pago de prueba configurado en .env. Se conservó la conexión SQL; reiniciá el backend.",
);
