import db from "./db.js";
import { migrarStock } from "./migrate-stock.js";
import { migrarReparto } from "./migrate-reparto.js";

// Migración aditiva: no elimina pedidos, comidas, mesas ni tablas de usuarios.
export async function migrar() {
  await migrarStock();
  const columnas = {
    mesas: {
      eliminado: "TINYINT(1) NOT NULL DEFAULT 0",
      numero: "INT NULL",
      estado: "VARCHAR(30) NOT NULL DEFAULT 'desocupada'",
      comensales: "INT NOT NULL DEFAULT 0",
      servicio_id: "VARCHAR(64) NULL",
    },
    comidas: { imagen: "VARCHAR(2000) NOT NULL DEFAULT ''" },
    pedidos: {
      numero_mesa: "INT NULL",
      servicio_id: "VARCHAR(64) NULL",
      mozo_id: "VARCHAR(200) NULL",
      mozo_nombre: "VARCHAR(80) NULL",
      creado_en: "DATETIME(3) NULL",
      historial: "LONGTEXT NULL",
    },
    pedidos_comida: {
      nombre_comida: "VARCHAR(100) NULL",
      precio_unitario: "DECIMAL(12,2) NULL",
    },
  };
  for (const [tabla, campos] of Object.entries(columnas)) {
    const [actuales] = await db.query(`SHOW COLUMNS FROM ${tabla}`);
    for (const [nombre, tipo] of Object.entries(campos)) {
      if (!actuales.some((campo) => campo.Field === nombre))
        await db.query(`ALTER TABLE ${tabla} ADD COLUMN ${nombre} ${tipo}`);
    }
  }
  // Los perfiles siguen siendo locales: no se requiere una referencia a usuarios.
  await db.query("ALTER TABLE pedidos MODIFY id_mesero INT NULL");
  await db.query("ALTER TABLE comidas MODIFY descripcion TEXT NOT NULL");
  await db.query(
    "UPDATE mesas SET numero = id_mesa WHERE numero IS NULL AND eliminado=0",
  );
  const [indices] = await db.query("SHOW INDEX FROM mesas");
  if (!indices.some((indice) => indice.Key_name === "mesas_numero_unique"))
    await db.query("CREATE UNIQUE INDEX mesas_numero_unique ON mesas (numero)");
  await db.query(
    "UPDATE pedidos SET estado = 'entregado' WHERE estado = 'despachado'",
  );
  await db.query(
    "UPDATE pedidos p JOIN mesas m ON m.id_mesa=p.id_mesa SET p.numero_mesa=COALESCE(p.numero_mesa,m.numero), p.servicio_id=COALESCE(p.servicio_id,CONCAT('anterior-',p.id_mesa))",
  );
  // Recupera mesas con pedidos anteriores pendientes sin inventar fechas ni mozos.
  await db.query(
    "UPDATE mesas m SET estado='ocupada', comensales=GREATEST(comensales,1), servicio_id=CONCAT('anterior-',m.id_mesa) WHERE servicio_id IS NULL AND EXISTS (SELECT 1 FROM pedidos p WHERE p.id_mesa=m.id_mesa AND p.estado IN ('pendiente','preparacion','listo'))",
  );
  await migrarReparto();
}

if (process.argv[1]?.endsWith("migrate.js")) {
  try {
    await migrar();
    console.log("Migración completada.");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
