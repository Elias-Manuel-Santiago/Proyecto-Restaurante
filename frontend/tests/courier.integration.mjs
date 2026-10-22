import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import axios from 'axios'

test('sesión: ignora accesos locales, exige credenciales, restaura cuenta y maneja expiración', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const output = path.join(root, '.verification', `auth-${process.pid}`)
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
  const original = axios.defaults.adapter
  const account = {
    id: '42',
    name: 'Repartidor SQL',
    username: 'repartidor',
    role: 'repartidor',
    active: true,
  }
  const password = crypto.randomUUID()
  let session = null
  const requests = []
  axios.defaults.adapter = async (config) => {
    requests.push(config.url)
    assert.equal(config.withCredentials, true)
    assert.equal(config.headers.get('X-Nacar-Request'), '1')
    let data
    if (config.url === '/auth/login') {
      const body = JSON.parse(config.data)
      if (body.username === account.username && body.password === password)
        session = account
      else
        throw new axios.AxiosError(
          'Unauthorized',
          'ERR_BAD_REQUEST',
          config,
          null,
          {
            status: 401,
            data: { message: 'Usuario o contraseña incorrectos.' },
          },
        )
      data = session
    } else if (config.url === '/auth/logout') {
      session = null
      data = {}
    } else if (config.url === '/auth/session' && session) data = session
    else
      throw new axios.AxiosError(
        'Unauthorized',
        'ERR_BAD_REQUEST',
        config,
        null,
        { status: 401, data: { message: 'Sesión vencida.' } },
      )
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  globalThis.localStorage = {
    getItem: () =>
      assert.fail('No restaura perfiles locales como autenticación'),
    setItem: () =>
      assert.fail('No guarda credenciales ni tokens en localStorage'),
  }
  try {
    const { restaurantStore: store } = await import(
      pathToFileURL(await compile(path.join(root, 'src/state/store.ts')))
    )
    assert.equal(store.getSnapshot().session, null)
    assert.equal(store.getSnapshot().data.users.length, 0)
    assert.ok(await store.login('admin', 'cualquier-cosa'))
    assert.equal(store.getSnapshot().session, null)
    assert.equal(await store.login('repartidor', password), '')
    assert.equal(store.getSnapshot().session.id, '42')
    await store.restoreSession()
    assert.equal(
      store.getSnapshot().session.id,
      '42',
      'Conserva la cuenta recuperada desde el servidor',
    )
    assert.equal(store.getSnapshot().authChecking, false)
    assert.equal(await store.refresh(), null)
    assert.ok(
      (await store.act({ type: 'openTable', id: '1', diners: 2 })) instanceof
        Error,
    )
    assert.ok(!requests.some((url) => url.startsWith('/mesas')))
    await store.logout()
    assert.equal(store.getSnapshot().session, null)
    assert.equal(await store.login('repartidor', password), '')
    session = null
    await store.restoreSession()
    assert.equal(store.getSnapshot().session, null)
    assert.ok(store.getSnapshot().warning.includes('venció'))
    const { adaptarEnvios } = await import(
      pathToFileURL(
        await compile(path.join(root, 'src/state/useDeliveries.ts')),
      )
    )
    const row = {
      id_pedido: 15,
      destinatario: 'Cliente',
      direccion: 'Dirección',
      indicaciones: '',
      estado: 'pendiente',
      estado_pedido: 'preparacion',
      nombre_comida: 'Plato',
      cantidad: 2,
      notas: 'Sin sal',
    }
    assert.equal(
      adaptarEnvios([row, { ...row, nombre_comida: 'Otro' }])[0].items.length,
      2,
    )
    assert.equal(adaptarEnvios([row])[0].status, 'en_cocina')
    assert.equal(
      adaptarEnvios([{ ...row, estado_pedido: 'listo' }])[0].status,
      'listo',
    )
    assert.equal(
      adaptarEnvios([{ ...row, estado: 'en_camino' }])[0].status,
      'en_camino',
    )
    assert.equal(
      adaptarEnvios([{ ...row, estado: 'entregado' }])[0].status,
      'entregado',
    )
  } finally {
    axios.defaults.adapter = original
    delete globalThis.localStorage
    assert.ok(output.startsWith(path.join(root, '.verification') + path.sep))
    await fs.rm(output, { recursive: true, force: true })
  }
})
