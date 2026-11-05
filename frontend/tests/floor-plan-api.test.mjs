import test from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../../backend/app.js'
import db from '../../backend/modules/db.js'
import { planoDeFilas } from '../../backend/modules/plano.js'
import { hashToken } from '../../backend/modules/autenticacion.js'

const layout = (x = 200, patch = {}) => ({
  shape: 'rectangle',
  x,
  y: 200,
  width: 128,
  height: 96,
  rotation: 0,
  ...patch,
})
const fixture = () =>
  [1, 2].map((id) => ({
    id_mesa: id,
    numero: id,
    cantidad_personas: 4,
    estado: 'desocupada',
    comensales: 0,
    servicio_id: null,
    eliminado: 0,
    plano: JSON.stringify(layout(id * 250)),
  }))

test('API del plano: roles, transacción, conflicto y conservación del servicio', async (t) => {
  let rows = fixture(),
    saved,
    commits = 0,
    rollbacks = 0,
    writes = 0,
    failWrite = 0
  const tokens = Object.fromEntries(
    ['admin', 'mozo', 'chef', 'repartidor'].map((r, i) => [
      hashToken(String(i + 1).repeat(64)),
      r,
    ]),
  )
  t.mock.method(db, 'query', async (sql, params) => {
    if (sql.includes('FROM sesiones_usuarios')) {
      const role = tokens[params[0]]
      return [
        [
          {
            id_usuario: 1,
            usuario: role,
            nombre: 'Prueba',
            tipo: role,
            activo: 1,
            id_sesion: 1,
            expira_en: new Date(Date.now() + 3600000),
          },
        ],
      ]
    }
    if (sql.includes('FROM mesas'))
      return [structuredClone(rows.filter((r) => !r.eliminado))]
    throw new Error('Consulta inesperada: ' + sql)
  })
  t.mock.method(db, 'getConnection', async () => ({
    async beginTransaction() {
      saved = structuredClone(rows)
    },
    async commit() {
      commits++
    },
    async rollback() {
      rows = saved
      rollbacks++
    },
    release() {},
    async query(sql, params) {
      if (sql.includes('SELECT * FROM mesas'))
        return [
          structuredClone(
            sql.includes('eliminado=0')
              ? rows.filter((r) => !r.eliminado)
              : rows,
          ),
        ]
      if (sql.includes('COUNT(*)')) return [[{ cantidad: 0 }]]
      writes++
      if (failWrite && writes === failWrite)
        throw new Error('Fallo de prueba durante la escritura')
      if (sql.startsWith('UPDATE mesas SET eliminado')) {
        Object.assign(
          rows.find((r) => r.id_mesa === params[0]),
          { eliminado: 1, numero: null },
        )
      } else if (sql.startsWith('UPDATE mesas SET cantidad_personas')) {
        Object.assign(
          rows.find((r) => r.id_mesa === params[2]),
          { cantidad_personas: params[0], plano: params[1] },
        )
      } else if (sql.startsWith('INSERT INTO mesas')) {
        rows.push({
          id_mesa: Math.max(...rows.map((r) => r.id_mesa)) + 1,
          numero: params[0],
          cantidad_personas: params[1],
          plano: params[2],
          estado: 'desocupada',
          comensales: 0,
          servicio_id: null,
          eliminado: 0,
        })
      } else throw new Error('Escritura inesperada: ' + sql)
      return [{ affectedRows: 1 }]
    },
  }))
  t.mock.method(console, 'error', () => {})
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const url = `http://127.0.0.1:${server.address().port}/api/mesas`
  const request = async (body, role = 'admin', status = 200) => {
    const token = ['admin', 'mozo', 'chef', 'repartidor'].indexOf(role) + 1
    const response = await fetch(url + '/plano', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Nacar-Request': '1',
        Cookie: `nacar_session=${String(token).repeat(64)}`,
      },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    assert.equal(response.status, status, JSON.stringify(data))
    return data
  }
  try {
    const base = planoDeFilas(rows)
    for (const role of ['mozo', 'chef', 'repartidor'])
      await request({ base, tables: base }, role, 403)
    assert.equal(writes, 0)
    const draft = structuredClone(base)
    draft[0].layout = layout(220, {
      shape: 'circle',
      width: 150,
      height: 150,
      rotation: 45,
    })
    draft.pop()
    draft.push({
      id: 'new:12345678-1234-1234-1234-123456789012',
      number: 3,
      capacity: 6,
      layout: layout(600, { width: 200, height: 80, rotation: 90 }),
    })
    const result = await request({ base, tables: draft })
    assert.equal(commits, 1)
    assert.equal(rows.find((r) => r.id_mesa === 2).eliminado, 1)
    assert.equal(result[1].id_mesa, 3, 'MySQL conserva su asignación de IDs')
    assert.deepEqual(JSON.parse(result[0].plano), draft[0].layout)
    await request({ base, tables: draft }, 'admin', 409)
    assert.equal(commits, 1)
    let current = planoDeFilas(rows.filter((r) => !r.eliminado))
    const invalids = [
      current.map((t) => ({ ...t, layout: layout(220) })),
      [{ ...current[0], layout: layout(-20) }, current[1]],
      [
        {
          ...current[0],
          layout: layout(220, { shape: 'circle', height: 200 }),
        },
        current[1],
      ],
      [{ ...current[0], layout: layout(220, { rotation: 46 }) }, current[1]],
      [{ ...current[0], capacity: 31 }, current[1]],
    ]
    for (const tables of invalids)
      await request({ base: current, tables }, 'admin', 400)
    rows[0].estado = 'ocupada'
    rows[0].comensales = 3
    rows[0].servicio_id = 'visita-original'
    await request({ base: current, tables: [current[1]] }, 'admin', 400)
    await request(
      { base: current, tables: [{ ...current[0], capacity: 2 }, current[1]] },
      'admin',
      400,
    )
    const moved = structuredClone(current)
    moved[0].layout.x += 20
    await request({ base: current, tables: moved })
    assert.equal(rows[0].servicio_id, 'visita-original')
    assert.equal(rows[0].estado, 'ocupada')
    assert.equal(rows[0].comensales, 3)
    current = planoDeFilas(rows.filter((r) => !r.eliminado))
    const beforeFailure = structuredClone(rows)
    writes = 0
    failWrite = 2
    const failing = structuredClone(current)
    failing[0].layout.x += 10
    await request({ base: current, tables: failing }, 'admin', 400)
    assert.deepEqual(
      rows,
      beforeFailure,
      'Un fallo posterior revierte también la primera escritura',
    )
    assert.ok(rollbacks >= 4)
    failWrite = 0
    // La disponibilidad cambia durante la edición: no es un conflicto del plano.
    await request({ base: current, tables: current })
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await db.end()
  }
})
