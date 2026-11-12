# Diagramas de clases y objetos de NÁCAR

Abrir `diagramas-uml.drawio` con draw.io / diagrams.net mediante **Archivo → Abrir desde → Dispositivo**. Incluye ambos diagramas en un único archivo. Las pestañas inferiores contienen las distintas vistas; todos los elementos son editables. También se incluyen los archivos de clases y objetos por separado.

El modelo representa cómo se organizaría el proyecto con programación orientada a objetos. No describe clases JavaScript existentes: distribuye los datos y las funciones actuales entre objetos con atributos privados y operaciones públicas. La aplicación no fue modificada.

## Contenido

| Archivo | Páginas |
| --- | --- |
| `diagramas-uml.drawio` | Las ocho vistas de clases y objetos reunidas. |
| `diagrama-clases.drawio` | Salón, carta y pedidos; envíos y reparto; pagos y pasarelas; recetas, inventario y cocina; acceso, equipo y resúmenes. |
| `diagrama-objetos.drawio` | Pedido en una mesa; envío pagado en reparto; consumo de inventario. |

Las páginas de clases son vistas parciales de un único modelo. Una clase marcada `«referencia»` es la misma clase definida en otra página, con atributos seleccionados. Los objetos muestran situaciones ficticias consistentes con sus relaciones; no representan una secuencia de ejecución ni registros reales.

## Notación

| Símbolo | Significado |
| --- | --- |
| `−` / `+` | Atributo privado / operación pública. |
| `/` / `?` | Valor derivado / valor que admite nulo. |
| Línea continua | Asociación entre clases o vínculo entre instancias. |
| Rombo negro | Composición: el objeto de la punta del rombo contiene las partes. Expresa propiedad conceptual, no una regla SQL de borrado. |
| Flecha discontinua abierta | Dependencia: un objeto utiliza otro. |
| Flecha discontinua con triángulo vacío | Realización de una interfaz: `PasarelaMercadoPago` implementa `PasarelaPago`. |
| `1`, `0..1`, `0..*`, `1..*` | Uno, opcional, cero o más, uno o más. El número de cada extremo indica cuántas instancias de ese extremo corresponden a una del extremo opuesto. |
| `nombre : Clase` subrayado | Instancia concreta del diagrama de objetos. |

Las asociaciones representan referencias a objetos; por eso se omiten las claves foráneas que duplicarían una relación. Se conservan identificadores históricos, como `mozoId`, y datos copiados del momento de la operación. Los estados y roles son tipos enumerados conceptuales, no subclases. Las firmas omiten detalles técnicos como conexiones SQL y promesas; algunos tipos de valor y parámetros se resumen para mantener la legibilidad.

## Correspondencia con el proyecto

| Clases propuestas | Base en el código actual |
| --- | --- |
| `Mesa`, `Pedido`, `DetallePedido`, `Comida` | `backend/modules/restaurant/restaurante.js`; interfaces `RestaurantTable`, `Order`, `OrderItem` y `MenuDish` de `frontend/src/types/index.ts`. |
| `PosicionMesa`, `EventoEstado` | `TableLayout`, `StatusEvent`; `backend/modules/restaurant/plano.js`; historial de pedidos. |
| `Envio`, `TarifaEnvio`, `ModalidadEnvio` | `backend/modules/delivery/repartos.js`, `modalidades-envio.js`; tablas `envios`, `envio_modalidad` y `modalidades_envio`. |
| `Pago`, `RegistroPasarelas`, `PasarelaPago`, `PasarelaMercadoPago` | `backend/modules/payments/pagos.js`, `pasarelas.js`. El contrato estructural del adaptador se propone como interfaz. |
| `Stock`, `Unidad`, `IngredienteReceta`, `MovimientoStock`, `Inventario` | `backend/modules/inventory/inventario.js`; tablas `Stock`, `Unidades`, `comida_stock`, `movimientos_stock`. |
| `ColaPrioridad` | `backend/modules/priority/prioridad.js`: lista ordenada temporal de pedidos activos. En POO se proponen referencias a pedidos en lugar de una lista de IDs. |
| `Usuario`, `SesionUsuario`, `Autenticacion` | `backend/modules/auth/usuarios.js`, `autenticacion.js`; tablas `usuarios` y `sesiones_usuarios`. |
| `Resumen`, `PosicionResumen` | `backend/modules/restaurant/resumenes.js`; tablas `resumenes` y `resumen_comida`. |

Los métodos son una adaptación de responsabilidades, no una transcripción literal. Por ejemplo, `Mesa.abrir()` corresponde a `abrirMesa()`, `Pedido.editarItems()` a `editarPedido()`, `Pedido.cancelar()` al cambio de estado a `cancelado`, y `Pago.reembolsar()` a `reembolsarPago()`. `Envio.asignarRepartidor()` expresa la asignación validada durante `crearEnvio()`, sin agregar una función de reasignación a la aplicación.

El diseño mantiene las reglas comprobadas en el código: un pedido puede tener cero o un pago; el envío conserva su tarifa histórica; el inventario se reserva al crear el pedido y se repone al cancelar; y un envío solo puede salir cuando el pedido está listo y su pago aprobado. Los resúmenes muestran el almacenamiento y consulta existentes, sin suponer un cálculo automático nuevo.

## Regeneración

Desde la raíz del repositorio:

```sh
python docs/generar-diagramas-uml.py
```

Requiere Python 3 y solo utiliza la biblioteca estándar. Sobrescribe los tres archivos `.drawio` a partir del modelo del generador; editar este último para conservar cambios al regenerar. Produce previsualizaciones SVG temporales; `--preview-dir RUTA` permite elegir dónde guardarlas.

Se tomó como referencia visual `Diagrama de casos de uso(1).drawio` y como contraste estructural `base de datos.drawio`, junto con `frontend/database/restaurante.sql` y las migraciones actuales.
