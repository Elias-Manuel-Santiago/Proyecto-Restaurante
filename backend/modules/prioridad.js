// Cola efímera de una única instancia. Solo conserva IDs; nunca escribe en MySQL.
export function crearColaPrioridad() {
  let ids = [];
  const activos = new Set(['pendiente', 'preparacion', 'listo']);
  function sincronizar(filas) {
    const pedidos = new Map();
    for (const fila of filas) {
      if (activos.has(fila.estado)) pedidos.set(Number(fila.id_pedidos), fila);
    }
    ids = ids.filter((id) => pedidos.has(id));
    const conocidos = new Set(ids);
    const nuevos = [...pedidos.keys()].filter((id) => !conocidos.has(id));
    nuevos.sort((a, b) =>
      (Date.parse(pedidos.get(a).creado_en) || 0) -
      (Date.parse(pedidos.get(b).creado_en) || 0) || a - b);
    ids.push(...nuevos);
    return pedidos;
  }
  return {
    listar(filas) {
      sincronizar(filas);
      const posiciones = new Map(ids.map((id, index) => [id, index + 1]));
      return filas.map((fila) => ({
        ...fila,
        prioridad: posiciones.get(Number(fila.id_pedidos)) ?? null,
      }));
    },
    mover(filas, id, destino, antes) {
      if (!Number.isSafeInteger(id) || id <= 0 ||
          !Number.isSafeInteger(destino) || destino <= 0 ||
          typeof antes !== 'boolean' || id === destino)
        throw new Error('Movimiento de prioridad inválido.');
      const pedidos = sincronizar(filas);
      if (!pedidos.has(id) || !pedidos.has(destino))
        throw new Error('Los pedidos deben seguir activos. Actualizá la vista.');
      if (pedidos.get(id).estado !== pedidos.get(destino).estado)
        throw new Error('Solo se puede reordenar dentro del mismo estado.');
      ids.splice(ids.indexOf(id), 1);
      ids.splice(ids.indexOf(destino) + (antes ? 0 : 1), 0, id);
    },
  };
}
