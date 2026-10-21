/**
 * Lightweight static check of the CSS template literal in src/40-styles.js:
 * brace/paren balance, no `${}` interpolation, and crude declaration sanity.
 * Usage: node tmp/css-check.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const src = fs.readFileSync(path.join(root, 'src/40-styles.js'), 'utf8')

const marker = src.indexOf('const MC_CSS')
if (marker < 0) throw new Error('MC_CSS declaration not found')
const tickStart = src.indexOf('`', marker)
const tickEnd = src.lastIndexOf('`')
if (tickStart < 0 || tickEnd <= tickStart) throw new Error('template literal not found')

const css = src.slice(tickStart + 1, tickEnd)
console.log('css chars:', css.length)
console.log('has interpolation:', /\$\{/.test(css))

let depth = 0
let paren = 0
let line = 1
const errors = []
for (let i = 0; i < css.length; i += 1) {
  const c = css[i]
  if (c === '\n') line += 1
  else if (c === '{') depth += 1
  else if (c === '}') {
    depth -= 1
    if (depth < 0) {
      errors.push(`unbalanced } at line ${line}`)
      depth = 0
    }
  } else if (c === '(') paren += 1
  else if (c === ')') paren -= 1
}
console.log('final brace depth:', depth, 'paren depth:', paren)

const lines = css.split('\n')
const suspiciousSelector = []
const suspiciousDecl = []
for (let i = 0; i < lines.length; i += 1) {
  const raw = lines[i]
  const text = raw.trim()
  if (!text || text.startsWith('/*') || text.startsWith('*') || text.startsWith('//')) continue
  // A line that opens a block: selector part must not contain ';' or ':' at top level.
  const open = text.indexOf('{')
  if (open >= 0) {
    const selector = text.slice(0, open).trim()
    if (selector.includes(';')) suspiciousSelector.push(`${i + 1}: ${text}`)
    continue
  }
  if (text.endsWith(';') && !text.includes(':')) suspiciousDecl.push(`${i + 1}: ${text}`)
}
console.log('suspicious selectors:', suspiciousSelector.slice(0, 6))
console.log('suspicious declarations:', suspiciousDecl.slice(0, 6))
console.log('errors:', errors.slice(0, 6))
console.log('rule count:', (css.match(/\{/g) || []).length)
