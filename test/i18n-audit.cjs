/**
 * i18n 覆盖自检
 * - 扫描 lib/client.js 里所有 mcT('key') 调用
 * - 与 src/10-store.js 的 zh / en 两本字典比对
 * - 报告：用了但没定义、只在一边有、两边都空
 *
 * Usage: node test/i18n-audit.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const bundle = fs.readFileSync(path.join(root, 'lib', 'client.js'), 'utf8')
const store = fs.readFileSync(path.join(root, 'src', '10-store.js'), 'utf8')

/* 动态拼接的前缀（如 'ach.' + name）不算缺失，这些前缀下的键会单独列出。 */
const DYNAMIC_PREFIXES = ['ach.']

const used = new Set([...bundle.matchAll(/mcT\(['"]([a-z0-9._]+)['"]/g)].map((m) => m[1]))
const zhBlock = store.split('zh: {')[1].split('en: {')[0]
const enBlock = store.split('en: {')[1]
const keysOf = (block) => new Set([...block.matchAll(/'([a-z0-9._]+)':/g)].map((m) => m[1]))
const zh = keysOf(zhBlock)
const en = keysOf(enBlock)

const staticUsed = [...used].filter((key) => !DYNAMIC_PREFIXES.some((prefix) => key === prefix))
const missingZh = staticUsed.filter((key) => !zh.has(key))
const missingEn = staticUsed.filter((key) => !en.has(key))
const onlyZh = [...zh].filter((key) => !en.has(key))
const onlyEn = [...en].filter((key) => !zh.has(key))

const lines = []
lines.push('used keys: ' + staticUsed.length + ' (zh ' + zh.size + ' / en ' + en.size + ')')
lines.push('missing in zh: ' + (missingZh.join(', ') || 'none'))
lines.push('missing in en: ' + (missingEn.join(', ') || 'none'))
lines.push('zh only: ' + (onlyZh.join(', ') || 'none'))
lines.push('en only: ' + (onlyEn.join(', ') || 'none'))

const failed = missingZh.length || missingEn.length || onlyZh.length || onlyEn.length
console.log(lines.join('\n'))
if (failed) {
  console.error('i18n audit FAIL')
  process.exit(1)
}
console.log('i18n audit PASS')
