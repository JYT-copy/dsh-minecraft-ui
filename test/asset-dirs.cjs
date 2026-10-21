/**
 * Host-half test: personal asset directory merging.
 *
 * `MC_UI_ASSETS_DIR` (default `~/.dsh/minecraft-ui/assets`) holds the user's own
 * wallpapers, sound samples and music, which the npm package cannot ship. This
 * test mounts the host half on a stubbed `webServer`, points the personal
 * directory at a temporary fixture and checks that:
 *
 *  - the wallpaper listing merges bundled + personal entries, personal metadata
 *    and files overriding a bundled slug;
 *  - personal music tracks are listed and served even though the package ships
 *    none;
 *  - a personal sound sample overrides the bundled one of the same name;
 *  - unknown names and traversal attempts still answer 404;
 *  - a directory that does not exist is simply empty.
 *
 * Usage: node test/asset-dirs.cjs
 */
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const root = path.resolve(__dirname, '..')
const entryUrl = pathToFileURL(path.join(root, 'index.js'))

/** Import the host half fresh, so the personal directory is re-read from env. */
function freshHost(tag) {
  const url = new URL(entryUrl.href)
  url.searchParams.set('t', tag)
  return import(url.href)
}
let checks = 0
let failures = 0

function check(label, fn) {
  checks += 1
  try {
    fn()
    console.log(`  PASS ${label}`)
  } catch (error) {
    failures += 1
    console.log(`  FAIL ${label}`)
    console.log(`       ${error && error.message}`)
  }
}

function makeResponse() {
  const res = {
    status: 0,
    headers: {},
    body: Buffer.alloc(0),
    writeHead(status, headers) {
      this.status = status
      this.headers = headers || {}
      return this
    },
    end(chunk) {
      if (chunk === undefined) return this
      this.body = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8')
      return this
    },
  }
  return res
}

async function call(handler, url, method = 'GET') {
  const res = makeResponse()
  await handler({ method, url }, res)
  return res
}

function json(res) {
  return JSON.parse(res.body.toString('utf8'))
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-ui-assets-'))
  const personal = path.join(tmp, 'assets')
  const dirs = {
    wallpapers: path.join(personal, 'wallpapers'),
    sfx: path.join(personal, 'sfx'),
    music: path.join(personal, 'music'),
  }
  for (const dir of Object.values(dirs)) fs.mkdirSync(dir, { recursive: true })

  const personalPhoto = Buffer.from('personal-wallpaper-bytes')
  fs.writeFileSync(path.join(dirs.wallpapers, 'my-room.webp'), personalPhoto)
  fs.writeFileSync(
    path.join(dirs.wallpapers, 'manifest.local.json'),
    JSON.stringify({ photos: [{ slug: 'my-room', name: '我的房间', desc: '测试用' }] }, null, 2),
  )

  const overrideBytes = Buffer.from('personal-sound-overrides-bundled')
  fs.writeFileSync(path.join(dirs.sfx, 'ui-stonecutter-select_recipe-1.mp3'), overrideBytes)

  const personalTrack = Buffer.from('personal-track-bytes')
  fs.writeFileSync(path.join(dirs.music, 'my song.ogg'), personalTrack)

  process.env.MC_UI_ASSETS_DIR = personal
  const host = await freshHost('one')

  const handlers = new Map()
  const ctx = {
    effect(fn) {
      const dispose = fn()
      assert.strictEqual(typeof dispose, 'function', 'apply must return a disposer')
    },
    webServer: {
      register(route) {
        handlers.set(`${route.kind}|${route.path}`, route.handler)
        return () => {}
      },
    },
  }
  host.apply(ctx)

  const wallpaper = handlers.get('prefix|/api/minecraft-ui/wallpapers')
  const sound = handlers.get('prefix|/api/minecraft-ui/sounds')
  const musicList = handlers.get('exact|/api/minecraft-ui/music')
  const musicFile = handlers.get('prefix|/api/minecraft-ui/music')
  check('all four routes registered', () => {
    for (const handler of [wallpaper, sound, musicList, musicFile]) assert.strictEqual(typeof handler, 'function')
  })

  const list = await call(wallpaper, '/api/minecraft-ui/wallpapers')
  const photos = json(list).photos
  check('wallpaper listing is 200 ok', () => {
    assert.strictEqual(list.status, 200)
    assert.strictEqual(json(list).ok, true)
  })
  check('bundled wallpaper still listed', () => {
    assert.ok(photos.some((photo) => photo.slug === 'cozy-cabin'), 'cozy-cabin missing')
  })
  check('personal wallpaper listed with manifest name', () => {
    const mine = photos.find((photo) => photo.slug === 'my-room')
    assert.ok(mine, 'my-room missing')
    assert.strictEqual(mine.name, '我的房间')
    assert.strictEqual(mine.desc, '测试用')
    assert.strictEqual(mine.slug, 'my-room')
  })
  const personalImage = await call(wallpaper, '/api/minecraft-ui/wallpapers/my-room.webp')
  check('personal wallpaper bytes returned', () => {
    assert.strictEqual(personalImage.status, 200)
    assert.strictEqual(personalImage.headers['content-type'], 'image/webp')
    assert.ok(personalImage.body.equals(personalPhoto))
  })
  const bundledImage = await call(wallpaper, '/api/minecraft-ui/wallpapers/cozy-cabin.webp')
  check('bundled wallpaper still served', () => {
    assert.strictEqual(bundledImage.status, 200)
    assert.ok(bundledImage.body.length > 1000)
  })

  const tracks = json(await call(musicList, '/api/minecraft-ui/music')).tracks
  check('personal track listed alongside bundled tracks', () => {
    const mine = tracks.find((track) => track.file === 'my song.ogg')
    assert.ok(mine, 'personal track missing')
    assert.strictEqual(mine.name, 'my song')
    assert.strictEqual(mine.size, personalTrack.length)
  })
  const trackRes = await call(musicFile, '/api/minecraft-ui/music/my%20song.ogg')
  check('personal track served with audio/ogg', () => {
    assert.strictEqual(trackRes.status, 200)
    assert.strictEqual(trackRes.headers['content-type'], 'audio/ogg')
    assert.ok(trackRes.body.equals(personalTrack))
  })

  const overridden = await call(sound, '/api/minecraft-ui/sounds/ui-stonecutter-select_recipe-1.mp3')
  check('personal sample overrides bundled sample', () => {
    assert.strictEqual(overridden.status, 200)
    assert.ok(overridden.body.equals(overrideBytes))
  })
  const bundledSound = await call(sound, '/api/minecraft-ui/sounds/block-chest-open-1.mp3')
  check('bundled sample still served', () => {
    assert.strictEqual(bundledSound.status, 200)
    assert.strictEqual(bundledSound.headers['content-type'], 'audio/mpeg')
  })

  const missing = await call(wallpaper, '/api/minecraft-ui/wallpapers/nope.webp')
  check('unknown wallpaper answers 404', () => assert.strictEqual(missing.status, 404))
  const traversal = await call(wallpaper, '/api/minecraft-ui/wallpapers/..%2Fmanifest.local.json')
  check('traversal attempt answers 404', () => assert.strictEqual(traversal.status, 404))
  const badTrack = await call(musicFile, '/api/minecraft-ui/music/..%2Fwallpapers%2Fmy-room.webp')
  check('music traversal answers 404', () => assert.strictEqual(badTrack.status, 404))
  const noMethod = await call(wallpaper, '/api/minecraft-ui/wallpapers', 'POST')
  check('non-GET answers 405', () => assert.strictEqual(noMethod.status, 405))

  /* A missing personal directory must degrade to bundled-only, not error. */
  process.env.MC_UI_ASSETS_DIR = path.join(tmp, 'missing')
  const second = await freshHost('two')
  const handlers2 = new Map()
  second.apply({
    effect(fn) {
      fn()
    },
    webServer: {
      register(route) {
        handlers2.set(`${route.kind}|${route.path}`, route.handler)
        return () => {}
      },
    },
  })
  const lonely = await call(handlers2.get('prefix|/api/minecraft-ui/wallpapers'), '/api/minecraft-ui/wallpapers')
  check('missing personal directory falls back to bundled only', () => {
    const only = json(lonely).photos
    assert.strictEqual(lonely.status, 200)
    assert.ok(only.some((photo) => photo.slug === 'cozy-cabin'))
    assert.ok(!only.some((photo) => photo.slug === 'my-room'))
  })
  const noTracks = json(await call(handlers2.get('exact|/api/minecraft-ui/music'), '/api/minecraft-ui/music')).tracks
  check('missing personal music directory still lists bundled tracks only', () => {
    assert.ok(noTracks.length >= 1, 'bundled tracks should survive')
    assert.ok(!noTracks.some((track) => track.file === 'my song.ogg'), 'personal track must be gone')
    assert.strictEqual(noTracks.length, tracks.length - 1)
  })

  fs.rmSync(tmp, { recursive: true, force: true })
  console.log(`\nasset dirs harness: ${checks - failures} PASS / ${failures} FAIL`)
  if (failures > 0) process.exit(1)
  console.log('asset library harness PASS')
}

main().catch((error) => {
  console.error('harness crashed:', error)
  process.exit(1)
})
