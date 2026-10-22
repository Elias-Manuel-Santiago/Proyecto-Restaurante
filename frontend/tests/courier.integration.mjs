import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import axios from 'axios'

test('repartidor: conserva perfiles anteriores, admite el rol y no llama a la API del salón', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const output = path.join(root, '.verification', `courier-${process.pid}`)
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
    code = code.replaceAll('import.meta.env.VITE_API_ROUTE', "'/api'")
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, code)
    return target
  }
  const oldUsers = [
    { id: 'admin-old', name: 'Admin anterior', role: 'admin', active: true },
    { id: 'mozo-old', name: 'Mozo anterior', role: 'mozo', active: true },
  ]
  const saved = new Map([
    ['nacar.users.v1', JSON.stringify({ users: oldUsers })],
  ])
  const originalAdapter = axios.defaults.adapter
  let requests = 0
  axios.defaults.adapter = async () => {
    requests++
    throw new Error('El repartidor no debe consultar la API del salón')
  }
  globalThis.localStorage = {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  }
  globalThis.window = { addEventListener: () => {} }
  try {
    const { restaurantStore: store } = await import(
      pathToFileURL(await compile(path.join(root, 'src/state/store.ts')))
    )
    const { homeRoute, roleRoutes, createInitialData } = await import(
      pathToFileURL(await compile(path.join(root, 'src/state/model.ts')))
    )
    assert.deepEqual(
      store.getSnapshot().data.users,
      oldUsers,
      'No agrega ni reemplaza perfiles guardados',
    )
    assert.ok(
      store.login('repartidor'),
      'Sin perfil se conserva el bloqueo de acceso por rol',
    )
    assert.equal(store.login('admin'), '')
    assert.equal(
      await store.saveUser(
        {
          id: 'courier-test',
          name: 'Repartidor de prueba',
          username: 'repartidor.prueba',
          role: 'repartidor',
          active: true,
        },
        'Clave de ejemplo',
      ),
      '',
    )
    assert.deepEqual(store.getSnapshot().data.users.slice(0, 2), oldUsers)
    store.logout()
    assert.equal(store.login('repartidor'), '')
    assert.equal(homeRoute(store.getSnapshot().session.role), '/reparto')
    assert.deepEqual(roleRoutes.repartidor, ['/reparto'])
    assert.equal(await store.refresh(), null)
    assert.ok(
      (await store.act({ type: 'openTable', id: '1', diners: 2 })) instanceof
        Error,
    )
    assert.equal(requests, 0, 'El acceso y la vista no envían solicitudes HTTP')
    assert.ok(
      createInitialData().users.some(
        (user) => user.role === 'repartidor' && user.active,
      ),
      'Una instalación sin perfiles guardados incluye el nuevo perfil demo',
    )
    assert.equal(homeRoute('mozo'), '/mesas')
    assert.equal(homeRoute('chef'), '/cocina')
    assert.equal(homeRoute('admin'), '/admin')
    assert.equal(store.getSnapshot().data.orders.length, 0)
  } finally {
    axios.defaults.adapter = originalAdapter
    delete globalThis.localStorage
    delete globalThis.window
    assert.ok(output.startsWith(path.join(root, '.verification') + path.sep))
    await fs.rm(output, { recursive: true, force: true })
  }
})
