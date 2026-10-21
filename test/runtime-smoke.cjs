/**
 * Headless smoke test for the options store and palette.
 *
 * Loads src/10-store.js into a Function with DOM stubs, then exercises:
 * settings merge/persist/normalise, the version-5 migration (ambient dropped,
 * BGM track reset), palette token generation and strip/restore.
 *
 * Usage: node tmp/runtime-smoke.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (name) => fs.readFileSync(path.join(root, 'src', name), 'utf8')

const body =
  "const MC_NS = 'minecraft-ui'\n" +
  "const MC_STORAGE_KEY = 'dsh.minecraft-ui.v1'\n" +
  "const MC_BODY_ATTR = 'data-mc-theme'\n" +
  "const MC_UI_ATTR = 'data-mc-ui'\n" +
  read('10-store.js') +
  '\nreturn { mcTokens, mcApplyPalette, mcStripPalette, mcSettings, mcLoadSettings, MC_DEFAULTS, mcIsDark, mcMerge, mcClamp, MC_SETTINGS_VERSION }'

// --- DOM stubs -------------------------------------------------------------
const store = new Map()
const styleValues = new Map()

function makeClassList() {
  const set = new Set()
  return {
    add: (name) => set.add(name),
    remove: (name) => set.delete(name),
    contains: (name) => set.has(name),
    toggle: (name, force) => {
      const on = force === undefined ? !set.has(name) : !!force
      if (on) set.add(name)
      else set.delete(name)
      return on
    },
    get value() {
      return Array.from(set).join(' ')
    },
  }
}

function elementStub(attrs) {
  const map = Object.assign({}, attrs || {})
  const style = {
    setProperty: (name, value) => styleValues.set(name, value),
    removeProperty: (name) => styleValues.delete(name),
    getPropertyValue: (name) => styleValues.get(name) || '',
  }
  return {
    style,
    classList: makeClassList(),
    dataset: {},
    hasAttribute: (name) => Object.prototype.hasOwnProperty.call(map, name),
    getAttribute: (name) => (map[name] === undefined ? null : map[name]),
    setAttribute: (name, value) => {
      map[name] = String(value)
    },
    removeAttribute: (name) => {
      delete map[name]
    },
  }
}

const bodyElement = elementStub({})
const documentElement = elementStub({})

globalThis.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  },
  navigator: { language: 'zh-CN' },
  matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
}
globalThis.document = {
  documentElement,
  body: bodyElement,
  createElement: () => elementStub({}),
}
globalThis.navigator = window.navigator
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' })

const api = new Function('window', 'document', 'navigator', body)(window, document, window.navigator)

// --- assertions ------------------------------------------------------------
let failures = 0
function check(name, ok, detail) {
  if (ok) return
  failures += 1
  console.error(`FAIL ${name}${detail === undefined ? '' : ' — ' + detail}`)
}

const defaults = api.MC_DEFAULTS
check('settings version is 7', api.MC_SETTINGS_VERSION === 7, String(api.MC_SETTINGS_VERSION))
check('no ambient section', defaults.ambient === undefined)
check('bgm defaults', defaults.bgm && defaults.bgm.enabled === false && defaults.bgm.volume === 0.22 && defaults.bgm.trackId === '')

// merge
const merged = api.mcMerge(defaults, { bgm: { enabled: true } })
check('merge keeps siblings', merged.bgm.volume === 0.22 && merged.bgm.enabled === true)

// persistence
api.mcSettings.patch({ bgm: { enabled: true, trackId: 'C418 - Sweden [mqms2].ogg' } })
const stored = JSON.parse(store.get('dsh.minecraft-ui.v1'))
check('patch persisted', stored.bgm.enabled === true && stored.bgm.trackId === 'C418 - Sweden [mqms2].ogg')
check('patch keeps wallpaper defaults', stored.wallpaper.gain === defaults.wallpaper.gain)

// clamp
api.mcSettings.patch({ bgm: { volume: 5 }, wallpaper: { dim: -3, gain: 99 }, ui: { glass: -1 } })
const clamped = api.mcSettings.get()
check('bgm volume clamped', clamped.bgm.volume === 1, String(clamped.bgm.volume))
check('dim clamped', clamped.wallpaper.dim === 0, String(clamped.wallpaper.dim))
check('gain clamped', clamped.wallpaper.gain === 1.6, String(clamped.wallpaper.gain))
check('glass clamped', clamped.ui.glass === 0, String(clamped.ui.glass))

// corrupt storage
store.set('dsh.minecraft-ui.v1', '{oops')
const recovered = api.mcLoadSettings()
check('corrupt storage falls back to defaults', recovered.bgm.trackId === '' && recovered.wallpaper.gain === defaults.wallpaper.gain)

// version-4 record migration: ambient dropped, brightness defaults restored
store.set(
  'dsh.minecraft-ui.v1',
  JSON.stringify({
    __v: 4,
    ambient: { enabled: true, volume: 0.4 },
    bgm: { enabled: true, volume: 0.3, trackId: 'old-synth' },
    wallpaper: { dim: 0.3, gain: 0.9 },
    ui: { glass: 0.9, achievements: true },
  })
)
const migrated = api.mcLoadSettings()
check('migration drops ambient', migrated.ambient === undefined)
check('migration resets track', migrated.bgm.trackId === '')
check('migration keeps bgm enabled', migrated.bgm.enabled === true)
check('migration restores dim/gain/glass', migrated.wallpaper.dim === defaults.wallpaper.dim && migrated.wallpaper.gain === defaults.wallpaper.gain && migrated.ui.glass === defaults.ui.glass)
check('migration stamps version', migrated.__v === 7)

// retired scene ids (the deleted pixel group) fall back to the default photo
store.set('dsh.minecraft-ui.v1', JSON.stringify({ __v: 5, wallpaper: { sceneId: 'plains-dusk' } }))
check('retired scene id resets', api.mcLoadSettings().wallpaper.sceneId === defaults.wallpaper.sceneId)
store.set('dsh.minecraft-ui.v1', JSON.stringify({ __v: 5, wallpaper: { sceneId: 'photo-xueluo-3' } }))
check('photo scene id kept', api.mcLoadSettings().wallpaper.sceneId === 'photo-xueluo-3')
store.set('dsh.minecraft-ui.v1', JSON.stringify({ __v: 5, wallpaper: { sceneId: 'user-mvgn5uup-cr0v' } }))
check('user scene id kept', api.mcLoadSettings().wallpaper.sceneId === 'user-mvgn5uup-cr0v')

// palette
store.delete('dsh.minecraft-ui.v1')
bodyElement.setAttribute('data-ds-dark-theme', '')
api.mcApplyPalette()
const appliedDark = new Map(styleValues)
check('palette sets surface tokens', ['--dsw-alias-bg-base', '--dsw-alias-bg-layer-1', '--dsw-alias-bg-layer-2'].every((name) => appliedDark.has(name)))
check('palette sets widget tokens', ['--mc-panel', '--mc-panel-2', '--mc-accent', '--mc-text'].every((name) => appliedDark.has(name)))
check('palette leaves labels alone', !appliedDark.has('--dsw-alias-label-primary') && !appliedDark.has('--dsw-alias-brand-primary'))
check('palette marks the body', bodyElement.hasAttribute('data-mc-theme') && bodyElement.getAttribute('data-mc-theme') === 'on')
check('palette marks the scheme', bodyElement.getAttribute('data-mc-scheme') === 'dark')

api.mcStripPalette()
check('strip removes tokens', styleValues.size === 0, String(styleValues.size))
check('strip removes body attrs', !bodyElement.hasAttribute('data-mc-theme') && !bodyElement.hasAttribute('data-mc-scheme'))

if (failures > 0) {
  console.error(`${failures} smoke check(s) failed`)
  process.exit(1)
}
console.log('all smoke checks passed')
