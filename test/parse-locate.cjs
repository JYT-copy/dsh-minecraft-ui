const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const root = process.cwd()
const PARTS = ['src/00-head.js','src/10-store.js','src/25-photos.js','src/27-library.js','src/30-audio.js','src/40-styles.js','src/45-runtime.js','src/50-ui.js','src/60-apply.js','src/99-tail.js']
const chunks = []
const spans = []
let line = 0
for (const part of PARTS) {
  const text = fs.readFileSync(path.join(root, part), 'utf8')
  const block = `\n/* ---- ${part} ---- */\n${text.replace(/\s+$/, '')}\n`
  spans.push({ part, start: line })
  line += block.split('\n').length - 1
  chunks.push(block)
}
const bundle = chunks.join('')
try {
  new vm.Script(bundle, { filename: 'bundle.js' })
  console.log('parse ok')
} catch (e) {
  console.log(String(e.stack || e).split('\n').slice(0, 4).join('\n'))
  const m = /bundle\.js:(\d+)/.exec(String(e.stack))
  if (m) {
    const at = Number(m[1])
    let cur = spans[0]
    for (const s of spans) if (s.start <= at) cur = s
    console.log('part:', cur.part, 'local line:', at - cur.start)
    const lines = bundle.split('\n')
    for (let i = Math.max(0, at - 3); i < Math.min(lines.length, at + 2); i += 1) console.log(String(i + 1).padStart(5), lines[i])
  }
}
