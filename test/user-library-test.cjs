/* Stubbed node harness for src/27-library.js: indexedDB（多对象仓库 + 版本升级）
   + Image + canvas + Blob。壁纸库与音乐库共用同一个假数据库。 */
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(path.join(__dirname, '..', 'src', '27-library.js'), 'utf8')

const failures = []
function check(name, condition, extra) {
  const ok = !!condition
  if (!ok) failures.push(name)
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : ''))
}

/* ---- fake IndexedDB: 多对象仓库，open(name, version) 触发 onupgradeneeded ---- */
function makeIndexedDB(initial) {
  const stores = new Map()
  const openCalls = []
  const seed = initial || {}
  let version = seed.version || 0

  Object.keys(seed.stores || {}).forEach(function seedStore(name) {
    const records = new Map()
    seed.stores[name].forEach(function addRecord(record) {
      records.set(record.id, record)
    })
    stores.set(name, records)
  })

  function later(fn) {
    setTimeout(fn, 0)
  }

  function storeRecords(name) {
    if (!stores.has(name)) throw new Error('missing object store: ' + name)
    return stores.get(name)
  }

  const database = {
    objectStoreNames: {
      contains(name) {
        return stores.has(name)
      },
    },
    createObjectStore(name) {
      if (stores.has(name)) throw new Error('object store already exists: ' + name)
      stores.set(name, new Map())
      return { createIndex() {} }
    },
    transaction(name) {
      const records = storeRecords(name)
      const tx = {}
      const store = {
        getAll() {
          const request = {}
          later(function respond() {
            request.result = Array.from(records.values())
            if (request.onsuccess) request.onsuccess()
          })
          return request
        },
        put(record) {
          records.set(record.id, record)
          later(function complete() {
            if (tx.oncomplete) tx.oncomplete()
          })
        },
        delete(id) {
          records.delete(id)
          later(function complete() {
            if (tx.oncomplete) tx.oncomplete()
          })
        },
      }
      tx.objectStore = function objectStore() {
        return store
      }
      return tx
    },
  }

  return {
    openCalls,
    storeNames() {
      return Array.from(stores.keys())
    },
    open(name, requestedVersion) {
      openCalls.push(requestedVersion)
      const request = {}
      later(function run() {
        request.result = database
        const target = requestedVersion || 1
        if (target > version) {
          version = target
          if (request.onupgradeneeded) request.onupgradeneeded()
        }
        if (request.onsuccess) request.onsuccess()
      })
      return request
    },
  }
}

/* ---- fake Image: setting .src succeeds on the next tick ---- */
class FakeImage {
  constructor() {
    this.naturalWidth = 3200
    this.naturalHeight = 1800
    this.width = 3200
    this.height = 1800
  }
  set src(_value) {
    setTimeout(() => {
      if (this.onload) this.onload()
    }, 0)
  }
}

/* ---- fake canvas context / element ---- */
function makeDocument() {
  return {
    createElement(tag) {
      if (tag !== 'canvas') throw new Error('unexpected element ' + tag)
      const canvas = {
        width: 0,
        height: 0,
        getContext() {
          return {
            imageSmoothingEnabled: false,
            imageSmoothingQuality: 'low',
            drawImage() {},
          }
        },
        toBlob(callback, type, quality) {
          setTimeout(() => callback(new Blob(['x'.repeat(64)], { type: type || 'image/jpeg' })), 0)
        },
      }
      return canvas
    },
  }
}

/* ---- 收集 console.warn，避免库里的“跳过导入”提示污染测试输出 ---- */
function makeConsole() {
  const warnings = []
  return {
    warnings,
    console: {
      log() {},
      error() {},
      warn() {
        warnings.push(Array.prototype.map.call(arguments, String).join(' '))
      },
    },
  }
}

const EXPORTS =
  '\nreturn { mcUserWallpapers, mcUserAdd, mcUserAddFiles, mcUserFind, mcUserUrl, mcUserRefresh, mcUserRemove,' +
  ' mcUserMusic, mcUserMusicRefresh, mcUserMusicFind, mcUserMusicBlob, mcUserMusicName, mcUserMusicAdd,' +
  ' mcUserMusicAddFiles, mcUserMusicRemove }'

/* 用同一份源码 + 独立的假数据库/console 求值，得到一套全新的库实例。 */
function evaluate(indexedDB, sink) {
  const probe = new Function('window', 'document', 'Image', 'Blob', 'URL', 'console', source + EXPORTS)
  return probe({ indexedDB }, makeDocument(), FakeImage, Blob, URL, sink.console)
}

function audioBytes(values) {
  return new Uint8Array(values)
}

/* ============ 全新安装：数据库从 0 升到 2，两个仓库都建出来 ============ */
async function freshInstallSuite() {
  const indexedDB = makeIndexedDB()
  const sink = makeConsole()
  const api = evaluate(indexedDB, sink)

  /* ---- 壁纸库：原有断言原样保留（回归） ---- */
  check('library starts empty', api.mcUserWallpapers.items.length === 0)
  const empty = await api.mcUserRefresh()
  check('refresh on empty db returns empty list', empty.items.length === 0 && empty.ready === true)
  check('db opens at version 2', indexedDB.openCalls.length > 0 && indexedDB.openCalls.every((v) => v === 2), JSON.stringify(indexedDB.openCalls))
  check('upgrade creates wallpapers + music', indexedDB.storeNames().join(',') === 'wallpapers,music', indexedDB.storeNames().join(','))

  const file = new File([new Uint8Array([1, 2, 3])], '测试 壁纸.png', { type: 'image/png' })
  const id = await api.mcUserAdd(file)
  check('add returns user- id', /^user-/.test(id), id)
  check('add registers one item', api.mcUserWallpapers.items.length === 1)
  const item = api.mcUserFind(id)
  check('record keeps a name', item && item.name === '测试 壁纸', item && item.name)
  check('record keeps scaled size', item && item.width === 1920 && item.height === 1080, item && item.width + 'x' + item.height)
  check('record has blobs', item && typeof item.full.size === 'number' && typeof item.thumb.size === 'number')
  const fullUrl = api.mcUserUrl(id, false)
  const thumbUrl = api.mcUserUrl(id, true)
  check('full object url', typeof fullUrl === 'string' && fullUrl.indexOf('blob:') === 0)
  check('thumb object url', typeof thumbUrl === 'string' && thumbUrl.indexOf('blob:') === 0)
  check('url is cached per size', api.mcUserUrl(id, true) === thumbUrl && api.mcUserUrl(id, false) === fullUrl)

  const ids = await api.mcUserAddFiles([new File(['a'], 'two.jpg', { type: 'image/jpeg' })])
  check('addFiles imports one more', ids.length === 1 && api.mcUserWallpapers.items.length === 2)

  await api.mcUserRemove(id)
  check('remove deletes the record', api.mcUserWallpapers.items.length === 1 && api.mcUserFind(id) === null)
  check('removed url is gone', api.mcUserUrl(id, false) === '')

  let threw = false
  try {
    await api.mcUserAdd(new File(['x'], 'notes.txt', { type: 'text/plain' }))
  } catch (error) {
    threw = true
  }
  check('non-image rejected', threw)

  /* ---- 音乐库 ---- */
  check('music starts empty and not ready', api.mcUserMusic.items.length === 0 && api.mcUserMusic.ready === false)
  const musicEmpty = await api.mcUserMusicRefresh()
  check('music refresh on empty db returns empty list', musicEmpty.items.length === 0 && musicEmpty.ready === true)

  const bytes = audioBytes([0x49, 0x44, 0x33, 0x04, 0x00, 0x01, 0x02, 0x03])
  const musicId = await api.mcUserMusicAdd(new File([bytes], '测试 曲目.mp3', { type: 'audio/mpeg' }))
  check('music add returns user-music- id', /^user-music-/.test(musicId), musicId)
  check('music add registers one item', api.mcUserMusic.items.length === 1)

  const track = api.mcUserMusicFind(musicId)
  check('music name strips extension and trims', track && track.name === '测试 曲目', track && track.name)
  check('music desc', track && track.desc === '我上传的音乐')
  check('music mime', track && track.mime === 'audio/mpeg', track && track.mime)
  check('music bytes', track && track.bytes === bytes.length && track.blob.size === bytes.length)
  check('music name helper', api.mcUserMusicName(musicId) === '测试 曲目', api.mcUserMusicName(musicId))
  check('music name helper for unknown id', api.mcUserMusicName('missing-id') === '')

  const blob = api.mcUserMusicBlob(musicId)
  check('music blob is a Blob', blob instanceof Blob)
  const roundtrip = new Uint8Array(await blob.arrayBuffer())
  const sameBytes = roundtrip.length === bytes.length && bytes.every((value, index) => value === roundtrip[index])
  check('music blob bytes round-trip', sameBytes, roundtrip.length + ' bytes')
  check('music blob for unknown id is null', api.mcUserMusicBlob('missing-id') === null)

  let notified = 0
  const unsubscribe = api.mcUserMusic.subscribe(function listener() {
    notified += 1
  })
  await api.mcUserMusicRefresh()
  unsubscribe()
  check('music subscribe fires once and unsubscribes', notified === 1, 'notified=' + notified)

  const musicIds = await api.mcUserMusicAddFiles([
    new File([new Uint8Array([1, 2, 3])], 'ambient.ogg', { type: '' }),
    new File([new Uint8Array([4, 5, 6])], 'drums.wav', { type: 'audio/wav' }),
  ])
  check('music addFiles imports two files', musicIds.length === 2, JSON.stringify(musicIds))
  check('music addFiles grows the list', api.mcUserMusic.items.length === 3)
  const ogg = api.mcUserMusicFind(musicIds[0])
  check('extension-only audio accepted and mime inferred', /^user-music-/.test(musicIds[0]) && ogg.mime === 'audio/ogg', ogg && ogg.mime)

  const sorted = api.mcUserMusic.items
  const newestFirst = sorted.every(function ordered(_entry, index) {
    return index === 0 || sorted[index - 1].createdAt >= sorted[index].createdAt
  })
  check('music list sorted newest first', newestFirst)

  const blankId = await api.mcUserMusicAdd(new File([new Uint8Array([7])], '   .mp3', { type: 'audio/mpeg' }))
  check('blank name falls back to 我的音乐', api.mcUserMusicName(blankId) === '我的音乐', api.mcUserMusicName(blankId))

  const longId = await api.mcUserMusicAdd(new File([new Uint8Array([8])], 'a'.repeat(80) + '.mp3', { type: 'audio/mpeg' }))
  check('name is capped at 48 chars', api.mcUserMusicName(longId).length === 48, String(api.mcUserMusicName(longId).length))

  const mixedIds = await api.mcUserMusicAddFiles([
    new File([new Uint8Array([9])], 'ok.flac', { type: 'audio/flac' }),
    new File(['not audio'], 'notes.txt', { type: 'text/plain' }),
  ])
  check('mixed batch keeps the audio and skips the rest', mixedIds.length === 1, JSON.stringify(mixedIds))
  check('skipped batch entry logged a warning', sink.warnings.some((line) => line.indexOf('music import skipped') >= 0))

  const beforeRemove = api.mcUserMusic.items.length
  await api.mcUserMusicRemove(musicId)
  check('music remove deletes the record', api.mcUserMusicFind(musicId) === null && api.mcUserMusic.items.length === beforeRemove - 1)
  check('music blob after remove is null', api.mcUserMusicBlob(musicId) === null)

  let nonAudio = ''
  try {
    await api.mcUserMusicAdd(new File(['x'], 'notes.txt', { type: 'text/plain' }))
  } catch (error) {
    nonAudio = String((error && error.message) || error)
  }
  check('non-audio rejected with not audio', nonAudio === 'not audio', nonAudio)

  let oversize = ''
  try {
    await api.mcUserMusicAdd({ name: 'huge.mp3', type: 'audio/mpeg', size: 61 * 1024 * 1024 })
  } catch (error) {
    oversize = String((error && error.message) || error)
  }
  check('oversize audio rejected', oversize === 'audio too large', oversize)
  check('oversize audio logged a warning', sink.warnings.some((line) => line.indexOf('too large') >= 0))

  check('wallpaper library unaffected by music imports', api.mcUserWallpapers.items.length === 1)
  check('music snapshot mirrors items', api.mcUserMusic.snapshot().items.length === api.mcUserMusic.items.length)
}

/* ============ 老用户升级：v1 库已有壁纸，升到 v2 后壁纸不丢、music 可用 ============ */
async function legacyUpgradeSuite() {
  const legacy = {
    id: 'user-legacy-1',
    name: '旧壁纸',
    desc: '我上传的壁纸',
    createdAt: 1700000000000,
    width: 100,
    height: 50,
    full: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
    thumb: new Blob([new Uint8Array([4, 5])], { type: 'image/jpeg' }),
  }
  const indexedDB = makeIndexedDB({ version: 1, stores: { wallpapers: [legacy] } })
  const sink = makeConsole()
  const api = evaluate(indexedDB, sink)

  const state = await api.mcUserRefresh()
  check('legacy v1 wallpaper survives the v2 upgrade', state.items.length === 1 && state.items[0].id === legacy.id, state.items.length)
  check('legacy upgrade adds only the music store', indexedDB.storeNames().join(',') === 'wallpapers,music', indexedDB.storeNames().join(','))
  check('legacy upgrade still opens at version 2', indexedDB.openCalls.every((v) => v === 2), JSON.stringify(indexedDB.openCalls))

  const musicId = await api.mcUserMusicAdd(new File([new Uint8Array([6, 7, 8])], 'legacy.mp3', { type: 'audio/mpeg' }))
  check('music works on a legacy database', /^user-music-/.test(musicId) && api.mcUserMusic.items.length === 1, musicId)
  check('legacy music blob readable', api.mcUserMusicBlob(musicId) !== null && api.mcUserMusicName(musicId) === 'legacy')

  const newId = await api.mcUserAdd(new File(['z'], 'new.png', { type: 'image/png' }))
  check('wallpaper import still works after upgrade', /^user-/.test(newId) && api.mcUserWallpapers.items.length === 2, newId)
}

;(async function run() {
  try {
    await freshInstallSuite()
    await legacyUpgradeSuite()
  } catch (error) {
    failures.push('unexpected exception: ' + ((error && error.stack) || error))
    console.error(error)
  }
  console.log(failures.length === 0 ? '\nuser library harness PASS' : '\nuser library harness FAILED: ' + failures.join(', '))
  process.exit(failures.length === 0 ? 0 : 1)
})()
