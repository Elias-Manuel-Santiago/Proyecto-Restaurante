import { useCallback, useEffect, useState } from 'react'
import { Dialog } from './Dialog'
import { ErrorMessage } from './ErrorMessage'
import {
  ajustarInsumo,
  crearInsumo,
  crearUnidad,
  guardarReceta,
  obtenerInventario,
  type InventarioApi,
} from '../services/apiAccess'
import { restaurantStore } from '../state/store'
import { useRestaurant } from '../state/useRestaurant'

const cantidad = (valor: string | number) =>
  Number(valor).toLocaleString('es-AR', { maximumFractionDigits: 3 })
const tipos = {
  consumo: 'Consumo',
  reposicion: 'Reposición',
  ajuste: 'Ajuste',
} as const

interface FilaReceta {
  id_stock: string
  cantidad_requerida: string
}

/** Inventario del administrador: insumos, ajustes, recetas y movimientos. */
export function InventorySettings({ onClose }: { onClose: () => void }) {
  const { data } = useRestaurant()
  const [inventario, setInventario] = useState<InventarioApi | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [ajustes, setAjustes] = useState<Record<number, string>>({})
  const [unidad, setUnidad] = useState('')
  const [insumo, setInsumo] = useState({
    nombre: '',
    id_unidad: '',
    cantidad: '',
  })
  const [plato, setPlato] = useState('')
  const [receta, setReceta] = useState<FilaReceta[]>([])

  const cargar = useCallback(async () => {
    const response = await obtenerInventario()
    if (response instanceof Error) setError(response)
    else setInventario(response.data)
    return response
  }, [])
  useEffect(() => {
    const inicial = window.setTimeout(() => void cargar(), 0)
    return () => window.clearTimeout(inicial)
  }, [cargar])

  // Cada cambio recarga el inventario y la carta (porciones disponibles).
  const ejecutar = async (
    operacion: () => Promise<Error | unknown>,
    exito: string,
  ) => {
    if (busy) return false
    setBusy(true)
    setError(null)
    setNotice('')
    const response = await operacion()
    const ok = !(response instanceof Error)
    if (ok) {
      setNotice(exito)
      await cargar()
      void restaurantStore.refresh(true)
    } else setError(response)
    setBusy(false)
    return ok
  }

  const elegirPlato = (id: string) => {
    setPlato(id)
    setReceta(
      (inventario?.recetas ?? [])
        .filter((fila) => String(fila.id_comida) === id)
        .map((fila) => ({
          id_stock: String(fila.id_stock),
          cantidad_requerida: String(Number(fila.cantidad_requerida)),
        })),
    )
  }
  const sinReceta = data.dishes.filter(
    (dish) =>
      !inventario?.recetas.some((fila) => String(fila.id_comida) === dish.id),
  )
  const unidadDe = (id: string) =>
    inventario?.insumos.find((fila) => String(fila.id_stock) === id)?.unidad ??
    ''

  return (
    <Dialog
      title="Inventario y recetas"
      onClose={() => {
        if (!busy) onClose()
      }}
      wide
    >
      <p>
        Al registrar un pedido se descuentan los insumos de su receta. Si no
        alcanzan, el pedido no se guarda. Al cancelarlo antes del despacho, el
        stock vuelve.
      </p>
      {error && <ErrorMessage error={error} />}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {!inventario ? (
        !error && <p className="muted">Cargando inventario…</p>
      ) : (
        <>
          <section className="panel">
            <div className="section-heading">
              <h2>Insumos</h2>
              <span className="eyebrow">
                {inventario.insumos.length} cargados
              </span>
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <caption className="sr-only">
                  Insumos, existencias y ajuste manual
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Insumo</th>
                    <th scope="col">Existencia</th>
                    <th scope="col">Ajuste (+ / −)</th>
                  </tr>
                </thead>
                <tbody>
                  {inventario.insumos.map((fila) => (
                    <tr key={fila.id_stock}>
                      <th scope="row">{fila.nombre}</th>
                      <td>
                        {cantidad(fila.cantidad)} {fila.unidad}
                      </td>
                      <td>
                        <form
                          className="inventory-adjust"
                          onSubmit={async (event) => {
                            event.preventDefault()
                            const valor = Number(ajustes[fila.id_stock])
                            if (
                              await ejecutar(
                                () => ajustarInsumo(fila.id_stock, valor),
                                `${fila.nombre}: ajuste registrado.`,
                              )
                            )
                              setAjustes((actual) => ({
                                ...actual,
                                [fila.id_stock]: '',
                              }))
                          }}
                        >
                          <input
                            type="number"
                            step="0.001"
                            required
                            aria-label={`Ajuste de ${fila.nombre} en ${fila.unidad}`}
                            value={ajustes[fila.id_stock] ?? ''}
                            onChange={(event) =>
                              setAjustes((actual) => ({
                                ...actual,
                                [fila.id_stock]: event.target.value,
                              }))
                            }
                          />
                          <button
                            className="secondary-button"
                            type="submit"
                            disabled={busy}
                          >
                            Aplicar
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!inventario.insumos.length && (
              <p className="empty-state">
                Cargá una unidad y después el primer insumo.
              </p>
            )}
            <div className="form-columns inventory-forms">
              <form
                className="editor-form"
                onSubmit={async (event) => {
                  event.preventDefault()
                  if (
                    await ejecutar(
                      () =>
                        crearInsumo({
                          nombre: insumo.nombre,
                          id_unidad: Number(insumo.id_unidad),
                          cantidad: Number(insumo.cantidad || 0),
                        }),
                      `${insumo.nombre}: insumo agregado.`,
                    )
                  )
                    setInsumo({ nombre: '', id_unidad: '', cantidad: '' })
                }}
              >
                <fieldset className="form-fieldset" disabled={busy}>
                  <legend>Nuevo insumo</legend>
                  <label>
                    Nombre
                    <input
                      required
                      maxLength={100}
                      value={insumo.nombre}
                      onChange={(event) =>
                        setInsumo({ ...insumo, nombre: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Unidad
                    <select
                      required
                      value={insumo.id_unidad}
                      onChange={(event) =>
                        setInsumo({ ...insumo, id_unidad: event.target.value })
                      }
                    >
                      <option value="">Elegí una unidad</option>
                      {inventario.unidades.map((fila) => (
                        <option key={fila.id_unidad} value={fila.id_unidad}>
                          {fila.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Existencia inicial
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      placeholder="0"
                      value={insumo.cantidad}
                      onChange={(event) =>
                        setInsumo({ ...insumo, cantidad: event.target.value })
                      }
                    />
                  </label>
                  <button className="primary-button" type="submit">
                    Agregar insumo
                  </button>
                </fieldset>
              </form>
              <form
                className="editor-form"
                onSubmit={async (event) => {
                  event.preventDefault()
                  if (
                    await ejecutar(
                      () => crearUnidad(unidad),
                      `Unidad «${unidad}» agregada.`,
                    )
                  )
                    setUnidad('')
                }}
              >
                <fieldset className="form-fieldset" disabled={busy}>
                  <legend>Nueva unidad</legend>
                  <label>
                    Nombre
                    <input
                      required
                      maxLength={100}
                      placeholder="g, kg, unidad, litro…"
                      value={unidad}
                      onChange={(event) => setUnidad(event.target.value)}
                    />
                  </label>
                  <button className="secondary-button" type="submit">
                    Agregar unidad
                  </button>
                </fieldset>
              </form>
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <h2>Recetas</h2>
              <span className="eyebrow">Por porción</span>
            </div>
            {sinReceta.length > 0 && (
              <p className="warning">
                Sin receta (se venden sin descontar stock):{' '}
                {sinReceta.map((dish) => dish.name).join(', ')}.
              </p>
            )}
            <form
              className="editor-form"
              onSubmit={async (event) => {
                event.preventDefault()
                const nombre =
                  data.dishes.find((dish) => dish.id === plato)?.name ?? ''
                await ejecutar(
                  () =>
                    guardarReceta(
                      Number(plato),
                      receta.map((fila) => ({
                        id_stock: Number(fila.id_stock),
                        cantidad_requerida: Number(fila.cantidad_requerida),
                      })),
                    ),
                  `${nombre}: receta guardada.`,
                )
              }}
            >
              <fieldset className="form-fieldset" disabled={busy}>
                <label>
                  Plato
                  <select
                    required
                    value={plato}
                    onChange={(event) => elegirPlato(event.target.value)}
                  >
                    <option value="">Elegí un plato</option>
                    {data.dishes.map((dish) => (
                      <option key={dish.id} value={dish.id}>
                        {dish.name}
                      </option>
                    ))}
                  </select>
                </label>
                {plato &&
                  receta.map((fila, index) => (
                    <div className="recipe-row" key={index}>
                      <label>
                        Insumo
                        <select
                          required
                          value={fila.id_stock}
                          onChange={(event) =>
                            setReceta((actual) =>
                              actual.map((otra, i) =>
                                i === index
                                  ? { ...otra, id_stock: event.target.value }
                                  : otra,
                              ),
                            )
                          }
                        >
                          <option value="">Elegí un insumo</option>
                          {inventario.insumos.map((opcion) => (
                            <option
                              key={opcion.id_stock}
                              value={opcion.id_stock}
                              disabled={receta.some(
                                (otra, i) =>
                                  i !== index &&
                                  otra.id_stock === String(opcion.id_stock),
                              )}
                            >
                              {opcion.nombre}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Cantidad por porción
                        {fila.id_stock && ` (${unidadDe(fila.id_stock)})`}
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          required
                          value={fila.cantidad_requerida}
                          onChange={(event) =>
                            setReceta((actual) =>
                              actual.map((otra, i) =>
                                i === index
                                  ? {
                                      ...otra,
                                      cantidad_requerida: event.target.value,
                                    }
                                  : otra,
                              ),
                            )
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="text-button danger-text"
                        onClick={() =>
                          setReceta((actual) =>
                            actual.filter((_, i) => i !== index),
                          )
                        }
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                {plato && (
                  <div className="actions">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={!inventario.insumos.length}
                      onClick={() =>
                        setReceta((actual) => [
                          ...actual,
                          { id_stock: '', cantidad_requerida: '' },
                        ])
                      }
                    >
                      Agregar insumo a la receta
                    </button>
                    <button className="primary-button" type="submit">
                      Guardar receta
                    </button>
                  </div>
                )}
              </fieldset>
            </form>
          </section>

          <section className="panel">
            <div className="section-heading">
              <h2>Últimos movimientos</h2>
              <span className="eyebrow">30 más recientes</span>
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <caption className="sr-only">
                  Consumos, reposiciones y ajustes de stock
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Insumo</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Cantidad</th>
                    <th scope="col">Pedido</th>
                    <th scope="col">Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {inventario.movimientos.map((fila) => (
                    <tr key={fila.id_movimiento}>
                      <td>
                        {new Date(fila.creado_en).toLocaleString('es-AR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <th scope="row">{fila.insumo}</th>
                      <td>{tipos[fila.tipo]}</td>
                      <td>
                        {fila.tipo === 'consumo'
                          ? '−'
                          : Number(fila.cantidad) > 0
                            ? '+'
                            : '−'}
                        {cantidad(Math.abs(Number(fila.cantidad)))}{' '}
                        {fila.unidad}
                      </td>
                      <td>{fila.id_pedido ? `#${fila.id_pedido}` : '—'}</td>
                      <td>{fila.usuario ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!inventario.movimientos.length && (
              <p className="empty-state">Todavía no hay movimientos.</p>
            )}
          </section>
        </>
      )}
    </Dialog>
  )
}
