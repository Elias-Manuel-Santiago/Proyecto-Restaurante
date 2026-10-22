-- Complemento de pedidos: cada envío conserva el contenido en pedidos_comida.
CREATE TABLE IF NOT EXISTS envios (
  id_pedido INT NOT NULL,
  destinatario VARCHAR(100) NOT NULL,
  direccion VARCHAR(300) NOT NULL,
  indicaciones VARCHAR(300) NOT NULL DEFAULT '',
  repartidor_id VARCHAR(200) NOT NULL,
  repartidor_nombre VARCHAR(80) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  retirado_en DATETIME(3) NULL,
  entregado_en DATETIME(3) NULL,
  PRIMARY KEY (id_pedido),
  KEY envios_repartidor_estado_idx (repartidor_id,estado),
  CONSTRAINT envios_pedido_fk FOREIGN KEY (id_pedido)
    REFERENCES pedidos (id_pedidos) ON DELETE RESTRICT,
  CONSTRAINT envios_destinatario_check CHECK (CHAR_LENGTH(TRIM(destinatario)) > 0),
  CONSTRAINT envios_direccion_check CHECK (CHAR_LENGTH(TRIM(direccion)) > 0),
  CONSTRAINT envios_repartidor_check CHECK (CHAR_LENGTH(TRIM(repartidor_id)) > 0),
  CONSTRAINT envios_nombre_check CHECK (CHAR_LENGTH(TRIM(repartidor_nombre)) > 0),
  CONSTRAINT envios_estado_check CHECK (estado IN ('pendiente','en_camino','entregado'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
