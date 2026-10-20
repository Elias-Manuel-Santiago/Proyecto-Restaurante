// Conexiones efímeras de esta instancia, sin persistencia ni dependencias adicionales.
export function crearEventosPrioridad() {
  const clientes = new Set();
  return {
    conectar(res) {
      res.status(200).set({
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.flushHeaders();
      res.write("retry: 3000\n\n");
      clientes.add(res);
      // El comentario mantiene viva la conexión sin provocar consultas del frontend.
      const latido = setInterval(() => {
        if (!res.write(": latido\n\n")) res.end();
      }, 25000);
      latido.unref();
      const limpiar = () => {
        clientes.delete(res);
        clearInterval(latido);
      };
      res.on("close", limpiar);
      res.on("error", limpiar);
    },
    avisar() {
      for (const res of clientes) {
        // Un cliente lento se reconecta y consulta el estado actual sin acumular mensajes.
        if (!res.write("event: prioridad\ndata: {}\n\n")) res.end();
      }
    },
  };
}
