import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { app } from '../../backend/app.js'
import db from '../../backend/modules/db.js'

// API Express y Axios reales, con filas simuladas: no necesita una base disponible.
test('prioridad compartida entre chef y mozo, sin persistencia local ni escrituras SQL', async (t) => {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const output = path.join(root, '.verification', `priority-${process.pid}`)
  const compiled = new Map()
  async function compile(source) {
    if (compiled.has(source)) return compiled.get(source)
    const target = path
      .join(output, path.relative(root, source))
      .replace(/\.ts$/, '.mjs')
    compiled.set(source, target)
    let code = ts.transpileModule(await fs.readFile(source, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2023,
      },
    }).outputText
    for (const match of [...code.matchAll(/from ['"]([.][^'"]+)['"]/g)]) {
      const dependency = await compile(
        path.resolve(path.dirname(source), match[1] + '.ts'),
      )
      code = code.replace(
        match[0],
        `from ${JSON.stringify(pathToFileURL(dependency).href)}`,
      )
    }
    code = code.replaceAll(
      'import.meta.env.VITE_API_ROUTE',
      'process.env.TEST_API_BASE',
    )
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, code)
    return target
  }
  const rows = [1, 2].map((id) => ({
    id_pedidos: id,
    id_mesa: 1,
    estado: 'pendiente',
    numero_mesa: 1,
    servicio_id: 'prueba',
    mozo_id: 'mozo-1',
    mozo_nombre: 'Prueba',
    creado_en: '2026-10-19T12:00:00Z',
    historial: [],
    id_comida: null,
  }))
  let holdSummary = null
  let orderReads = 0
  t.mock.method(db, 'query', async (sql) => {
    assert.match(sql, /^SELECT\b/i)
    if (sql.includes('FROM pedidos p')) orderReads++
    if (sql.includes('FROM resumenes') && holdSummary) {
      const gate = holdSummary
      holdSummary = null
      gate.started()
      await gate.wait
    }
    return [sql.includes('FROM pedidos p') ? structuredClone(rows) : []]
  })
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => assert.fail('La prioridad no se guarda en localStorage'),
  }
  globalThis.window = { addEventListener: () => {} }
  const streams = []
  globalThis.EventSource = class extends EventTarget {
    constructor(url) {
      super()
      this.url = url
      this.closed = false
      streams.push(this)
    }
    close() {
      this.closed = true
    }
  }
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  const previousBase = process.env.TEST_API_BASE
  process.env.TEST_API_BASE = `http://127.0.0.1:${server.address().port}/api`
  let unsubscribe
  let release
  try {
    const { restaurantStore: store } = await import(
      pathToFileURL(await compile(path.join(root, 'src/state/store.ts')))
    )
    const { compareOrderPriority } = await import(
      pathToFileURL(await compile(path.join(root, 'src/state/model.ts')))
    )
    const { suscribirPrioridadPedidos } = await import(
      pathToFileURL(await compile(path.join(root, 'src/services/apiAccess.ts')))
    )
    const orderIds = () =>
      [...store.getSnapshot().data.orders]
        .sort(compareOrderPriority)
        .map((order) => order.id)
    store.login('chef')
    assert.equal(await store.refresh(), null)
    assert.deepEqual(orderIds(), ['1', '2'])
    assert.equal(
      await store.act({
        type: 'reorderOrder',
        id: '2',
        targetId: '1',
        before: true,
      }),
      '',
    )
    assert.deepEqual(orderIds(), ['2', '1'])
    store.logout()
    store.login('mozo')
    let synchronized = Promise.resolve()
    unsubscribe = suscribirPrioridadPedidos(() => {
      synchronized = store.refreshAfterEvent()
    })
    const stream = streams[0]
    assert.equal(stream.url, process.env.TEST_API_BASE + '/pedidos/eventos')
    const remoteMove = async (id, targetId) => {
      const response = await fetch(
        `${process.env.TEST_API_BASE}/pedidos/${id}/prioridad`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destino: targetId, antes: true }),
        },
      )
      assert.equal(response.status, 200)
      await response.json()
    }
    await remoteMove(1, 2)
    // El navegador dispara open también al reconectar: recupera cambios perdidos.
    stream.dispatchEvent(new Event('open'))
    await synchronized
    assert.deepEqual(orderIds(), ['1', '2'])
    await remoteMove(2, 1)
    stream.dispatchEvent(new Event('prioridad'))
    await synchronized
    assert.deepEqual(orderIds(), ['2', '1'])

    // Un aviso recibido durante una carga obliga a consultar otra vez al terminar.
    let started
    holdSummary = {
      wait: new Promise((resolve) => {
        release = resolve
      }),
      started: null,
    }
    const summaryStarted = new Promise((resolve) => {
      started = resolve
    })
    holdSummary.started = started
    const pendingRefresh = store.refresh(true)
    await summaryStarted
    await remoteMove(1, 2)
    const readsBeforeEvent = orderReads
    stream.dispatchEvent(new Event('prioridad'))
    release()
    await pendingRefresh
    await synchronized
    assert.ok(
      orderReads > readsBeforeEvent,
      'No se descarta el aviso durante la carga',
    )
    assert.deepEqual(orderIds(), ['1', '2'])
    unsubscribe()
    assert.equal(stream.closed, true)
    const previousSync = synchronized
    stream.dispatchEvent(new Event('open'))
    stream.dispatchEvent(new Event('prioridad'))
    assert.equal(
      synchronized,
      previousSync,
      'Cerrar la conexión elimina los listeners',
    )
    store.logout()
    store.login('mozo')
    assert.equal(await store.refresh(), null)
    assert.deepEqual(orderIds(), ['1', '2'])
    assert.ok(
      (await store.act({
        type: 'reorderOrder',
        id: '1',
        targetId: '2',
        before: true,
      })) instanceof Error,
    )
    assert.deepEqual(orderIds(), ['1', '2'])
    // Un pedido terminado deja de participar de la cola activa.
    rows[1].estado = 'entregado'
    assert.equal(await store.refresh(), null)
    assert.deepEqual(orderIds(), ['1', '2'])
    assert.equal(
      store.getSnapshot().data.orders.find((order) => order.id === '2')
        .priority,
      null,
    )
  } finally {
    release?.()
    unsubscribe?.()
    if (previousBase === undefined) delete process.env.TEST_API_BASE
    else process.env.TEST_API_BASE = previousBase
    delete globalThis.localStorage
    delete globalThis.window
    delete globalThis.EventSource
    await new Promise((resolve) => server.close(resolve))
    await db.end()
    assert.ok(output.startsWith(path.join(root, '.verification') + path.sep))
    await fs.rm(output, { recursive: true, force: true })
  }
})
