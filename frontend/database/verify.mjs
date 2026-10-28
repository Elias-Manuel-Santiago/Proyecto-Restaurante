import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const requireBackend = createRequire(
  new URL('../../backend/package.json', import.meta.url),
)
const mysql = requireBackend('mysql2/promise')
const name = `codex_restaurante_test_${randomBytes(6).toString('hex')}`
assert.match(name, /^codex_restaurante_test_[a-f0-9]+$/)
const db = await mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
})
let created = false
try {
  await db.query(
    'CREATE DATABASE ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
    [name],
  )
  created = true
  await db.query('USE ??', [name])
  const sql = await readFile(
    new URL('./restaurante.sql', import.meta.url),
    'utf8',
  )
  const statements = sql
    .replace(/^\s*--.*$/gm, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const statement of statements) await db.query(statement)
  const [tables] = await db.query('SHOW TABLES')
  assert.equal(tables.length, 16)
  await assert.rejects(
    db.query(statements[1]),
    (e) => e.code === 'ER_TABLE_EXISTS_ERROR',
  )
  // El escenario existente prueba migración dos veces, API y store real del frontend.
  const run = spawnSync(process.execPath, ['tests/scenario.js'], {
    cwd: fileURLToPath(new URL('../../backend/', import.meta.url)),
    env: { ...process.env, DB_DATABASE: name },
    encoding: 'utf8',
    timeout: 120000,
  })
  await mkdir(new URL('../.verification/', import.meta.url), {
    recursive: true,
  })
  await writeFile(
    new URL('../.verification/schema-api.log', import.meta.url),
    run.stdout + run.stderr,
  )
  assert.equal(run.status, 0, run.error?.message ?? run.stdout + run.stderr)
  console.log(run.stdout.trim())

  await db.beginTransaction()
  try {
    const [u] = await db.query(
      "INSERT INTO usuarios (usuario,nombre,tipo,password_hash) VALUES ('prueba','Prueba','mozo','solo-prueba-no-es-una-clave')",
    )
    const token = 'a'.repeat(64)
    await db.query(
      'INSERT INTO sesiones_usuarios (id_usuario,token_hash,expira_en) VALUES (?,?,DATE_ADD(NOW(3), INTERVAL 1 DAY))',
      [u.insertId, token],
    )
    await assert.rejects(
      db.query(
        'INSERT INTO sesiones_usuarios (id_usuario,token_hash,expira_en) VALUES (?,?,DATE_ADD(NOW(3), INTERVAL 1 DAY))',
        [u.insertId, token],
      ),
    )
    await assert.rejects(
      db.query(
        'INSERT INTO sesiones_usuarios (id_usuario,token_hash,expira_en) VALUES (?,?,DATE_SUB(NOW(3), INTERVAL 1 DAY))',
        [u.insertId, 'b'.repeat(64)],
      ),
    )
    const [m] = await db.query(
      'INSERT INTO mesas (numero,cantidad_personas) VALUES (998,4)',
    )
    const [c] = await db.query(
      "INSERT INTO comidas (tipo,nombre,descripcion,precio) VALUES ('Entradas','Prueba','',100)",
    )
    const [p] = await db.query(
      'INSERT INTO pedidos (id_mesa,id_mesero) VALUES (?,?)',
      [m.insertId, u.insertId],
    )
    await db.query(
      'INSERT INTO pedidos_comida (id_pedido,id_comida,cantidad) VALUES (?,?,1)',
      [p.insertId, c.insertId],
    )
    await assert.rejects(
      db.query(
        'INSERT INTO pedidos_comida (id_pedido,id_comida,cantidad) VALUES (?,?,1)',
        [p.insertId, c.insertId],
      ),
    )
    await assert.rejects(
      db.query('UPDATE pedidos_comida SET cantidad=0 WHERE id_pedido=?', [
        p.insertId,
      ]),
    )
    await assert.rejects(
      db.query('DELETE FROM mesas WHERE id_mesa=?', [m.insertId]),
    )
    await assert.rejects(
      db.query('DELETE FROM comidas WHERE id_comida=?', [c.insertId]),
    )
    await assert.rejects(
      db.query("UPDATE pedidos SET estado='inexistente' WHERE id_pedidos=?", [
        p.insertId,
      ]),
    )
    await assert.rejects(
      db.query("UPDATE pedidos SET historial='no-json' WHERE id_pedidos=?", [
        p.insertId,
      ]),
    )
    await db.query('DELETE FROM usuarios WHERE id_usuario=?', [u.insertId])
    const [[order]] = await db.query(
      'SELECT id_mesero FROM pedidos WHERE id_pedidos=?',
      [p.insertId],
    )
    assert.equal(order.id_mesero, null)
    const [[sessions]] = await db.query(
      'SELECT COUNT(*) AS n FROM sesiones_usuarios WHERE id_usuario=?',
      [u.insertId],
    )
    assert.equal(sessions.n, 0)
    await db.query('DELETE FROM pedidos WHERE id_pedidos=?', [p.insertId])
    const [[items]] = await db.query(
      'SELECT COUNT(*) AS n FROM pedidos_comida WHERE id_pedido=?',
      [p.insertId],
    )
    assert.equal(items.n, 0)
    const [r] = await db.query(
      "INSERT INTO resumenes (tipo,ganancias,pedidos,pedidos_cancelados) VALUES ('Prueba',0,0,0)",
    )
    await db.query(
      'INSERT INTO resumen_comida (id_resumen,id_comida,posicion) VALUES (?,?,1)',
      [r.insertId, c.insertId],
    )
    await db.query('DELETE FROM resumenes WHERE id_resumen=?', [r.insertId])
    const [[rItems]] = await db.query(
      'SELECT COUNT(*) AS n FROM resumen_comida WHERE id_resumen=?',
      [r.insertId],
    )
    assert.equal(rItems.n, 0)
  } finally {
    await db.rollback()
  }
  console.log(
    'OK: importación de 16 tablas, PK compuestas, CHECK, FK, cascadas, sesiones futuras y protección de históricos.',
  )
} finally {
  if (created) await db.query('DROP DATABASE ??', [name])
  await db.end()
}
