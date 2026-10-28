-- Inventario: aplicar en la misma base que contiene comidas, pedidos y usuarios.
-- La migración del backend valida las tablas existentes antes de ejecutar este SQL
-- y agrega comida_stock.cantidad_requerida a las bases creadas con la versión anterior.
CREATE TABLE IF NOT EXISTS Unidades (
  id_unidad INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  PRIMARY KEY (id_unidad),
  CONSTRAINT unidades_nombre_check CHECK (CHAR_LENGTH(TRIM(nombre)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Stock (
  id_stock INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  cantidad DECIMAL(12,3) NOT NULL DEFAULT 0,
  id_unidad INT NOT NULL,
  PRIMARY KEY (id_stock),
  KEY stock_unidad_idx (id_unidad),
  CONSTRAINT stock_unidad_fk FOREIGN KEY (id_unidad)
    REFERENCES Unidades (id_unidad) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT stock_nombre_check CHECK (CHAR_LENGTH(TRIM(nombre)) > 0),
  CONSTRAINT stock_cantidad_check CHECK (cantidad >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Receta: cuánto de cada insumo usa UNA porción del plato, en la unidad del insumo.
CREATE TABLE IF NOT EXISTS comida_stock (
  id_comida INT NOT NULL,
  id_stock INT NOT NULL,
  cantidad_requerida DECIMAL(12,3) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_comida,id_stock),
  KEY comida_stock_stock_idx (id_stock),
  CONSTRAINT comida_stock_comida_fk FOREIGN KEY (id_comida)
    REFERENCES comidas (id_comida) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT comida_stock_stock_fk FOREIGN KEY (id_stock)
    REFERENCES Stock (id_stock) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT comida_stock_cantidad_check CHECK (cantidad_requerida > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lo que realmente se descontó o repuso por pedido, y los ajustes manuales.
-- El UNIQUE impide reponer dos veces el mismo pedido.
CREATE TABLE IF NOT EXISTS movimientos_stock (
  id_movimiento INT NOT NULL AUTO_INCREMENT,
  id_stock INT NOT NULL,
  id_pedido INT NULL,
  tipo VARCHAR(20) NOT NULL,
  cantidad DECIMAL(12,3) NOT NULL,
  id_usuario INT NULL,
  creado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id_movimiento),
  UNIQUE KEY movimientos_pedido_unique (id_pedido,id_stock,tipo),
  KEY movimientos_stock_idx (id_stock,creado_en),
  KEY movimientos_usuario_idx (id_usuario),
  CONSTRAINT movimientos_stock_fk FOREIGN KEY (id_stock)
    REFERENCES Stock (id_stock) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT movimientos_pedido_fk FOREIGN KEY (id_pedido)
    REFERENCES pedidos (id_pedidos) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT movimientos_usuario_fk FOREIGN KEY (id_usuario)
    REFERENCES usuarios (id_usuario) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT movimientos_tipo_check CHECK (tipo IN ('consumo','reposicion','ajuste')),
  CONSTRAINT movimientos_cantidad_check CHECK (cantidad <> 0 AND (tipo = 'ajuste' OR cantidad > 0)),
  CONSTRAINT movimientos_pedido_check CHECK ((tipo = 'ajuste') = (id_pedido IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
