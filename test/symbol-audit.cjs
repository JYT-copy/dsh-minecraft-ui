/* Crude symbol audit: every identifier the bundle references must be declared. */
const fs = require('node:fs')
const path = require('node:path')
const file = path.join(__dirname, '..', 'lib', 'client.js')
const src = fs.readFileSync(file, 'utf8')

const names = [
  'mcUserWallpapers', 'mcUserRefresh', 'mcUserFind', 'mcUserUrl', 'mcUserAdd',
  'mcUserAddFiles', 'mcUserRemove', 'useMcUserWallpapers',
  'mcImportUserWallpapers', 'mcRemoveUserWallpaper',
  'mcPhotoUrl', 'mcPhotoFind', 'mcScenes', 'mcSceneName', 'mcWallSelect',
  'mcWallShow', 'mcWallStyle', 'mcWallMountLayer', 'mcWallApplyHtml',
  'mcAchievement', 'mcToasts', 'mcSound', 'mcSyncAudio', 'MC_AUDIO',
  'mcApplyPalette', 'mcStripPalette', 'mcTokens', 'mcRuntimeStart',
  'mcRuntimeStop', 'mcRuntimeSync', 'mcSettings', 'mcT',
]

let bad = 0
for (const name of names) {
  const decl = new RegExp(`(?:function|const|let|var)\\s+${name}\\b`)
  const assigned = new RegExp(`(?:^|\\n)\\s*${name}\\s*=`)
  const ok = decl.test(src) || assigned.test(src)
  const uses = (src.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length
  if (!ok) { bad += 1; console.log(`MISSING DECL ${name} (uses ${uses})`) }
  else if (uses < 2) console.log(`DECLARED BUT UNUSED ${name}`)
}
console.log(bad === 0 ? 'symbol audit OK' : `symbol audit FAILED (${bad})`)
process.exit(bad === 0 ? 0 : 1)
