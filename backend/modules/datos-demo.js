import { pathToFileURL } from "node:url";
import db from "./db.js";
import {
  listarTodasLasMesas,
  crearMesa,
  listarTodasLasComidas,
  crearComida,
} from "./restaurante.js";
import { listarModalidades, guardarModalidad } from "./modalidades-envio.js";
import {
  listarInventario,
  crearUnidad,
  crearInsumo,
  guardarReceta,
} from "./inventario.js";

// Datos de ejemplo para una demostración (expo o hosting): mesas, platos, tarifas,
// insumos y recetas. Repetible: lo que ya existe (mismo número o nombre) no se toca,
// y solo se carga la receta de los platos que todavía no tienen.
const mesas = [2, 4, 4, 6, 2, 8];
const platos = [
  [
    "Entradas",
    "Bruschettas",
    "Pan tostado con tomate, albahaca y oliva.",
    6500,
  ],
  [
    "Entradas",
    "Empanadas de carne",
    "Dos empanadas de carne cortada a cuchillo.",
    4500,
  ],
  ["Entradas", "Rabas", "Rabas con limón y salsa tártara.", 8900],
  [
    "Principales",
    "Milanesa con papas",
    "Milanesa de ternera con papas fritas.",
    13500,
  ],
  [
    "Principales",
    "Ñoquis con salsa",
    "Ñoquis de papa con salsa de tomate y albahaca.",
    11500,
  ],
  [
    "Principales",
    "Hamburguesa completa",
    "Hamburguesa con queso, lechuga y tomate. Con papas.",
    12500,
  ],
  [
    "Principales",
    "Pizza muzzarella",
    "Pizza de ocho porciones con muzzarella y aceitunas.",
    10900,
  ],
  ["Postres", "Flan casero", "Flan con dulce de leche.", 4500],
  [
    "Postres",
    "Brownie con helado",
    "Brownie de chocolate con helado de crema.",
    5800,
  ],
  ["Bebidas", "Agua mineral", "Agua mineral sin gas de 500 ml.", 2500],
  ["Bebidas", "Limonada", "Limonada con menta y jengibre.", 3200],
  ["Bebidas", "Gaseosa", "Gaseosa de 500 ml.", 2900],
];
const tarifas = { moto_propia: "1500.00", cadeteria: "2500.00" };
// [insumo, unidad, existencia inicial]
const insumos = [
  ["Carne picada", "g", 900],
  ["Pan de hamburguesa", "unidad", 20],
  ["Nalga", "g", 3000],
  ["Papas", "g", 8000],
  ["Huevos", "unidad", 30],
  ["Masa de pizza", "unidad", 6],
  ["Muzzarella", "g", 3000],
  ["Salsa de tomate", "ml", 5000],
  ["Ñoquis caseros", "g", 4000],
  ["Pan", "unidad", 20],
  ["Empanadas", "unidad", 40],
  ["Rabas", "g", 2000],
  ["Dulce de leche", "g", 1000],
  ["Brownie", "unidad", 10],
  ["Helado", "g", 2000],
  ["Agua mineral", "unidad", 24],
  ["Gaseosa", "unidad", 24],
  ["Limones", "unidad", 30],
];
// Hamburguesa: 900 g de carne / 180 g = 5 porciones, para mostrar el límite en vivo.
const recetas = {
  "Hamburguesa completa": [
    ["Carne picada", 180],
    ["Pan de hamburguesa", 1],
    ["Papas", 150],
  ],
  "Milanesa con papas": [
    ["Nalga", 250],
    ["Huevos", 1],
    ["Papas", 200],
  ],
  "Pizza muzzarella": [
    ["Masa de pizza", 1],
    ["Muzzarella", 300],
    ["Salsa de tomate", 100],
  ],
  "Ñoquis con salsa": [
    ["Ñoquis caseros", 300],
    ["Salsa de tomate", 150],
  ],
  Bruschettas: [
    ["Pan", 2],
    ["Salsa de tomate", 50],
  ],
  "Empanadas de carne": [["Empanadas", 2]],
  Rabas: [["Rabas", 250]],
  "Flan casero": [
    ["Huevos", 2],
    ["Dulce de leche", 40],
  ],
  "Brownie con helado": [
    ["Brownie", 1],
    ["Helado", 80],
  ],
  "Agua mineral": [["Agua mineral", 1]],
  Gaseosa: [["Gaseosa", 1]],
  Limonada: [["Limones", 2]],
};

export async function cargarDatosDemo({ idUsuario = null } = {}) {
  const resultado = { mesas: 0, platos: 0, tarifas: 0, insumos: 0, recetas: 0 };
  const existentes = await listarTodasLasMesas();
  for (const [indice, capacidad] of mesas.entries())
    if (!existentes.some((m) => Number(m.numero) === indice + 1)) {
      await crearMesa(capacidad, indice + 1);
      resultado.mesas++;
    }

  let carta = await listarTodasLasComidas();
  for (const [tipo, nombre, descripcion, precio] of platos)
    if (!carta.some((p) => p.nombre === nombre)) {
      await crearComida({
        tipo,
        nombre,
        descripcion,
        precio,
        disponible: true,
      });
      resultado.platos++;
    }

  for (const m of await listarModalidades())
    if (tarifas[m.codigo] && m.costo === null) {
      await guardarModalidad(m.codigo, {
        ...m,
        costo: tarifas[m.codigo],
        requiere_direccion: Boolean(m.requiere_direccion),
        requiere_repartidor: Boolean(m.requiere_repartidor),
        activo: Boolean(m.activo),
      });
      resultado.tarifas++;
    }

  let inventario = await listarInventario();
  const unidades = new Map(
    inventario.unidades.map((u) => [u.nombre, u.id_unidad]),
  );
  for (const nombre of new Set(insumos.map(([, unidad]) => unidad)))
    if (!unidades.has(nombre))
      unidades.set(nombre, await crearUnidad({ nombre }));
  const stock = new Map(inventario.insumos.map((s) => [s.nombre, s.id_stock]));
  for (const [nombre, unidad, cantidad] of insumos)
    if (!stock.has(nombre)) {
      stock.set(
        nombre,
        await crearInsumo(
          { nombre, id_unidad: unidades.get(unidad), cantidad },
          idUsuario,
        ),
      );
      resultado.insumos++;
    }

  carta = await listarTodasLasComidas();
  const conReceta = new Set(inventario.recetas.map((r) => Number(r.id_comida)));
  for (const [plato, items] of Object.entries(recetas)) {
    const comida = carta.find((p) => p.nombre === plato);
    if (!comida || conReceta.has(Number(comida.id_comida))) continue;
    await guardarReceta(comida.id_comida, {
      insumos: items.map(([insumo, cantidad]) => ({
        id_stock: stock.get(insumo),
        cantidad_requerida: cantidad,
      })),
    });
    resultado.recetas++;
  }
  return resultado;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    console.log(JSON.stringify(await cargarDatosDemo()));
  } catch (error) {
    console.error(`No se cargaron los datos de ejemplo: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
