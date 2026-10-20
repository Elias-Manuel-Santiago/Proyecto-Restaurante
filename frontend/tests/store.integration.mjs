import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

// Se ejecuta desde la prueba aislada del backend, nunca contra la base real.
assert.ok(process.env.TEST_API_BASE?.startsWith('http://127.0.0.1:'))
const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.join(root, '.verification', `store-${process.pid}`)
const compiled = new Map()
async function compile(source) {
  const target = path
    .join(output, path.relative(root, source))
    .replace(/\.ts$/, '.mjs')
  if (compiled.has(source)) return compiled.get(source)
  compiled.set(source, target)
  let text = ts.transpileModule(await fs.readFile(source, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2023,
    },
  }).outputText
  const imports = [...text.matchAll(/from ['"]([.][^'"]+)['"]/g)]
  for (const match of imports) {
    const dependency = await compile(
      path.resolve(path.dirname(source), match[1] + '.ts'),
    )
    text = text.replace(
      match[0],
      `from ${JSON.stringify(pathToFileURL(dependency).href)}`,
    )
  }
  text = text.replaceAll(
    'import.meta.env.VITE_API_ROUTE',
    'process.env.TEST_API_BASE',
  )
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, text)
  return target
}
const saved = new Map()
let writes = 0
const handlers = new Map()
globalThis.localStorage = {
  getItem: (key) => saved.get(key) ?? null,
  setItem: (key, value) => {
    writes++
    saved.set(key, value)
  },
}
globalThis.window = {
  addEventListener: (name, callback) => handlers.set(name, callback),
}
try {
  const modulePath = await compile(path.join(root, 'src/state/store.ts'))
  const { restaurantStore: store } = await import(pathToFileURL(modulePath))
  assert.equal(store.getSnapshot().data.tables.length, 0)
  assert.equal(store.getSnapshot().data.orders.length, 0)
  assert.equal(store.login('admin'), '')
  assert.equal(await store.refresh(), null)
  const users = JSON.stringify(store.getSnapshot().data.users)
  const uuid = crypto.randomUUID()
  assert.equal(
    await store.act({ type: 'saveTable', id: uuid, number: 12, capacity: 4 }),
    '',
  )
  const mesa = store
    .getSnapshot()
    .data.tables.find((item) => item.number === 12)
  assert.ok(mesa)
  assert.notEqual(mesa.id, uuid)
  const dishDraft = {
    id: crypto.randomUUID(),
    name: 'Prueba desde frontend',
    description: 'Datos reales de la base temporal',
    price: 1550,
    image: '',
    category: 'Entradas',
    available: true,
  }
  assert.equal(await store.act({ type: 'saveDish', dish: dishDraft }), '')
  const dish = store
    .getSnapshot()
    .data.dishes.find((item) => item.name === dishDraft.name)
  assert.ok(dish)
  assert.equal(
    await store.act({ type: 'openTable', id: mesa.id, diners: 2 }),
    '',
  )
  store.logout()
  store.login('mozo')
  assert.equal(
    await store.act({
      type: 'createOrder',
      tableId: mesa.id,
      items: [{ dishId: dish.id, quantity: 2, notes: 'Sin sal' }],
    }),
    '',
  )
  let order = store
    .getSnapshot()
    .data.orders.find((item) => item.tableId === mesa.id)
  assert.ok(order.createdAt)
  assert.equal(order.items[0].unitPrice, 1550)
  assert.equal(order.waiterId, store.getSnapshot().session.id)
  const { compareOrderPriority } = await import(
    pathToFileURL(await compile(path.join(root, 'src/state/model.ts')))
  )
  assert.equal(
    await store.act({
      type: 'createOrder',
      tableId: mesa.id,
      items: [{ dishId: dish.id, quantity: 1, notes: 'Segunda comanda' }],
    }),
    '',
  )
  const extra = store
    .getSnapshot()
    .data.orders.find(
      (item) => item.tableId === mesa.id && item.id !== order.id,
    )
  assert.ok(extra)
  assert.ok(
    (await store.act({
      type: 'reorderOrder',
      id: extra.id,
      targetId: order.id,
      before: true,
    })) instanceof Error,
    'Solo el chef puede priorizar desde la interfaz',
  )
  store.logout()
  store.login('chef')
  assert.equal(
    await store.act({
      type: 'reorderOrder',
      id: extra.id,
      targetId: order.id,
      before: true,
    }),
    '',
  )
  store.logout()
  store.login('mozo')
  assert.equal(await store.refresh(), null)
  const prioritized = store
    .getSnapshot()
    .data.orders.filter((item) => item.tableId === mesa.id)
    .sort(compareOrderPriority)
  assert.deepEqual(
    prioritized.map((item) => item.id),
    [extra.id, order.id],
    'El mozo carga desde el backend la prioridad definida por el chef',
  )
  assert.equal(
    await store.act({
      type: 'transition',
      id: extra.id,
      status: 'cancelado',
    }),
    '',
  )
  assert.equal(
    store.getSnapshot().data.orders.find((item) => item.id === extra.id)
      .priority,
    null,
    'Los pedidos finalizados se retiran de la cola',
  )
  assert.equal(
    await store.act({
      type: 'editOrder',
      id: order.id,
      items: [{ dishId: dish.id, quantity: 3, notes: 'Sin pimienta' }],
    }),
    '',
  )
  store.logout()
  store.login('chef')
  const error = await store.act({
    type: 'transition',
    id: order.id,
    status: 'listo',
  })
  assert.ok(error instanceof Error)
  assert.equal(error.response.status, 400)
  assert.ok(error.response.data.stack)
  assert.equal(
    store.getSnapshot().error,
    error,
    'Se conserva el error completo',
  )
  for (const status of ['preparacion', 'listo'])
    assert.equal(
      await store.act({ type: 'transition', id: order.id, status }),
      '',
    )
  store.logout()
  store.login('mozo')
  assert.equal(
    await store.act({ type: 'transition', id: order.id, status: 'entregado' }),
    '',
  )
  assert.equal(await store.act({ type: 'closeTable', id: mesa.id }), '')
  store.logout()
  store.login('admin')
  order = store.getSnapshot().data.orders.find((item) => item.id === order.id)
  assert.equal(order.history.length, 4)
  assert.equal(order.items[0].quantity, 3)
  assert.equal(
    await store.act({
      type: 'saveDish',
      dish: { ...dish, price: 3000, available: false },
    }),
    '',
  )
  assert.equal(
    store.getSnapshot().data.orders.find((item) => item.id === order.id)
      .items[0].unitPrice,
    1550,
  )
  assert.equal(
    await store.act({
      type: 'createSummary',
      summary: {
        tipo: 'Frontend',
        ganancias: 4650,
        pedidos: 1,
        pedidos_cancelados: 0,
      },
    }),
    '',
  )
  const summary = store
    .getSnapshot()
    .resumenes.find((item) => item.tipo === 'Frontend')
  assert.ok(summary)
  assert.equal(
    await store.act({ type: 'deleteSummary', id: summary.id_resumen }),
    '',
  )
  assert.equal(await store.act({ type: 'deleteDish', id: dish.id }), '')
  assert.equal(await store.act({ type: 'deleteTable', id: mesa.id }), '')
  assert.equal(JSON.stringify(store.getSnapshot().data.users), users)
  assert.equal(
    writes,
    0,
    'Las operaciones remotas no guardan mocks ni usuarios',
  )
  // La creación de usuarios conserva el almacenamiento local y no requiere una API.
  assert.equal(
    await store.saveUser(
      {
        id: 'local-test-user',
        name: 'Usuario local',
        username: 'test.local',
        role: 'mozo',
        active: true,
      },
      'Clave de prueba',
    ),
    '',
  )
  assert.equal(writes, 1)
  assert.ok(saved.has('nacar.users.v1'))
  assert.deepEqual(Object.keys(JSON.parse(saved.get('nacar.users.v1'))), [
    'users',
  ])
  console.log(
    'OK: store real + Axios + MySQL: roles locales, CRUD, pedidos, edición, estados, historial, precios, resúmenes y error completo. Sin mocks operativos.',
  )
} finally {
  delete globalThis.localStorage
  delete globalThis.window
  // Solo se elimina la carpeta temporal verificada de esta ejecución.
  assert.ok(output.startsWith(path.join(root, '.verification') + path.sep))
  await fs.rm(output, { recursive: true, force: true })
}
