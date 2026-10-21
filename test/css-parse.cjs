/**
 * Parse src/40-styles.js MC_CSS with lightningcss to surface real CSS errors.
 * Usage: node tmp/css-parse.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const PROFILE_MODULES = 'C:\\Users\\纪永泰\\.dsh\\profiles\\desktop\\node_modules'
const { transform } = require(path.join(PROFILE_MODULES, 'lightningcss'))

const root = path.resolve(__dirname, '..')
const src = fs.readFileSync(path.join(root, 'src/40-styles.js'), 'utf8')
const marker = src.indexOf('const MC_CSS')
const tickStart = src.indexOf('`', marker)
const tickEnd = src.lastIndexOf('`')
const css = src.slice(tickStart + 1, tickEnd)

try {
  const result = transform({
    filename: 'mc.css',
    code: Buffer.from(css, 'utf8'),
    minify: false,
    errorRecovery: false,
  })
  console.log('parse OK, output bytes:', result.code.length)
  console.log('warnings:', (result.warnings || []).length)
  for (const w of (result.warnings || []).slice(0, 10)) console.log(' -', w.message || w)
} catch (error) {
  console.error('parse FAILED:', error.message)
  if (error.loc) console.error('at', JSON.stringify(error.loc))
  process.exitCode = 1
}
