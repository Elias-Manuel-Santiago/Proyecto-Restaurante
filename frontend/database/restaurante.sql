-- NÁCAR: instalación nueva. MariaDB 10.4+ / MySQL 8.0.16+.
-- Sin datos de ejemplo, sin cuentas iniciales y sin borrado de tablas.
-- Seleccionar primero una base VACÍA en phpMyAdmin o con USE nombre_base;
-- Por consola: mysql -u root -p nombre_base < restaurante.sql
-- No es una migración ni una reparación de una base existente.
SET NAMES utf8mb4;

CREATE TABLE usuarios (
  id_usuario INT NOT NULL AUTO_INCREMENT,
  usuario VARCHAR(100) NOT NULL,
  nombre VARCHAR(80) NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id_usuario),
  UNIQUE KEY usuarios_usuario_unique (usuario),
  CONSTRAINT usuarios_tipo_check CHECK (tipo IN ('admin','chef','mozo')),
  CONSTRAINT usuarios_activo_check CHECK (activo IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sesiones_usuarios (
  id_sesion INT NOT NULL AUTO_INCREMENT,
  id_usuario INT NOT NULL,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  creado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expira_en DATETIME(3) NOT NULL,
  revocado_en DATETIME(3) NULL,
  PRIMARY KEY (id_sesion),
  UNIQUE KEY sesiones_token_unique (token_hash),
  KEY sesiones_usuario_idx (id_usuario),
  KEY sesiones_expiracion_idx (expira_en),
  CONSTRAINT sesiones_usuario_fk FOREIGN KEY (id_usuario)
    REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
  CONSTRAINT sesiones_fechas_check CHECK (expira_en > creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mesas (
  id_mesa INT NOT NULL AUTO_INCREMENT,
  numero INT NULL,
  cantidad_personas INT NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'desocupada',
  comensales INT NOT NULL DEFAULT 0,
  servicio_id VARCHAR(64) NULL,
  eliminado TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id_mesa),
  UNIQUE KEY mesas_numero_unique (numero),
  CONSTRAINT mesas_numero_check CHECK (numero IS NULL OR numero BETWEEN 1 AND 999),
  CONSTRAINT mesas_capacidad_check CHECK (cantidad_personas BETWEEN 1 AND 30),
  CONSTRAINT mesas_comensales_check CHECK (comensales BETWEEN 0 AND cantidad_personas),
  CONSTRAINT mesas_estado_check CHECK (estado IN ('desocupada','ocupada')),
  CONSTRAINT mesas_eliminado_check CHECK (eliminado IN (0,1)),
  CONSTRAINT mesas_numero_activo_check CHECK (eliminado=1 OR numero IS NOT NULL),
  CONSTRAINT mesas_ocupacion_check CHECK (
    (estado='desocupada' AND comensales=0 AND servicio_id IS NULL)
    OR (estado='ocupada' AND comensales>0 AND servicio_id IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE comidas (
  id_comida INT NOT NULL AUTO_INCREMENT,
  tipo VARCHAR(30) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT NOT NULL,
  precio DECIMAL(12,2) NOT NULL,
  disponible TINYINT(1) NOT NULL DEFAULT 1,
  eliminado TINYINT(1) NOT NULL DEFAULT 0,
  -- Compatibilidad con INSERT/UPDATE actuales. La interfaz no usa imágenes.
  imagen VARCHAR(2000) NOT NULL DEFAULT '',
  PRIMARY KEY (id_comida),
  CONSTRAINT comidas_tipo_check CHECK (tipo IN ('Entradas','Principales','Postres','Bebidas')),
  CONSTRAINT comidas_precio_check CHECK (precio > 0 AND precio <= 10000000),
  CONSTRAINT comidas_descripcion_check CHECK (CHAR_LENGTH(descripcion) <= 500),
  CONSTRAINT comidas_disponible_check CHECK (disponible IN (0,1)),
  CONSTRAINT comidas_eliminado_check CHECK (eliminado IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pedidos (
  id_pedidos INT NOT NULL AUTO_INCREMENT,
  id_mesa INT NOT NULL,
  -- Referencia futura: los pedidos actuales escriben NULL.
  id_mesero INT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
  numero_mesa INT NULL,
  servicio_id VARCHAR(64) NULL,
  mozo_id VARCHAR(200) NULL,
  mozo_nombre VARCHAR(80) NULL,
  creado_en DATETIME(3) NULL,
  -- LONGTEXT para conservar el contrato actual de JSON serializado de la API.
  historial LONGTEXT NULL,
  PRIMARY KEY (id_pedidos),
  KEY pedidos_mesa_estado_idx (id_mesa,estado),
  KEY pedidos_mesero_idx (id_mesero),
  KEY pedidos_servicio_idx (servicio_id),
  KEY pedidos_fecha_idx (creado_en),
  CONSTRAINT pedidos_mesa_fk FOREIGN KEY (id_mesa)
    REFERENCES mesas (id_mesa) ON DELETE RESTRICT,
  CONSTRAINT pedidos_mesero_fk FOREIGN KEY (id_mesero)
    REFERENCES usuarios (id_usuario) ON DELETE SET NULL,
  CONSTRAINT pedidos_estado_check CHECK (estado IN ('pendiente','preparacion','listo','entregado','cancelado')),
  CONSTRAINT pedidos_historial_check CHECK (historial IS NULL OR JSON_VALID(historial))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pedidos_comida (
  id_pedido INT NOT NULL,
  id_comida INT NOT NULL,
  cantidad INT NOT NULL,
  notas VARCHAR(300) NOT NULL DEFAULT '',
  nombre_comida VARCHAR(100) NULL,
  precio_unitario DECIMAL(12,2) NULL,
  PRIMARY KEY (id_pedido,id_comida),
  KEY pedidos_comida_comida_idx (id_comida),
  CONSTRAINT pedidos_comida_pedido_fk FOREIGN KEY (id_pedido)
    REFERENCES pedidos (id_pedidos) ON DELETE CASCADE,
  CONSTRAINT pedidos_comida_comida_fk FOREIGN KEY (id_comida)
    REFERENCES comidas (id_comida) ON DELETE RESTRICT,
  CONSTRAINT pedidos_comida_cantidad_check CHECK (cantidad BETWEEN 1 AND 99),
  CONSTRAINT pedidos_comida_precio_check CHECK (precio_unitario IS NULL OR precio_unitario > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE resumenes (
  id_resumen INT NOT NULL AUTO_INCREMENT,
  tipo VARCHAR(100) NOT NULL,
  ganancias DECIMAL(16,2) NOT NULL,
  pedidos INT NOT NULL,
  pedidos_cancelados INT NOT NULL,
  fecha DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id_resumen),
  KEY resumenes_fecha_idx (fecha),
  CONSTRAINT resumenes_ganancias_check CHECK (ganancias >= 0),
  CONSTRAINT resumenes_pedidos_check CHECK (pedidos >= 0),
  CONSTRAINT resumenes_cancelados_check CHECK (pedidos_cancelados >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE resumen_comida (
  id_resumen INT NOT NULL,
  id_comida INT NOT NULL,
  posicion INT NOT NULL,
  PRIMARY KEY (id_resumen,id_comida),
  KEY resumen_comida_comida_idx (id_comida),
  KEY resumen_comida_posicion_idx (id_resumen,posicion),
  CONSTRAINT resumen_comida_resumen_fk FOREIGN KEY (id_resumen)
    REFERENCES resumenes (id_resumen) ON DELETE CASCADE,
  CONSTRAINT resumen_comida_comida_fk FOREIGN KEY (id_comida)
    REFERENCES comidas (id_comida) ON DELETE RESTRICT,
  CONSTRAINT resumen_comida_posicion_check CHECK (posicion > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
