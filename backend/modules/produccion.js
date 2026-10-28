import express from "express";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const enProduccion = () => process.env.NODE_ENV === "production";

// Detrás del proxy HTTPS del hosting: req.protocol y la IP real vienen de X-Forwarded-*.
// Sin esto, el control de origen compara http:// con https:// y rechaza las escrituras.
export function configurarProxy(app) {
  app.disable("x-powered-by");
  const saltos = process.env.TRUST_PROXY ?? (enProduccion() ? "1" : "");
  if (saltos !== "") app.set("trust proxy", Number(saltos));
}

// Cabeceras básicas equivalentes a las principales de helmet, sin dependencias nuevas.
export function cabecerasSeguridad(req, res, next) {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  });
  if (enProduccion())
    res.set("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  next();
}

// En producción Express sirve el frontend compilado (mismo origen que /api):
// no hay proxy de Vite, ni CORS, y la cookie de sesión funciona sin SameSite=None.
export function servirFrontend(app) {
  const activo =
    process.env.SERVIR_FRONTEND === "1" ||
    (enProduccion() && process.env.SERVIR_FRONTEND !== "0");
  const carpeta =
    process.env.FRONTEND_DIST ||
    fileURLToPath(new URL("../../frontend/dist", import.meta.url));
  if (!activo) return false;
  if (!existsSync(carpeta))
    throw new Error(
      "Falta frontend/dist. Ejecutá npm run build en frontend antes de iniciar en producción.",
    );
  app.use(express.static(carpeta, { index: false, maxAge: "1h" }));
  // Navegación con History API: toda ruta que no sea /api devuelve index.html.
  app.get(/^\/(?!api(\/|$)).*/, (req, res) =>
    res.set("Cache-Control", "no-cache").sendFile("index.html", { root: carpeta }),
  );
  return true;
}
