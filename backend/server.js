import { app } from "./app.js";
const port = Number(process.env.PORT || 3005);
app.listen(port, () =>
  console.log(`Servidor escuchando en http://localhost:${port}`),
);
