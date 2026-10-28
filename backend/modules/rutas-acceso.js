import cookieParser from "cookie-parser";
import {
  exigirSesion,
  protegerEscritura,
  permitir,
  ingresar,
  salir,
  limitarIngresos,
  fallo,
} from "./autenticacion.js";
import { listarUsuarios, guardarUsuario } from "./usuarios.js";

export function registrarAcceso(app) {
  app.use(cookieParser());
  app.use("/api", protegerEscritura);
  app.post("/api/auth/login", limitarIngresos, async (req, res, next) => {
    try {
      res.set("Cache-Control", "no-store").json(await ingresar(req, res));
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/auth/logout", async (req, res, next) => {
    try {
      res.set("Cache-Control", "no-store").json(await salir(req, res));
    } catch (error) {
      next(error);
    }
  });
  app.use("/api", exigirSesion, (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.get("/api/auth/session", (req, res) => res.json(req.usuario));
  app.get(
    "/api/usuarios/catalogo",
    permitir("admin", "mozo", "chef"),
    async (req, res, next) => {
      try {
        res.json(await listarUsuarios(true));
      } catch (error) {
        next(error);
      }
    },
  );
  app.get("/api/usuarios", permitir("admin"), async (req, res, next) => {
    try {
      res.json(await listarUsuarios());
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/usuarios", permitir("admin"), async (req, res, next) => {
    try {
      res.status(201).json(await guardarUsuario(null, req.body, req.usuario));
    } catch (error) {
      next(error);
    }
  });
  app.put("/api/usuarios/:id", permitir("admin"), async (req, res, next) => {
    try {
      res.json(await guardarUsuario(req.params.id, req.body, req.usuario));
    } catch (error) {
      next(error);
    }
  });

  // Ninguna ruta de negocio queda pública por omisión.
  app.use("/api", (req, res, next) => {
    const path = req.path;
    let permitidos = [];
    if (path.startsWith("/pagos")) permitidos = ["mozo", "admin"];
    else if (path.startsWith("/modalidades-envio"))
      permitidos = req.method === "GET" ? ["mozo", "admin"] : ["admin"];
    else if (path.startsWith("/usuarios")) permitidos = ["admin"];
    else if (path.startsWith("/resumenes")) permitidos = ["admin"];
    else if (path.startsWith("/inventario")) permitidos = ["admin"];
    else if (path.startsWith("/envios"))
      permitidos =
        path === "/envios" && req.method === "POST"
          ? ["mozo", "admin"]
          : req.method === "PATCH"
            ? ["mozo", "admin", "repartidor"]
            : ["repartidor"];
    else if (path.startsWith("/mesas"))
      permitidos =
        path === "/mesas/obtener"
          ? ["mozo", "admin", "chef"]
          : /\/(abrir|cerrar)$/.test(path)
            ? ["mozo", "admin"]
            : ["admin"];
    else if (path.startsWith("/comidas"))
      permitidos =
        path === "/comidas/obtener"
          ? ["mozo", "chef", "admin"]
          : path.endsWith("/disponibilidad")
            ? ["chef", "admin"]
            : ["admin"];
    else if (path.startsWith("/pedidos")) {
      permitidos = ["mozo", "chef", "admin"];
      if (path.endsWith("/prioridad")) permitidos = ["chef"];
      else if (path === "/pedidos" && req.method === "POST")
        permitidos = ["mozo"];
      else if (req.method === "PUT" || path.endsWith("/cancelar"))
        permitidos = ["mozo", "admin"];
      else if (path.endsWith("/despachar")) permitidos = ["mozo"];
      else if (path.endsWith("/estado"))
        permitidos =
          req.body?.estado === "cancelado"
            ? ["mozo", "admin"]
            : req.body?.estado === "entregado"
              ? ["mozo"]
              : ["chef"];
    }
    if (!permitidos.includes(req.usuario.role))
      return next(fallo(403, "Tu rol no puede realizar esta acción."));
    req.body = {
      ...req.body,
      actor: req.usuario.name,
      mozo_id: req.usuario.id,
      mozo_nombre: req.usuario.name,
      id_mesero: Number(req.usuario.id),
    };
    if (req.usuario.role === "repartidor")
      req.body.repartidor_id = req.usuario.id;
    next();
  });
}
