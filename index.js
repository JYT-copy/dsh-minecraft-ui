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
 * Personal media lives outside the package, in `MC_UI_ASSETS_DIR` (default
 * `~/.dsh/minecraft-ui/assets`), with `wallpapers/`, `sfx/` and `music/`
 * subdirectories shaped exactly like the bundled ones. Both sets are merged for
 * the listings and a personal file wins on a name collision, so upgrading the
 * package — which replaces the package directory — never removes the user's own
 * artwork or soundtrack.
 *
 * All routes are read-only and fail-closed: only file names accepted by their
 * own pattern inside the bundled and personal asset directories are reachable,
 * and every other path answers 404.
 * @module dsh-minecraft-ui
 */

import { readFile, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
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

/**
 * Personal asset directory, where the user's own wallpapers / sounds / music
 * live. The npm package cannot ship third-party artwork or the Minecraft
 * soundtrack, so anything the user brings themselves goes here instead of into
 * the package: an upgrade replaces the package directory wholesale, and only
 * this directory survives one.
 *
 * `MC_UI_ASSETS_DIR` overrides it; the default sits next to the rest of the
 * harness state so it is obvious where personal media belongs.
 */
const USER_ASSET_ROOT = process.env.MC_UI_ASSETS_DIR || join(homedir(), '.dsh', 'minecraft-ui', 'assets')

/** Personal directories, by asset kind. Missing directories are simply empty. */
const USER_ASSET_DIRS = {
  wallpapers: join(USER_ASSET_ROOT, 'wallpapers'),
  sfx: join(USER_ASSET_ROOT, 'sfx'),
  music: join(USER_ASSET_ROOT, 'music'),
}

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
async function readManifest(directory, name) {
  try {
    const text = await readFile(join(directory, name), 'utf8')
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * File names in one directory that satisfy a predicate. A missing directory is
 * reported as empty rather than as an error: personal asset directories are
 * opt-in, and most installs never create them.
 * @param {string} directory
 * @param {(name: string) => boolean} accept
 * @returns {Promise<string[]>}
 */
async function listNames(directory, accept) {
  try {
    const names = await readdir(directory)
    return names.filter(accept)
  } catch {
    return []
  }
}

/**
 * Resolve a file in the personal directory first and the bundled one second, so
 * a same-named personal file overrides the shipped asset.
 * @param {string[]} directories - in priority order.
 * @param {string} name
 * @returns {Promise<string | null>} absolute path, or null when no copy exists.
 */
async function findFile(directories, name) {
  for (const directory of directories) {
    const file = join(directory, name)
    try {
      const info = await stat(file)
      if (info.isFile()) return file
    } catch {
      /* try the next directory */
    }
  }
  return null
}

/**
 * Wallpaper listing: `{ ok, photos: [{ slug, name, desc }] }`.
 *
 * The catalogue is the directory itself, not a compiled-in list, so dropping
 * `<slug>.webp` (plus an optional `<slug>.thumb.webp`) into either the bundled
 * folder or the personal one is enough to add a wallpaper. Personal entries win
 * on a slug collision. Names come from the manifests; entries without metadata
 * fall back to a humanized slug. Manifest order wins, the rest is alphabetical,
 * so the bundled wallpaper stays first.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
async function serveWallpaperList(req, res) {
  if (!allowRead(req, res)) return
  const meta = new Map()
  for (const directory of [ASSET_DIR, USER_ASSET_DIRS.wallpapers]) {
    for (const file of WALLPAPER_MANIFESTS) {
      const parsed = await readManifest(directory, file)
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
  }
  try {
    const present = new Set()
    for (const directory of [ASSET_DIR, USER_ASSET_DIRS.wallpapers]) {
      const names = await listNames(directory, (file) => ASSET_NAME.test(file) && !file.endsWith('.thumb.webp'))
      for (const file of names) present.add(file.replace(/\.webp$/, ''))
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
 * @param {string[]} directories - absolute directories in priority order.
 * @param {RegExp} namePattern - the only file names allowed.
 * @param {string} contentType - response content type of the bytes.
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>} node handler.
 */
function createAssetHandler(prefix, directories, namePattern, contentType) {
  return async function serveAsset(req, res) {
    if (!allowRead(req, res)) return
    const name = remainderOf(req, prefix)
    if (!name || !namePattern.test(name) || name.includes('/') || name.includes('\\') || name.includes('..')) {
      notFound(res)
      return
    }
    const file = await findFile(directories, name)
    if (!file) {
      notFound(res)
      return
    }
    try {
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
  const file = await findFile([USER_ASSET_DIRS.wallpapers, ASSET_DIR], name)
  if (!file) {
    notFound(res)
    return
  }
  try {
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
    const found = new Map()
    for (const directory of [USER_ASSET_DIRS.music, MUSIC_DIR]) {
      const names = await listNames(directory, isMusicFile)
      for (const file of names) {
        /* Personal tracks come first in the loop, so they keep their size and
           the bundled copy of the same name is only a fallback. */
        if (found.has(file)) continue
        try {
          const info = await stat(join(directory, file))
          if (!info.isFile()) continue
          found.set(file, info.size)
        } catch {
          continue
        }
      }
    }
    const tracks = Array.from(found, ([file, size]) => ({ file, name: musicTitle(file), size }))
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
  const file = await findFile([USER_ASSET_DIRS.music, MUSIC_DIR], name)
  if (!file) {
    notFound(res)
    return
  }
  try {
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
    console.info('[dsh-minecraft-theme] personal assets directory:', USER_ASSET_ROOT)
    const disposers = [
      ctx.webServer.register({
        kind: 'prefix',
        path: ASSET_PREFIX,
        handler: serveWallpaper,
      }),
      ctx.webServer.register({
        kind: 'prefix',
        path: SOUND_PREFIX,
        handler: createAssetHandler(SOUND_PREFIX, [USER_ASSET_DIRS.sfx, SOUND_DIR], SOUND_NAME, 'audio/mpeg'),
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
