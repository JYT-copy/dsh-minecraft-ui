/**
 * dsh-minecraft-ui build script.
 *
 * Concatenates src/*.js (in the fixed order below) into lib/client.js, then
 * validates the result: the bundle must parse as JavaScript and must still be
 * the module-loader wrapper the dsh web GUI expects.
 *
 *   node build.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))

/** Source order matters: everything is concatenated inside one factory closure. */
const PARTS = [
  'src/00-head.js',
  'src/10-store.js',
  'src/25-photos.js',
  'src/27-library.js',
  'src/30-audio.js',
  'src/40-styles.js',
  'src/45-runtime.js',
  'src/50-ui.js',
  'src/60-apply.js',
  'src/99-tail.js',
]

const BANNER = '/* dsh-minecraft-ui \u2014 generated bundle, do not edit. Source: src/ + build.mjs */\n'

const chunks = []
for (const part of PARTS) {
  const text = await readFile(join(root, part), 'utf8')
  chunks.push(`\n/* ---- ${part} ---- */\n${text.replace(/\s+$/, '')}\n`)
}

const bundle = BANNER + chunks.join('')

// --- validation -----------------------------------------------------------
const problems = []

try {
  // Parses the bundle without executing it (no DOM in node).
  new Function(bundle)
} catch (error) {
  problems.push(`syntax error: ${error && error.message}`)
}

if (!bundle.includes('window.__ModuleLoader__.load(')) {
  problems.push('missing window.__ModuleLoader__.load( wrapper')
}
if (!bundle.includes("id: 'dsh-minecraft-theme'")) {
  problems.push('missing loader id dsh-minecraft-theme (must equal the package name)')
}
if (!bundle.includes('apply: mcApply')) {
  problems.push('missing exported apply: mcApply')
}

if (problems.length > 0) {
  console.error('build failed:')
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

const outFile = join(root, 'lib/client.js')
await mkdir(join(root, 'lib'), { recursive: true })
await writeFile(outFile, bundle, 'utf8')

const kb = (Buffer.byteLength(bundle, 'utf8') / 1024).toFixed(1)
console.log(`built lib/client.js (${kb} KiB) from ${PARTS.length} sources`)
