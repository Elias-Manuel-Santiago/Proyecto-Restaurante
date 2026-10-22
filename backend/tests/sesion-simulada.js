import { hashToken } from "../modules/autenticacion.js";

// Fixture de las pruebas de prioridad; la autenticación real se prueba con SQL.
export const cookieChef = `nacar_session=${"a".repeat(64)}`;
export function simularSesion(sql, params) {
  if (!sql.includes("FROM sesiones_usuarios")) return null;
  const mozo = params[0] === hashToken("b".repeat(64));
  return [
    [
      {
        id_usuario: mozo ? 2 : 1,
        usuario: mozo ? "mozo" : "chef",
        nombre: "Prueba",
        tipo: mozo ? "mozo" : "chef",
        activo: 1,
        id_sesion: 1,
        expira_en: new Date(Date.now() + 3600000),
      },
    ],
  ];
}
