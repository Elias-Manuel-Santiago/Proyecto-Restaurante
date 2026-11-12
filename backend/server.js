/**
 * Inicio del proceso HTTP. app.js construye las rutas y sus dependencias; aquí solo se abre el puerto.
 * La preparación de SQL se ejecuta antes mediante los comandos de scripts/preparar-equipo.js.
 */
import { app } from "./app.js";
const port = Number(process.env.PORT || 3005);
app.listen(port, () =>
  console.log(`Servidor escuchando en http://localhost:${port}`),
);
