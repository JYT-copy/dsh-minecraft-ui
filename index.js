/**
 * dsh-minecraft-ui host half.
 *
 * The visuals, sounds and component restyling all happen in the browser
 * (`./client`). The host row exists for two jobs:
 *
 *  1. let the modules node half resolve the package and serve `lib/client.js`;
 *  2. serve the bundled static assets — the wallpaper images, the UI
 *     sound-effect samples and the background-music tracks — so the browser
 *     half can keep a small JS bundle instead of inlining megabytes of base64
 *     binary data.
 *
 * Every media directory is optional: the open-source release ships one
 * wallpaper and no audio at all, and the browser half degrades to synthesized
 * UI sounds / no BGM when the listing comes back empty.
 *
 * All routes are read-only and fail-closed: only file names accepted by their
 * own pattern inside this package's own asset directories are reachable, and
 * every other path answers 404.
 * @module dsh-minecraft-ui
 */

import { readFile, readdir, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Cordis plugin name (the roster row uses the package name instead). */
export const name = 'minecraft-ui'

/** Required host services: the browser HTTP carrier, for the asset routes. */
export const inject = ['webServer']

/** URL of the wallpaper listing (client fetches this to build its library). */
const ASSET_PREFIX = '/api/minecraft-ui/wallpapers'

/** URL prefix of the sound-effect asset route (client constant MC_SAMPLE_BASE). */
const SOUND_PREFIX = '/api/minecraft-ui/sounds'

/** URL of the background-music track listing (client constant MC_MUSIC_BASE). */
const MUSIC_LIST = '/api/minecraft-ui/music'

/** URL prefix of the background-music file route. The prefix is registered
 *  without a trailing slash: the web server matches registered prefixes
 *  literally, so `/api/minecraft-ui/music/` would never match a file path. */
const MUSIC_PREFIX = '/api/minecraft-ui/music'

/** Absolute path of the bundled wallpaper directory (resolved at load time). */
const ASSET_DIR = fileURLToPath(new URL('./assets/wallpapers/', import.meta.url))

/** Absolute path of the bundled sound-effect directory. */
const SOUND_DIR = fileURLToPath(new URL('./assets/sfx/', import.meta.url))

/** Absolute path of the bundled background-music directory. */
const MUSIC_DIR = fileURLToPath(new URL('./assets/music/', import.meta.url))

/** Only lowercase slug names with an optional thumbnail suffix are servable. */
const ASSET_NAME = /^[a-z0-9][a-z0-9-]*(\.thumb)?\.webp$/

/** Only lowercase ASCII sample names ending in .mp3 are servable. */
const SOUND_NAME = /^[a-z0-9][a-z0-9._-]*\.mp3$/

/** Wallpaper metadata files, in increasing priority: the shipped manifest
 *  describes the bundled wallpaper, the local one carries the file's own
 *  library (kept out of the open-source repository). */
const WALLPAPER_MANIFESTS = ['manifest.json', 'manifest.local.json']

/** Container formats the browser can decode from an <audio> element. */
const MUSIC_TYPES = {
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
}

/**
 * A background-music file name is anything without a path separator or a
 * parent-directory segment and with a known audio extension. The names come
 * from the user's own music folder, so spaces, brackets and Chinese text are
 * allowed; traversal is not.
 * @param {string} name
 * @returns {boolean}
 */
function isMusicFile(name) {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name.length < 256 &&
    !name.includes('/') &&
    !name.includes('\\') &&
    !name.includes('..') &&
    Object.prototype.hasOwnProperty.call(MUSIC_TYPES, extname(name).toLowerCase())
  )
}

/**
 * Human-facing track name: drop the extension and a trailing `[source]` tag
 * (the files come from a music app and carry e.g. `[mqms2]`).
 * @param {string} file
 * @returns {string}
 */
function musicTitle(file) {
  const base = file.replace(/\.[a-z0-9]+$/i, '')
  const trimmed = base.replace(/\s*\[[^\]]*\]\s*$/, '').trim()
  return trimmed || base || file
}

/**
 * Turn a wallpaper slug into something readable when no manifest entry exists.
 * @param {string} slug - e.g. `cozy-cabin`.
 * @returns {string}
 */
function humanizeSlug(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map(function capitalize(part) {
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(' ')
}

/** Answer a JSON 404. */
function notFound(res) {
  res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
  res.end('{"ok":false,"error":"not-found"}')
}

/** Answer a JSON 405. */
function methodNotAllowed(res) {
  res.writeHead(405, { 'content-type': 'application/json; charset=utf-8', allow: 'GET, HEAD' })
  res.end('{"ok":false,"error":"method-not-allowed"}')
}

/** Answer a JSON body with the given status (no-store: listings change with the folder). */
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(Buffer.byteLength(body, 'utf8')),
    'cache-control': 'no-store',
  })
  res.end(body)
}

/** GET/HEAD only; answers 405 itself and returns false for other methods. */
function allowRead(req, res) {
  const method = String(req.method || 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD') return true
  methodNotAllowed(res)
  return false
}

/** Path remainder below a registered prefix, percent-decoded and unescaped. */
function remainderOf(req, prefix) {
  let pathname = '/'
  try {
    pathname = new URL(String(req.url || '/'), 'http://localhost').pathname
  } catch {
    pathname = '/'
  }
  let rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : ''
  try {
    rest = decodeURIComponent(rest)
  } catch {
    rest = ''
  }
  return rest.replace(/^\/+/, '')
}

/** Read one JSON metadata file; returns an empty object when absent or invalid. */
async function readManifest(name) {
  try {
    const text = await readFile(join(ASSET_DIR, name), 'utf8')
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Wallpaper listing: `{ ok, photos: [{ slug, name, desc }] }`.
 *
 * The catalogue is the directory itself, not a compiled-in list, so dropping
 * `<slug>.webp` (plus an optional `<slug>.thumb.webp`) into the folder is
 * enough to add a wallpaper. Names come from the manifests; entries without
 * metadata fall back to a humanized slug. Manifest order wins, the rest is
 * alphabetical, so the bundled wallpaper stays first.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
async function serveWallpaperList(req, res) {
  if (!allowRead(req, res)) return
  const meta = new Map()
  for (const file of WALLPAPER_MANIFESTS) {
    const parsed = await readManifest(file)
    const entries = Array.isArray(parsed.photos) ? parsed.photos : []
    for (const entry of entries) {
      if (!entry || typeof entry.slug !== 'string') continue
      const slug = entry.slug.trim().toLowerCase()
      if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) continue
      meta.set(slug, {
        slug,
        name: typeof entry.name === 'string' && entry.name ? entry.name : humanizeSlug(slug),
        desc: typeof entry.desc === 'string' ? entry.desc : '',
      })
    }
  }
  try {
    const names = await readdir(ASSET_DIR)
    const present = new Set()
    for (const file of names) {
      if (!ASSET_NAME.test(file) || file.endsWith('.thumb.webp')) continue
      present.add(file.replace(/\.webp$/, ''))
    }
    const photos = []
    for (const [slug, entry] of meta) {
      if (present.has(slug)) photos.push(entry)
    }
    const extras = Array.from(present)
      .filter(function unbranded(slug) {
        return !meta.has(slug)
      })
      .sort()
    for (const slug of extras) {
      photos.push({ slug, name: humanizeSlug(slug), desc: '' })
    }
    sendJson(res, 200, { ok: true, photos })
  } catch {
    sendJson(res, 200, { ok: false, photos: [] })
  }
}

/**
 * Build one read-only static file handler.
 * @param {string} prefix - URL prefix this handler answers for.
 * @param {string} directory - absolute directory the files are read from.
 * @param {RegExp} namePattern - the only file names allowed.
 * @param {string} contentType - response content type of the bytes.
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>} node handler.
 */
function createAssetHandler(prefix, directory, namePattern, contentType) {
  return async function serveAsset(req, res) {
    if (!allowRead(req, res)) return
    const name = remainderOf(req, prefix)
    if (!name || !namePattern.test(name) || name.includes('/') || name.includes('\\') || name.includes('..')) {
      notFound(res)
      return
    }
    const file = join(directory, name)
    try {
      const info = await stat(file)
      if (!info.isFile()) throw new Error('not a file')
      const bytes = await readFile(file)
      res.writeHead(200, {
        'content-type': contentType,
        'content-length': String(bytes.byteLength),
        'cache-control': 'public, max-age=86400',
      })
      if (String(req.method || 'GET').toUpperCase() === 'HEAD') res.end()
      else res.end(bytes)
    } catch {
      notFound(res)
    }
  }
}

/**
 * Serve one wallpaper file. A bare `/wallpapers` (no trailing slash) is the
 * listing, because the same prefix carries both.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
async function serveWallpaper(req, res) {
  if (!allowRead(req, res)) return
  const name = remainderOf(req, ASSET_PREFIX)
  if (!name) {
    await serveWallpaperList(req, res)
    return
  }
  if (!ASSET_NAME.test(name)) {
    notFound(res)
    return
  }
  const file = join(ASSET_DIR, name)
  try {
    const info = await stat(file)
    if (!info.isFile()) throw new Error('not a file')
    const bytes = await readFile(file)
    res.writeHead(200, {
      'content-type': 'image/webp',
      'content-length': String(bytes.byteLength),
      'cache-control': 'public, max-age=86400',
    })
    if (String(req.method || 'GET').toUpperCase() === 'HEAD') res.end()
    else res.end(bytes)
  } catch {
    notFound(res)
  }
}

/**
 * List the background-music folder as JSON: `{ ok, tracks: [{ file, name, size }] }`.
 * The listing is deliberately uncached so dropping another file into the folder
 * shows up on the next refresh.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
async function serveMusicList(req, res) {
  if (!allowRead(req, res)) return
  try {
    const names = await readdir(MUSIC_DIR)
    const tracks = []
    for (const file of names) {
      if (!isMusicFile(file)) continue
      let size = 0
      try {
        const info = await stat(join(MUSIC_DIR, file))
        if (!info.isFile()) continue
        size = info.size
      } catch {
        continue
      }
      tracks.push({ file, name: musicTitle(file), size })
    }
    tracks.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    sendJson(res, 200, { ok: true, tracks })
  } catch {
    sendJson(res, 200, { ok: false, tracks: [] })
  }
}

/**
 * Serve one background-music file. The content type follows the extension.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
async function serveMusicFile(req, res) {
  if (!allowRead(req, res)) return
  const name = remainderOf(req, MUSIC_PREFIX)
  if (!name) {
    /* Bare `/music` (no trailing slash) is the listing. */
    await serveMusicList(req, res)
    return
  }
  if (!isMusicFile(name)) {
    notFound(res)
    return
  }
  const file = join(MUSIC_DIR, name)
  try {
    const info = await stat(file)
    if (!info.isFile()) throw new Error('not a file')
    const bytes = await readFile(file)
    res.writeHead(200, {
      'content-type': MUSIC_TYPES[extname(name).toLowerCase()],
      'content-length': String(bytes.byteLength),
      'cache-control': 'public, max-age=86400',
    })
    if (String(req.method || 'GET').toUpperCase() === 'HEAD') res.end()
    else res.end(bytes)
  } catch {
    notFound(res)
  }
}

/**
 * Mount the plugin: register the static asset routes.
 * @param {import('cordis').Context} ctx - host root context.
 */
export function apply(ctx) {
  ctx.effect(() => {
    const disposers = [
      ctx.webServer.register({
        kind: 'prefix',
        path: ASSET_PREFIX,
        handler: serveWallpaper,
      }),
      ctx.webServer.register({
        kind: 'prefix',
        path: SOUND_PREFIX,
        handler: createAssetHandler(SOUND_PREFIX, SOUND_DIR, SOUND_NAME, 'audio/mpeg'),
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: MUSIC_LIST,
        handler: serveMusicList,
      }),
      ctx.webServer.register({
        kind: 'prefix',
        path: MUSIC_PREFIX,
        handler: serveMusicFile,
      }),
    ]
    return () => {
      for (const dispose of disposers) {
        try {
          dispose()
        } catch (error) {
          console.warn('[dsh-minecraft-ui] route cleanup failed', error)
        }
      }
    }
  }, 'dsh-minecraft-ui: static assets')
}
