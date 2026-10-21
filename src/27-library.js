/* ============================================================
 * minecraft-ui / 27-library.js —— 用户自己上传的壁纸库（IndexedDB）
 *
 * 为什么用 IndexedDB 而不是宿主端目录：
 *   - 上传发生在浏览器里，File 对象不能直接交给宿主半（没有跨进程文件通道），
 *     走 base64 RPC 又会被截图级别的大图撑爆；
 *   - IndexedDB 能存 Blob，不进 localStorage 的 5MB 配额，刷新/重启后仍在；
 *   - 一张原图在这里会被缩到最长边 1920px 的 JPEG（约 150–400KB），
 *     另存一张 480px 缩略图给选择面板，所以不会无限膨胀。
 *
 * 对外只暴露三样东西：
 *   mcUserWallpapers  可订阅的库状态 { items, ready, subscribe }
 *   mcUserAdd(file) / mcUserAddFiles(list) / mcUserRemove(id)
 *   mcUserFind(id) / mcUserUrl(id, thumb) / mcUserRefresh()
 *
 * 文件末尾并列放着「用户音乐库」：共用同一个数据库，版本 2 新增 music 仓库。
 * 浏览器里没有通用音频编码器，所以音频不重新编码，原样存 Blob 给音频引擎解码。
 * 对外是 mcUserMusic 与 mcUserMusic* 一组顶层函数。
 *
 * 顶层标识符统一带 mc / MC_ 前缀，只在拼接后的浏览器函数体里使用。
 * ============================================================ */

/** IndexedDB 数据库与对象仓库名（随插件走，不与其他插件共享）。 */
const MC_USER_DB = 'dsh-minecraft-ui'
const MC_USER_STORE = 'wallpapers'
const MC_USER_MUSIC_STORE = 'music'
/* 版本 1 只有 wallpapers；版本 2 增加 music。升级回调里两个仓库都用
   objectStoreNames.contains 守卫，老用户升级不会丢壁纸，也不会重复建仓库抛错。 */
const MC_USER_DB_VERSION = 2

/** 存盘时的最大宽度与缩略图宽度（像素）。 */
const MC_USER_MAX_W = 1920
const MC_USER_THUMB_W = 480

/** 单个音频文件上限 60MB（超过的整条跳过，避免把 IndexedDB 配额撑爆）。 */
const MC_USER_MUSIC_MAX_BYTES = 60 * 1024 * 1024

/** 没有 file.type 时靠扩展名认音频（浏览器给的 File 有时 type 是空串）。 */
const MC_USER_MUSIC_EXTS = ['mp3', 'ogg', 'oga', 'wav', 'm4a', 'aac', 'flac', 'opus', 'webm']

/** 扩展名到 MIME 的兜底映射，只用于记录里展示，不影响解码。 */
const MC_USER_MUSIC_MIME = {
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  opus: 'audio/ogg',
  webm: 'audio/webm',
}

/** 打开插件数据库（壁纸库与音乐库共用同一个连接，升级逻辑只写一处）。 */
let mcUserDbPromise = null
function mcUserDb() {
  if (mcUserDbPromise) return mcUserDbPromise
  mcUserDbPromise = new Promise(function executor(resolve, reject) {
    let open = null
    try {
      open = window.indexedDB.open(MC_USER_DB, MC_USER_DB_VERSION)
    } catch (error) {
      reject(error)
      return
    }
    open.onupgradeneeded = function onUpgrade() {
      const database = open.result
      if (!database.objectStoreNames.contains(MC_USER_STORE)) {
        const store = database.createObjectStore(MC_USER_STORE, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
      }
      if (!database.objectStoreNames.contains(MC_USER_MUSIC_STORE)) {
        const store = database.createObjectStore(MC_USER_MUSIC_STORE, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
      }
    }
    open.onsuccess = function onSuccess() {
      resolve(open.result)
    }
    open.onerror = function onError() {
      reject(open.error || new Error('indexeddb open failed'))
    }
  })
  return mcUserDbPromise
}

/** 用户壁纸库：内存镜像 + 订阅，供 React 组件与运行时共用。 */
const mcUserWallpapers = (function userLibrary() {
  const state = { items: [], ready: false, error: '' }
  const listeners = new Set()
  const urls = new Map()

  function emit() {
    listeners.forEach(function notify(listener) {
      try {
        listener(state)
      } catch (error) {
        console.warn('[minecraft-ui] user wallpaper listener failed', error)
      }
    })
  }

  function snapshot() {
    return { items: state.items.slice(), ready: state.ready, error: state.error }
  }

  /** Promisify one IDBRequest. */
  function request(req) {
    return new Promise(function executor(resolve, reject) {
      req.onsuccess = function onSuccess() {
        resolve(req.result)
      }
      req.onerror = function onError() {
        reject(req.error || new Error('indexeddb request failed'))
      }
    })
  }

  /** Open the plugin database (shared connection; upgrade logic lives in mcUserDb). */
  function db() {
    return mcUserDb()
  }

  /** Object URL for one record (cached per id + 大小图). */
  function url(id, thumb) {
    const key = id + (thumb ? ':t' : ':f')
    if (urls.has(key)) return urls.get(key)
    const item = state.items.find(function match(entry) {
      return entry.id === id
    })
    if (!item) return ''
    const blob = thumb ? item.thumb || item.full : item.full
    if (!blob) return ''
    const objectUrl = URL.createObjectURL(blob)
    urls.set(key, objectUrl)
    return objectUrl
  }

  function releaseUrls(id) {
    const full = urls.get(id + ':f')
    const thumb = urls.get(id + ':t')
    if (full) URL.revokeObjectURL(full)
    if (thumb) URL.revokeObjectURL(thumb)
    urls.delete(id + ':f')
    urls.delete(id + ':t')
  }

  /** Reload the in-memory mirror from IndexedDB. */
  async function refresh() {
    let records = []
    try {
      const database = await db()
      records = await new Promise(function executor(resolve, reject) {
        const tx = database.transaction(MC_USER_STORE, 'readonly')
        const req = tx.objectStore(MC_USER_STORE).getAll()
        req.onsuccess = function onSuccess() {
          resolve(req.result || [])
        }
        req.onerror = function onError() {
          reject(req.error || new Error('indexeddb read failed'))
        }
      })
    } catch (error) {
      state.error = String((error && error.message) || error)
      state.ready = true
      console.warn('[minecraft-ui] user wallpaper library unavailable:', error)
      emit()
      return snapshot()
    }
    records.sort(function newestFirst(a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0)
    })
    const keep = new Set()
    state.items = records.map(function shape(record) {
      keep.add(record.id)
      return {
        id: record.id,
        name: record.name || '我的壁纸',
        desc: record.desc || '',
        createdAt: record.createdAt || 0,
        width: record.width || 0,
        height: record.height || 0,
        bytes: (record.full && record.full.size) || 0,
        full: record.full,
        thumb: record.thumb,
        kind: 'user',
      }
    })
    /* Drop object URLs of deleted records. */
    urls.forEach(function each(_value, key) {
      const id = key.replace(/:(t|f)$/, '')
      if (!keep.has(id)) {
        const full = urls.get(id + ':f')
        const thumb = urls.get(id + ':t')
        if (full) URL.revokeObjectURL(full)
        if (thumb) URL.revokeObjectURL(thumb)
        urls.delete(id + ':f')
        urls.delete(id + ':t')
      }
    })
    state.ready = true
    state.error = ''
    emit()
    return snapshot()
  }

  function find(id) {
    return state.items.find(function match(entry) {
      return entry.id === id
    }) || null
  }

  /** Decode a File through an <img>, so EXIF rotation is applied by the browser. */
  function decode(file) {
    return new Promise(function executor(resolve, reject) {
      const objectUrl = URL.createObjectURL(file)
      const image = new Image()
      image.onload = function onLoad() {
        resolve({ image: image, url: objectUrl })
      }
      image.onerror = function onError() {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('image decode failed'))
      }
      image.src = objectUrl
    })
  }

  function resize(image, maxWidth) {
    const natural = image.naturalWidth || image.width || 1
    const scale = Math.min(1, maxWidth / natural)
    const width = Math.max(1, Math.round(natural * scale))
    const height = Math.max(1, Math.round(((image.naturalHeight || image.height || 1) * scale)))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (context) {
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(image, 0, 0, width, height)
    }
    return { canvas: canvas, width: width, height: height }
  }

  function toBlob(canvas, quality) {
    return new Promise(function executor(resolve, reject) {
      try {
        canvas.toBlob(function onBlob(blob) {
          if (blob) resolve(blob)
          else reject(new Error('canvas encode failed'))
        }, 'image/jpeg', quality)
      } catch (error) {
        reject(error)
      }
    })
  }

  function makeId() {
    return 'user-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)
  }

  function stripExtension(name) {
    const text = String(name || '').replace(/\.[a-z0-9]+$/i, '')
    const trimmed = text.trim()
    return trimmed.length ? trimmed.slice(0, 32) : '我的壁纸'
  }

  /** Import one File; returns the new record id. */
  async function add(file) {
    if (!file || !/^image\//.test(String(file.type || ''))) {
      throw new Error('not an image')
    }
    const decoded = await decode(file)
    try {
      const full = resize(decoded.image, MC_USER_MAX_W)
      const thumb = resize(decoded.image, MC_USER_THUMB_W)
      const fullBlob = await toBlob(full.canvas, 0.86)
      const thumbBlob = await toBlob(thumb.canvas, 0.72)
      const record = {
        id: makeId(),
        name: stripExtension(file.name),
        desc: '我上传的壁纸',
        createdAt: Date.now(),
        width: full.width,
        height: full.height,
        full: fullBlob,
        thumb: thumbBlob,
      }
      const database = await db()
      await new Promise(function executor(resolve, reject) {
        const tx = database.transaction(MC_USER_STORE, 'readwrite')
        tx.objectStore(MC_USER_STORE).put(record)
        tx.oncomplete = function onComplete() {
          resolve()
        }
        tx.onerror = function onError() {
          reject(tx.error || new Error('indexeddb write failed'))
        }
      })
      await refresh()
      return record.id
    } finally {
      URL.revokeObjectURL(decoded.url)
    }
  }

  /** Import several Files (files picked at once); returns the new ids. */
  async function addFiles(fileList) {
    const ids = []
    const list = fileList ? Array.prototype.slice.call(fileList) : []
    for (let i = 0; i < list.length; i += 1) {
      try {
        ids.push(await add(list[i]))
      } catch (error) {
        console.warn('[minecraft-ui] wallpaper import skipped:', error)
      }
    }
    return ids
  }

  /** Delete one record (and its object URLs). */
  async function remove(id) {
    const database = await db()
    await new Promise(function executor(resolve, reject) {
      const tx = database.transaction(MC_USER_STORE, 'readwrite')
      tx.objectStore(MC_USER_STORE).delete(id)
      tx.oncomplete = function onComplete() {
        resolve()
      }
      tx.onerror = function onError() {
        reject(tx.error || new Error('indexeddb delete failed'))
      }
    })
    releaseUrls(id)
    await refresh()
  }

  function subscribe(listener) {
    listeners.add(listener)
    return function unsubscribe() {
      listeners.delete(listener)
    }
  }

  return {
    get items() {
      return state.items
    },
    get ready() {
      return state.ready
    },
    subscribe: subscribe,
    snapshot: snapshot,
    refresh: refresh,
    find: find,
    url: url,
    add: add,
    addFiles: addFiles,
    remove: remove,
  }
})()

/** Reload the user library (safe to call repeatedly). */
function mcUserRefresh() {
  return mcUserWallpapers.refresh()
}

/** Find one uploaded wallpaper record by id. */
function mcUserFind(id) {
  return mcUserWallpapers.find(id)
}

/** Object URL for an uploaded wallpaper (thumb=true gives the 480px version). */
function mcUserUrl(id, thumb) {
  return mcUserWallpapers.url(id, thumb)
}

/** Import one File; resolves with the new id. */
function mcUserAdd(file) {
  return mcUserWallpapers.add(file)
}

/** Import a FileList; resolves with the new ids. */
function mcUserAddFiles(fileList) {
  return mcUserWallpapers.addFiles(fileList)
}

/** Delete one uploaded wallpaper; resolves when the library mirror is updated. */
function mcUserRemove(id) {
  return mcUserWallpapers.remove(id)
}

/* ============================================================
 * 用户音乐库 —— 与壁纸库并列，共用 dsh-minecraft-ui 数据库（版本 2 的 music 仓库）
 *
 * 为什么单独一个对象仓库：
 *   - 音乐动辄几 MB，不能塞 localStorage；IndexedDB 存 Blob 最省事，
 *     刷新/重启后还在，也不需要宿主进程参与；
 *   - 浏览器里没有通用音频编码器，所以不重新编码，原样存上传的字节，
 *     音频引擎自己拿 blob.arrayBuffer() 去 decodeAudioData；
 *   - 和壁纸同库不同仓库，升级回调用 contains 守卫，互不影响。
 *
 * 对外：mcUserMusic（可订阅状态）+ 下面一组 mcUserMusic* 顶层函数。
 * ============================================================ */

/** 用户音乐库：内存镜像 + 订阅，和壁纸库同一套用法。 */
const mcUserMusic = (function userMusicLibrary() {
  const state = { items: [], ready: false, error: '' }
  const listeners = new Set()

  function emit() {
    listeners.forEach(function notify(listener) {
      try {
        listener(state)
      } catch (error) {
        console.warn('[minecraft-ui] user music listener failed', error)
      }
    })
  }

  function snapshot() {
    return { items: state.items.slice(), ready: state.ready, error: state.error }
  }

  /** Reload the in-memory mirror from IndexedDB. */
  async function refresh() {
    let records = []
    try {
      const database = await mcUserDb()
      records = await new Promise(function executor(resolve, reject) {
        const tx = database.transaction(MC_USER_MUSIC_STORE, 'readonly')
        const req = tx.objectStore(MC_USER_MUSIC_STORE).getAll()
        req.onsuccess = function onSuccess() {
          resolve(req.result || [])
        }
        req.onerror = function onError() {
          reject(req.error || new Error('indexeddb read failed'))
        }
      })
    } catch (error) {
      state.error = String((error && error.message) || error)
      state.ready = true
      console.warn('[minecraft-ui] user music library unavailable:', error)
      emit()
      return snapshot()
    }
    records.sort(function newestFirst(a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0)
    })
    state.items = records.map(function shape(record) {
      return {
        id: record.id,
        name: record.name || '我的音乐',
        desc: record.desc || '我上传的音乐',
        createdAt: record.createdAt || 0,
        bytes: record.bytes || (record.blob && record.blob.size) || 0,
        mime: record.mime || (record.blob && record.blob.type) || '',
        blob: record.blob,
      }
    })
    state.ready = true
    state.error = ''
    emit()
    return snapshot()
  }

  function find(id) {
    return state.items.find(function match(entry) {
      return entry.id === id
    }) || null
  }

  function extensionOf(name) {
    const text = String(name || '')
    const dot = text.lastIndexOf('.')
    return dot >= 0 ? text.slice(dot + 1).toLowerCase() : ''
  }

  /** 音频判定：file.type 以 audio/ 开头，或扩展名在白名单里。 */
  function isAudio(file) {
    if (/^audio\//.test(String((file && file.type) || ''))) return true
    return MC_USER_MUSIC_EXTS.indexOf(extensionOf(file && file.name)) >= 0
  }

  /** 曲名：文件名去扩展名、去首尾空白、最长 48 字符；空则「我的音乐」。 */
  function musicName(file) {
    const text = String((file && file.name) || '').replace(/\.[a-z0-9]+$/i, '').trim()
    return text.length ? text.slice(0, 48) : '我的音乐'
  }

  function makeId() {
    return 'user-music-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)
  }

  /** Import one audio File; returns the new record id. */
  async function add(file) {
    if (!isAudio(file)) throw new Error('not audio')
    if ((file.size || 0) > MC_USER_MUSIC_MAX_BYTES) {
      console.warn('[minecraft-ui] music import skipped (too large):', file.name, file.size)
      throw new Error('audio too large')
    }
    const ext = extensionOf(file.name)
    const mime = String(file.type || '') || MC_USER_MUSIC_MIME[ext] || 'audio/mpeg'
    /* 只包一层 Blob 把 type 兜底，字节原样保留，不重新编码。 */
    const blob = new Blob([file], { type: mime })
    const record = {
      id: makeId(),
      name: musicName(file),
      desc: '我上传的音乐',
      createdAt: Date.now(),
      bytes: blob.size,
      mime: mime,
      blob: blob,
    }
    const database = await mcUserDb()
    await new Promise(function executor(resolve, reject) {
      const tx = database.transaction(MC_USER_MUSIC_STORE, 'readwrite')
      tx.objectStore(MC_USER_MUSIC_STORE).put(record)
      tx.oncomplete = function onComplete() {
        resolve()
      }
      tx.onerror = function onError() {
        reject(tx.error || new Error('indexeddb write failed'))
      }
    })
    await refresh()
    return record.id
  }

  /** Import several Files (picked at once); one bad file must not abort the batch. */
  async function addFiles(fileList) {
    const ids = []
    const list = fileList ? Array.prototype.slice.call(fileList) : []
    for (let i = 0; i < list.length; i += 1) {
      try {
        ids.push(await add(list[i]))
      } catch (error) {
        console.warn('[minecraft-ui] music import skipped:', error)
      }
    }
    return ids
  }

  /** Delete one record; 音乐库不用 object URL，也不额外缓存，只刷新内存镜像。 */
  async function remove(id) {
    const database = await mcUserDb()
    await new Promise(function executor(resolve, reject) {
      const tx = database.transaction(MC_USER_MUSIC_STORE, 'readwrite')
      tx.objectStore(MC_USER_MUSIC_STORE).delete(id)
      tx.oncomplete = function onComplete() {
        resolve()
      }
      tx.onerror = function onError() {
        reject(tx.error || new Error('indexeddb delete failed'))
      }
    })
    await refresh()
  }

  function subscribe(listener) {
    listeners.add(listener)
    return function unsubscribe() {
      listeners.delete(listener)
    }
  }

  return {
    get items() {
      return state.items
    },
    get ready() {
      return state.ready
    },
    subscribe: subscribe,
    snapshot: snapshot,
    refresh: refresh,
    find: find,
    add: add,
    addFiles: addFiles,
    remove: remove,
  }
})()

/** Reload the user music library (safe to call repeatedly). */
function mcUserMusicRefresh() {
  return mcUserMusic.refresh()
}

/** Find one uploaded music record by id (null when missing). */
function mcUserMusicFind(id) {
  return mcUserMusic.find(id)
}

/** Raw audio bytes (Blob) for the audio engine to decode; null when missing. */
function mcUserMusicBlob(id) {
  const item = mcUserMusic.find(id)
  return item && item.blob ? item.blob : null
}

/** Display name of one uploaded track; '' when the id is unknown. */
function mcUserMusicName(id) {
  const item = mcUserMusic.find(id)
  return item ? item.name : ''
}

/** Import one audio File; resolves with the new id (rejects with 'not audio'). */
function mcUserMusicAdd(file) {
  return mcUserMusic.add(file)
}

/** Import an audio FileList; resolves with the new ids (bad files are skipped). */
function mcUserMusicAddFiles(fileList) {
  return mcUserMusic.addFiles(fileList)
}

/** Delete one uploaded track; resolves when the mirror is updated. */
function mcUserMusicRemove(id) {
  return mcUserMusic.remove(id)
}
