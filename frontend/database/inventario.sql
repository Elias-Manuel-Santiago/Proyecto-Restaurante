-- Inventario: aplicar en la misma base que contiene comidas.
-- La migración del backend valida las tablas existentes antes de ejecutar este SQL.
-- No incluye recetas cuantificadas ni modifica existencias al registrar pedidos.
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

CREATE TABLE IF NOT EXISTS comida_stock (
  id_comida INT NOT NULL,
  id_stock INT NOT NULL,
  PRIMARY KEY (id_comida,id_stock),
  KEY comida_stock_stock_idx (id_stock),
  CONSTRAINT comida_stock_comida_fk FOREIGN KEY (id_comida)
    REFERENCES comidas (id_comida) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT comida_stock_stock_fk FOREIGN KEY (id_stock)
    REFERENCES Stock (id_stock) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
