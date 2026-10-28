// TLS opcional para MySQL en la nube (Aiven y similares lo exigen). En XAMPP no se usa.
// DB_SSL=1 activa TLS verificando el certificado; DB_SSL_CA admite el PEM del proveedor
// (con saltos de línea reales o escritos como \n en el panel del hosting).
export function opcionesSsl(env = process.env) {
  if (env.DB_SSL !== "1") return {};
  const ca = env.DB_SSL_CA?.replace(/\\n/g, "\n").trim();
  return { ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) } };
}
