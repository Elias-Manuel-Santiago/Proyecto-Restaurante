CREATE TABLE IF NOT EXISTS modalidades_envio (
  codigo VARCHAR(40) NOT NULL,
  nombre VARCHAR(80) NOT NULL,
  costo DECIMAL(12,2) NULL,
  requiere_direccion TINYINT(1) NOT NULL,
  requiere_repartidor TINYINT(1) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (codigo),
  CONSTRAINT modalidades_costo_check CHECK (costo IS NULL OR costo >= 0),
  CONSTRAINT modalidades_flags_check CHECK (requiere_direccion IN (0,1) AND requiere_repartidor IN (0,1) AND activo IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS envio_modalidad (
  id_pedido INT NOT NULL,
  modalidad_codigo VARCHAR(40) NOT NULL,
  costo DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id_pedido),
  CONSTRAINT envio_modalidad_envio_fk FOREIGN KEY (id_pedido) REFERENCES envios(id_pedido) ON DELETE RESTRICT,
  CONSTRAINT envio_modalidad_tipo_fk FOREIGN KEY (modalidad_codigo) REFERENCES modalidades_envio(codigo) ON DELETE RESTRICT,
  CONSTRAINT envio_modalidad_costo_check CHECK (costo >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pagos (
  id_pago CHAR(36) NOT NULL,
  id_pedido INT NOT NULL,
  proveedor VARCHAR(40) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  importe DECIMAL(12,2) NOT NULL,
  moneda CHAR(3) NOT NULL DEFAULT 'ARS',
  preferencia_id VARCHAR(200) NULL,
  checkout_url VARCHAR(2048) NULL,
  referencia_pasarela VARCHAR(100) NULL,
  metodo VARCHAR(80) NULL,
  reembolso_id VARCHAR(100) NULL,
  creado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id_pago),
  UNIQUE KEY pagos_pedido_unique (id_pedido),
  UNIQUE KEY pagos_referencia_unique (proveedor,referencia_pasarela),
  CONSTRAINT pagos_pedido_fk FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedidos) ON DELETE RESTRICT,
  CONSTRAINT pagos_importe_check CHECK (importe > 0),
  CONSTRAINT pagos_estado_check CHECK (estado IN ('pendiente','aprobado','rechazado','cancelado','cancelando','reembolsando','reembolsado'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
