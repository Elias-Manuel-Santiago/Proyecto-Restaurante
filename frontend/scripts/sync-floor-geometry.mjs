/** Generación del validador del backend desde floorGeometry.ts; conserva una única fuente de reglas geométricas. */
// El servidor valida con la misma geometría que el editor, sin depender de TypeScript en runtime.
import fs from 'node:fs/promises'
import ts from 'typescript'
const source = await fs.readFile(
  new URL('../src/state/floorGeometry.ts', import.meta.url),
  'utf8',
)
const output =
  '// Generado desde frontend/src/state/floorGeometry.ts. Ver scripts/sync-floor-geometry.mjs.\n' +
  ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2023,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText
await fs.writeFile(
  new URL('../../backend/modules/restaurant/plano-geometria.js', import.meta.url),
  output,
)
