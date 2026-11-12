/** Compara geometría generada y fuente TypeScript; prueba límites, colisiones y distribución sin base de datos. */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import * as serverGeometry from '../../backend/modules/restaurant/plano-geometria.js'

const source = await fs.readFile(
  new URL('../src/state/floorGeometry.ts', import.meta.url),
  'utf8',
)
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.ESNext,
  },
}).outputText
const geometry = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
)
const rect = (patch = {}) => ({
  shape: 'rectangle',
  x: 200,
  y: 200,
  width: 160,
  height: 80,
  rotation: 0,
  ...patch,
})
const circle = (patch = {}) =>
  rect({ shape: 'circle', width: 100, height: 100, ...patch })
const table = (id, layout) => ({ id, number: Number(id), capacity: 4, layout })

test('cliente y servidor ejecutan la misma geometría', async () => {
  const backend = await fs.readFile(
    new URL('../../backend/modules/restaurant/plano-geometria.js', import.meta.url),
    'utf8',
  )
  assert.equal(
    backend.slice(backend.indexOf('\n') + 1).trim(),
    compiled.trim(),
    'Regenerar plano-geometria.js desde floorGeometry.ts si cambia la geometría',
  )
})

for (const [name, g] of [
  ['frontend', geometry],
  ['backend', serverGeometry],
]) {
  test(`${name}: límites con esquinas rotadas y circunferencias`, () => {
    assert.ok(g.inBounds(rect({ x: 80, y: 40 })))
    assert.ok(!g.inBounds(rect({ x: 80, y: 40, rotation: 45 })))
    assert.ok(g.inBounds(circle({ x: 50, y: 50, rotation: 45 })))
    assert.ok(!g.inBounds(circle({ x: 49.9, y: 50 })))
    assert.ok(!g.inBounds(rect({ x: 1190, rotation: 315 })))
  })
  test(`${name}: colisiones exactas entre rectángulos rotados, círculos y formas mixtas`, () => {
    assert.ok(g.overlaps(rect(), rect({ x: 250 })))
    assert.ok(
      !g.overlaps(rect(), rect({ x: 360 })),
      'Contacto sin superposición permitido',
    )
    assert.ok(g.overlaps(rect(), rect({ x: 340, rotation: 45 })))
    assert.ok(
      !g.overlaps(
        rect({ width: 200, height: 64, rotation: 45 }),
        rect({ x: 150, y: 250, width: 200, height: 64, rotation: 45 }),
      ),
      'No basta comparar bounding boxes',
    )
    assert.ok(g.overlaps(circle(), circle({ x: 299 })))
    assert.ok(!g.overlaps(circle(), circle({ x: 300 })))
    assert.ok(g.overlaps(rect(), circle({ x: 300 })))
    assert.ok(!g.overlaps(rect(), circle({ x: 330 })))
    assert.ok(
      !g.overlaps(rect(), circle({ x: 320, y: 280 })),
      'Esquina de rectángulo fuera del radio',
    )
    assert.equal(
      g.overlaps(rect({ rotation: 45 }), circle({ x: 270, y: 270 })),
      g.overlaps(circle({ x: 270, y: 270 }), rect({ rotation: 45 })),
    )
  })
  test(`${name}: tamaños independientes, diámetro uniforme, giros y metadatos`, () => {
    assert.ok(g.validLayout(rect({ width: 64, height: 400, rotation: 315 })))
    for (const layout of [
      rect({ width: 63 }),
      rect({ height: 401 }),
      rect({ x: NaN }),
      rect({ rotation: 30 }),
      rect({ rotation: 360 }),
      circle({ height: 110 }),
    ])
      assert.ok(!g.validLayout(layout))
    assert.equal(
      g.validateFloor([table('1', rect()), table('2', circle({ x: 500 }))]),
      '',
    )
    assert.match(
      g.validateFloor([table('1', rect()), table('2', circle())]),
      /superponerse/,
    )
    assert.match(
      g.validateFloor([table('1', rect()), table('1', circle({ x: 500 }))]),
      /únicos/,
    )
    assert.match(
      g.validateFloor([{ ...table('1', rect()), capacity: 0 }]),
      /capacidad/,
    )
    assert.match(g.validateFloor([table('1', null)]), /ubicación/)
    assert.match(g.validateFloor([null]), /inválida/)
    assert.match(g.validateFloor([table('1', rect()), null]), /inválida/)
  })
  test(`${name}: distribución inicial conserva ubicaciones y coloca nuevas mesas sin colisiones`, () => {
    const fixed = table('1', circle({ x: 500, y: 400 }))
    const result = g.initializeFloor([
      fixed,
      ...Array.from({ length: 30 }, (_, i) => table(String(i + 2), null)),
    ])
    assert.equal(g.validateFloor(result), '')
    assert.deepEqual(result[0], fixed)
    assert.equal(
      g.floorSignature(result),
      g.floorSignature([...result].reverse()),
    )
    assert.equal(
      g.findSpace(rect({ width: 400, height: 400 }), [
        table('1', rect({ x: 200, width: 400, height: 400 })),
        table('2', rect({ x: 600, width: 400, height: 400 })),
        table('3', rect({ x: 1000, width: 400, height: 400 })),
        table('4', rect({ x: 200, y: 600, width: 400, height: 400 })),
        table('5', rect({ x: 600, y: 600, width: 400, height: 400 })),
        table('6', rect({ x: 1000, y: 600, width: 400, height: 400 })),
      ]),
      null,
    )
  })
}

test('mesas antiguas: compacta el salón sin ubicar mesas fuera del mapa', () => {
  const result = geometry.initializeFloor(
    Array.from({ length: 150 }, (_, i) => table(String(i + 1), null)),
  )
  assert.equal(geometry.validateFloor(result), '')
  const full = [200, 600, 1000].flatMap((x, i) =>
    [200, 600].map((y, j) =>
      table(String(i * 2 + j + 1), rect({ x, y, width: 400, height: 400 })),
    ),
  )
  const pending = geometry.initializeFloor([...full, table('7', null)])
  assert.equal(pending.length, 7)
  assert.equal(
    pending[6].layout,
    null,
    'La mesa pendiente conserva su identidad sin aparecer fuera del salón',
  )
  assert.match(geometry.validateFloor(pending), /ubicación/)
})
