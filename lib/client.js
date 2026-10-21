/* dsh-minecraft-ui — generated bundle, do not edit. Source: src/ + build.mjs */

/* ---- src/00-head.js ---- */
/* dsh-minecraft-ui — client bundle.
 * Hand-written single-file browser bundle, assembled from src/*.js by
 * build.mjs. Runs inside the dsh web GUI module loader.
 */
window.__ModuleLoader__.load({
  id: 'dsh-minecraft-ui',
  factory: (require) => {
    'use strict'

    const React = require('react')
    const h = React.createElement

    /** Plugin namespace: locale namespace, storage key prefix, DOM ids. */
    const MC_NS = 'minecraft-ui'
    /** localStorage key holding the persisted options. */
    const MC_STORAGE_KEY = 'dsh.minecraft-ui.v1'
    /** Marks <body> while the theme is applied (all component CSS is scoped by it). */
    const MC_BODY_ATTR = 'data-mc-theme'
    /** Marks the elements this plugin renders itself (excluded from component restyling). */
    const MC_UI_ATTR = 'data-mc-ui'

/* ---- src/10-store.js ---- */

    /* ------------------------------------------------------------------ *
     * 1. Options store, translations, palette
     * ------------------------------------------------------------------ */

    /** Bumped when a default would otherwise be shadowed by a stored record. */
    const MC_SETTINGS_VERSION = 7

    /** Factory defaults; every field is user-adjustable from the settings page. */
    const MC_DEFAULTS = {
      __v: MC_SETTINGS_VERSION,
      enabled: true,
      wallpaper: {
        auto: true,
        intervalSec: 300,
        sceneId: 'photo-cozy-cabin',
        dim: 0,
        gain: 1.18,
        blur: 0,
        particles: false,
      },
      sfx: { enabled: true, volume: 0.55 },
      bgm: { enabled: false, volume: 0.22, trackId: '' },
      ui: { glass: 0.5, achievements: true, hudHidden: false, hudDrop: 28 },
    }

    /** Shallow-by-section deep merge (two levels is all this options tree needs). */
    function mcMerge(base, patch) {
      const out = Array.isArray(base) ? base.slice() : Object.assign({}, base)
      if (!patch || typeof patch !== 'object') return out
      for (const key of Object.keys(patch)) {
        const value = patch[key]
        const prev = out[key]
        if (value && typeof value === 'object' && !Array.isArray(value) && prev && typeof prev === 'object' && !Array.isArray(prev)) {
          out[key] = mcMerge(prev, value)
        } else if (value !== undefined) {
          out[key] = value
        }
      }
      return out
    }

    /** Clamp helper used by every numeric option. */
    function mcClamp(value, min, max) {
      const n = typeof value === 'number' && isFinite(value) ? value : min
      return Math.min(max, Math.max(min, n))
    }

    /**
     * Force every numeric option into its valid range. Applied to loaded records
     * (so a hand-edited or stale localStorage entry cannot break the GUI) and to
     * every write (so no caller can push an out-of-range value into the runtime).
     * @param {any} state
     * @returns {any} the same object, normalised in place.
     */
    function mcNormalize(state) {
      state.sfx = state.sfx || {}
      state.bgm = state.bgm || {}
      state.wallpaper = state.wallpaper || {}
      state.ui = state.ui || {}
      state.sfx.volume = mcClamp(state.sfx.volume, 0, 1)
      state.bgm.volume = mcClamp(state.bgm.volume, 0, 1)
      if (typeof state.bgm.trackId !== 'string') state.bgm.trackId = ''
      state.wallpaper.dim = mcClamp(state.wallpaper.dim, 0, 0.35)
      state.wallpaper.gain = mcClamp(state.wallpaper.gain, 0.7, 1.6)
      state.wallpaper.blur = mcClamp(state.wallpaper.blur, 0, 12)
      state.ui.glass = mcClamp(state.ui.glass, 0, 1)
      state.ui.hudHidden = state.ui.hudHidden === true
      state.ui.hudDrop = mcClamp(state.ui.hudDrop, 0, 240)
      state.wallpaper.intervalSec = mcClamp(state.wallpaper.intervalSec, 20, 3600)
      /* Round 6 deleted the procedural pixel scenes: a stored scene id from
         that group (or any other retired id) would resolve to no URL and show
         only a fallback gradient. Keep photo ids and imported user ids only. */
      const scene = state.wallpaper.sceneId
      if (typeof scene !== 'string' || (scene.indexOf('photo-') !== 0 && scene.indexOf('user-') !== 0)) {
        state.wallpaper.sceneId = MC_DEFAULTS.wallpaper.sceneId
      }
      return state
    }

    /** Read persisted options; a corrupt or absent record falls back to defaults. */
    function mcLoadSettings() {
      let stored = null
      try {
        const raw = window.localStorage.getItem(MC_STORAGE_KEY)
        if (raw) stored = JSON.parse(raw)
      } catch (_error) {
        stored = null
      }
      const legacy = !stored || typeof stored.__v !== 'number' || stored.__v < MC_SETTINGS_VERSION
      const merged = mcMerge(MC_DEFAULTS, stored || {})
      /* Round 5 removed the ambient channel and switched BGM to real tracks:
         drop a stored ambient section (the merge keeps unknown keys) and forget
         the old synthetic track selection. */
      delete merged.ambient
      if (legacy && stored) merged.bgm.trackId = ''
      /* Rounds 3/4 raised the wallpaper brightness and made the panel slider
         able to reach "no panel tint at all"; older stored dim / gain / glass
         values would still shade the picture. Reset those three once. */
      if (legacy && stored) {
        if (stored.wallpaper) {
          merged.wallpaper.dim = MC_DEFAULTS.wallpaper.dim
          merged.wallpaper.gain = MC_DEFAULTS.wallpaper.gain
        }
        if (stored.ui && typeof stored.ui.glass === 'number') {
          merged.ui.glass = MC_DEFAULTS.ui.glass
        }
        /* Round 10 introduced the console drop offset; adopt the new default
           so a value tuned against an older default does not linger. */
        if (stored.ui && typeof stored.ui.hudDrop === 'number') {
          merged.ui.hudDrop = MC_DEFAULTS.ui.hudDrop
        }
      }
      merged.__v = MC_SETTINGS_VERSION
      return mcNormalize(merged)
    }

    /**
     * Tiny observable store: components subscribe, the runtime re-applies the
     * palette and persists the record on every change.
     */
    const mcSettings = (function () {
      let state = mcLoadSettings()
      const listeners = new Set()

      function save() {
        try {
          window.localStorage.setItem(MC_STORAGE_KEY, JSON.stringify(state))
        } catch (_error) {
          /* storage full or unavailable: the session keeps its in-memory copy */
        }
      }

      function emit() {
        for (const listener of Array.from(listeners)) {
          try {
            listener(state)
          } catch (_error) {
            /* one broken subscriber must not break the others */
          }
        }
      }

      return {
        get() {
          return state
        },
        /** Merge a partial patch, persist and notify. */
        patch(patch) {
          state = mcNormalize(mcMerge(state, patch))
          save()
          emit()
          return state
        },
        set(next) {
          state = mcNormalize(mcMerge(MC_DEFAULTS, next || {}))
          save()
          emit()
          return state
        },
        reset() {
          state = mcNormalize(mcMerge(MC_DEFAULTS, {}))
          save()
          emit()
          return state
        },
        subscribe(listener) {
          listeners.add(listener)
          return function unsubscribe() {
            listeners.delete(listener)
          }
        },
      }
    })()

    /** True while the GUI renders its dark theme. */
    function mcIsDark() {
      const body = document.body
      const root = document.documentElement
      if (!body && !root) return true
      if (body && body.hasAttribute('data-ds-dark-theme')) return true
      if (root && root.hasAttribute('data-ds-dark-theme')) return true
      if (body && body.getAttribute('data-ds-theme') === 'dark') return true
      if (root && root.getAttribute('data-ds-theme') === 'dark') return true
      return false
    }

    /* ------------------------------------------------------------------ *
     * 2. Translations (registered through the client locale service)
     * ------------------------------------------------------------------ */

    const MC_I18N = {
      zh: {
        'meta.title': 'Minecraft 主题界面',
        'meta.description': '像素方块风格：Minecraft 壁纸、方块化组件、点击音效与 BGM。',
        'hud.toggle': 'Minecraft 主题',
        'hud.wallpaper': '切换壁纸',
        'hud.sound': '音效',
        'hud.bgm': '背景音乐',
        'hud.nextTrack': '下一首',
        'hud.options': '选项',
        'hud.panel': 'Minecraft 控制台',
        'hud.hide': '收起控制台',
        'hud.show': '展开控制台',
        'hud.hideConsole': '隐藏控制台',
        'common.on': '开',
        'common.off': '关',
        'common.close': '关闭',
        'common.reset': '恢复默认',
        'common.done': '完成',
        'wall.title': '壁纸',
        'wall.library': '壁纸库',
        'wall.auto': '自动轮换',
        'wall.interval': '轮换间隔',
        'wall.dim': '壁纸暗度',
        'wall.gain': '壁纸亮度',
        'wall.gainHint': '100% = 原图亮度，可再往上提亮',
        'wall.particles': '漂浮尘埃',
        'wall.next': '下一张',
        'wall.current': '当前壁纸',
        'wall.photos': '壁纸库',
        'wall.empty': '壁纸库还是空的',
        'wall.mine': '我的壁纸',
        'wall.mineHint': '支持 jpg / png / webp，导入后自动缩到 1920px 存进本机',
        'wall.mineError': '本机壁纸存储不可用',
        'wall.upload': '上传壁纸',
        'wall.uploadFailed': '这个文件没能读入',
        'wall.delete': '删除',
        'wall.refresh': '刷新列表',
        'sound.title': '音效',
        'sound.enable': '点击音效',
        'sound.volume': '音量',
        'sound.missing': '音效样本未随插件提供，已使用合成音兜底（把 mp3 放进 assets/sfx 即可）',
        'bgm.title': '背景音乐',
        'bgm.enable': '播放 BGM',
        'bgm.volume': '音量',
        'bgm.track': '曲目',
        'bgm.trackHint': '一曲结束自动接下一首；曲目来自插件目录与你上传到本机的音乐',
        'bgm.loading': '曲目加载中…',
        'bgm.empty': '还没有曲目，可以在下面上传',
        'bgm.next': '下一首',
        'bgm.mine': '我的音乐',
        'bgm.mineHint': '支持 mp3 / ogg / wav / m4a / flac，存进本机（单曲上限 60 MB）',
        'bgm.mineError': '本机音乐存储不可用',
        'bgm.upload': '上传音乐',
        'bgm.uploadFailed': '这个音频没能读入',
        'bgm.delete': '删除',
        'ui.title': '界面',
        'ui.glass': '面板不透明度',
        'ui.glassHint': '0% = 壁纸完全露出原样',
        'ui.achievements': '成就提示',
        'ui.hud': '显示控制台',
        'ui.hudHint': '关闭后右下角的 Minecraft 控制台会隐藏，随时可以在这里重新打开',
        'ach.title': '成就达成！',
        'ach.themeOn': '已进入方块世界',
        'ach.themeOff': '已离开方块世界',
        'ach.soundOn': '音效已开启',
        'ach.soundOff': '音效已静音',
        'ach.bgmOn': '背景音乐开始播放',
        'ach.bgmOff': '背景音乐已停止',
        'ach.trackOn': '正在播放：',
        'ach.wallpaper': '壁纸已更换',
        'ach.wallpaperAdded': '壁纸已加入图库',
        'ach.wallpaperRemoved': '壁纸已删除',
        'ach.wallpaperFailed': '壁纸加载失败，已切回实景壁纸',
        'ach.hudHidden': '控制台已隐藏，可在 设置 → Minecraft 主题 重新显示',
        'ach.trackAdded': '音乐已加入曲库',
        'ach.trackRemoved': '音乐已删除',
        'tip.volume': '音量',
      },
      en: {
        'meta.title': 'Minecraft UI',
        'meta.description': 'Pixel-block interface: Minecraft wallpapers, blocky components, click sounds and BGM.',
        'hud.toggle': 'Minecraft theme',
        'hud.wallpaper': 'Change wallpaper',
        'hud.sound': 'Sound effects',
        'hud.bgm': 'Background music',
        'hud.nextTrack': 'Next track',
        'hud.options': 'Options',
        'hud.panel': 'Minecraft console',
        'hud.hide': 'Collapse console',
        'hud.show': 'Expand console',
        'hud.hideConsole': 'Hide console',
        'common.on': 'On',
        'common.off': 'Off',
        'common.close': 'Close',
        'common.reset': 'Reset',
        'common.done': 'Done',
        'wall.title': 'Wallpaper',
        'wall.library': 'Wallpaper library',
        'wall.auto': 'Auto rotate',
        'wall.interval': 'Interval',
        'wall.dim': 'Dimming',
        'wall.gain': 'Wallpaper brightness',
        'wall.gainHint': '100% = original image; raise it to brighten',
        'wall.particles': 'Dust motes',
        'wall.next': 'Next',
        'wall.current': 'Current',
        'wall.photos': 'Wallpapers',
        'wall.empty': 'No wallpapers available',
        'wall.mine': 'My wallpapers',
        'wall.mineHint': 'JPG / PNG / WebP — imported images are scaled to 1920px and stored locally',
        'wall.mineError': 'Local wallpaper storage is unavailable',
        'wall.upload': 'Add wallpaper',
        'wall.uploadFailed': 'That file could not be imported',
        'wall.delete': 'Delete',
        'wall.refresh': 'Refresh list',
        'sound.title': 'Sound effects',
        'sound.enable': 'Click sound',
        'sound.volume': 'Volume',
        'sound.missing': 'Sample files are not bundled; synthesized sounds are used instead (drop mp3 files into assets/sfx)',
        'bgm.title': 'Background music',
        'bgm.enable': 'Play BGM',
        'bgm.volume': 'Volume',
        'bgm.track': 'Track',
        'bgm.trackHint': 'The next track follows automatically; tracks come from the plugin folder and from music you upload locally',
        'bgm.loading': 'Loading tracks…',
        'bgm.empty': 'No tracks yet — upload some below',
        'bgm.next': 'Next track',
        'bgm.mine': 'My music',
        'bgm.mineHint': 'MP3 / OGG / WAV / M4A / FLAC, stored locally (one file up to 60 MB)',
        'bgm.mineError': 'Local music storage is unavailable',
        'bgm.upload': 'Upload music',
        'bgm.uploadFailed': 'That audio file could not be imported',
        'bgm.delete': 'Delete',
        'ui.title': 'Interface',
        'ui.glass': 'Panel opacity',
        'ui.glassHint': '0% = wallpaper shows at its original brightness',
        'ui.achievements': 'Achievement toasts',
        'ui.hud': 'Show the console',
        'ui.hudHint': 'Turn off to hide the Minecraft console in the bottom-right; bring it back here any time',
        'ach.title': 'Advancement made!',
        'ach.themeOn': 'Entered the block world',
        'ach.themeOff': 'Left the block world',
        'ach.soundOn': 'Sound effects on',
        'ach.soundOff': 'Sound effects muted',
        'ach.bgmOn': 'Background music playing',
        'ach.bgmOff': 'Background music stopped',
        'ach.trackOn': 'Now playing: ',
        'ach.wallpaper': 'Wallpaper changed',
        'ach.wallpaperAdded': 'Wallpaper added',
        'ach.wallpaperRemoved': 'Wallpaper deleted',
        'ach.wallpaperFailed': 'Wallpaper failed to load; switched back to a photo wallpaper',
        'ach.hudHidden': 'Console hidden — re-enable it in Settings → Minecraft UI',
        'ach.trackAdded': 'Music added to your library',
        'ach.trackRemoved': 'Music deleted',
        'tip.volume': 'Volume',
      },
    }

    /** Language fallback used until the locale service hands us a translator. */
    const mcLang = (function () {
      let tag = 'zh'
      try {
        tag = String(document.documentElement.getAttribute('lang') || navigator.language || 'zh')
      } catch (_error) {
        tag = 'zh'
      }
      return tag.toLowerCase().indexOf('en') === 0 ? 'en' : 'zh'
    })()

    /** Active translator; replaced by the locale-bound one when available. */
    let mcT = function mcTranslateFallback(key) {
      const dict = MC_I18N[mcLang] || MC_I18N.zh
      return dict[key] || MC_I18N.zh[key] || key
    }

    /* ------------------------------------------------------------------ *
     * 3. Palette → dsw design tokens
     * ------------------------------------------------------------------ */

    /** `rgba()` helper with a safely clamped alpha. */
    function mcRgba(r, g, b, alpha) {
      return 'rgba(' + r + ',' + g + ',' + b + ',' + (Math.round(mcClamp(alpha, 0, 1) * 1000) / 1000) + ')'
    }

    /* ------------------------------------------------------------------ *
     * 3. Palettes → dsw design tokens（不改配色，只改透明度）
     *
     * 用户要求：界面保持 DSH 原来的颜色，不要发绿。所以这里完全不自己
     * 定义色板，而是在主题渲染之后再读取一次「原来的」token 颜色，只把
     * 需要透出壁纸的那几个「面板底色」换成本色的半透明版本；文字、品牌色、
     * 按钮、边框、状态色一律保留官方值。像素方块风格的立体描边由各自的
     * --mc-* 变量提供（用中性黑白，不染色）。
     * ------------------------------------------------------------------ */

    /** `rgba()` helper with a safely clamped alpha. */
    function mcRgba(r, g, b, alpha) {
      return 'rgba(' + r + ',' + g + ',' + b + ',' + (Math.round(mcClamp(alpha, 0, 1) * 1000) / 1000) + ')'
    }

    /** Opaque `rgb()` helper. */
    function mcRgb(r, g, b) {
      return 'rgb(' + r + ',' + g + ',' + b + ')'
    }

    /** Tokens sampled from the running theme before this plugin overrides them. */
    let mcStock = null

    /** Scheme that the cached stock sample was read under. */
    let mcStockScheme = null

    /** The stock tokens we need: surfaces to make translucent + neutrals for widgets. */
    const MC_STOCK_PROBE = [
      '--dsw-alias-bg-base',
      '--dsw-alias-bg-layer-1',
      '--dsw-alias-bg-layer-2',
      '--dsw-alias-bg-layer-3',
      '--dsw-alias-bg-overlay',
      '--dsw-alias-bg-module-platform',
      '--dsw-alias-bg-multi-select',
      '--dsw-alias-brand-primary',
      '--dsw-alias-label-primary',
      '--dsw-alias-label-secondary',
      '--dsw-alias-state-warn-primary',
      '--dsw-alias-tooltip-bg',
      '--dsw-specific-sidebar-fill',
      '--dsw-specific-bubble',
      '--dsw-specific-input-major',
      '--dsw-specific-menu',
      '--dsw-specific-tip'
    ]

    /** Neutral fallbacks, used when a token is missing from the active theme. */
    const MC_STOCK_FALLBACK = {
      dark: {
        '--dsw-alias-bg-base': [20, 21, 24],
        '--dsw-alias-bg-layer-1': [28, 30, 34],
        '--dsw-alias-bg-layer-2': [35, 38, 43],
        '--dsw-alias-bg-layer-3': [43, 46, 52],
        '--dsw-alias-bg-overlay': [16, 17, 20],
        '--dsw-alias-bg-module-platform': [35, 38, 43],
        '--dsw-alias-bg-multi-select': [48, 52, 60],
        '--dsw-alias-brand-primary': [110, 138, 255],
        '--dsw-alias-label-primary': [232, 234, 237],
        '--dsw-alias-label-secondary': [160, 166, 173],
        '--dsw-alias-state-warn-primary': [224, 179, 82],
        '--dsw-alias-tooltip-bg': [27, 29, 33],
        '--dsw-specific-sidebar-fill': [16, 17, 19],
        '--dsw-specific-bubble': [30, 32, 36],
        '--dsw-specific-input-major': [26, 28, 31],
        '--dsw-specific-menu': [27, 29, 33],
        '--dsw-specific-tip': [27, 29, 33]
      },
      light: {
        '--dsw-alias-bg-base': [255, 255, 255],
        '--dsw-alias-bg-layer-1': [247, 248, 250],
        '--dsw-alias-bg-layer-2': [240, 242, 245],
        '--dsw-alias-bg-layer-3': [232, 234, 238],
        '--dsw-alias-bg-overlay': [255, 255, 255],
        '--dsw-alias-bg-module-platform': [240, 242, 245],
        '--dsw-alias-bg-multi-select': [226, 231, 240],
        '--dsw-alias-brand-primary': [59, 91, 253],
        '--dsw-alias-label-primary': [31, 35, 40],
        '--dsw-alias-label-secondary': [87, 96, 106],
        '--dsw-alias-state-warn-primary': [154, 103, 0],
        '--dsw-alias-tooltip-bg': [31, 35, 40],
        '--dsw-specific-sidebar-fill': [245, 246, 248],
        '--dsw-specific-bubble': [242, 243, 246],
        '--dsw-specific-input-major': [255, 255, 255],
        '--dsw-specific-menu': [255, 255, 255],
        '--dsw-specific-tip': [255, 255, 255]
      }
    }

    /**
     * Parse one CSS colour into channels. Accepts #rgb/#rrggbb/#rrggbbaa and
     * `rgb()` / `rgba()`. Anything else (var(), color-mix(), gradients) is
     * rejected so the caller can fall back.
     * @param {string} value - raw token text.
     * @returns {{ r: number, g: number, b: number, a: number } | null} channels.
     */
    function mcParseColor(value) {
      const text = String(value || '').trim()
      if (!text) return null
      if (text.charAt(0) === '#') {
        let hex = text.slice(1)
        if (hex.length === 3 || hex.length === 4) {
          hex = hex.split('').map(function (ch) { return ch + ch }).join('')
        }
        if (hex.length !== 6 && hex.length !== 8) return null
        const num = parseInt(hex.slice(0, 6), 16)
        if (!isFinite(num)) return null
        const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
        return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255, a: isFinite(a) ? a : 1 }
      }
      const match = /^rgba?\(([^)]+)\)$/i.exec(text)
      if (!match) return null
      const parts = match[1].split(/[,\/\s]+/).filter(function (part) { return part.length > 0 })
      if (parts.length < 3) return null
      const chan = []
      for (let i = 0; i < 3; i += 1) {
        const raw = parts[i]
        const pct = raw.slice(-1) === '%'
        const value2 = parseFloat(raw)
        if (!isFinite(value2)) return null
        chan.push(Math.max(0, Math.min(255, Math.round(pct ? value2 * 2.55 : value2))))
      }
      let a = 1
      if (parts.length > 3) {
        const rawAlpha = parts[3]
        const pctAlpha = rawAlpha.slice(-1) === '%'
        const parsed = parseFloat(rawAlpha)
        if (isFinite(parsed)) a = Math.max(0, Math.min(1, pctAlpha ? parsed / 100 : parsed))
      }
      return { r: chan[0], g: chan[1], b: chan[2], a: a }
    }

    /**
     * Read the stock theme tokens once, straight off the live body, before any
     * override of ours is written. Called again only after a strip (scheme
     * flip), so it never reads back our own values.
     * @param {boolean} refresh - drop the cache and re-read.
     * @returns {Record<string, { r: number, g: number, b: number }>} sampled tokens.
     */
    function mcSampleStock(refresh, darkHint) {
      const dark = typeof darkHint === 'boolean' ? darkHint : mcIsDark()
      const scheme = dark ? 'dark' : 'light'
      if (mcStock && !refresh && mcStockScheme === scheme) return mcStock
      const fallback = MC_STOCK_FALLBACK[dark ? 'dark' : 'light']
      const out = {}
      let styles = null
      try {
        styles = document.body ? getComputedStyle(document.body) : null
      } catch (_error) {
        styles = null
      }
      for (let i = 0; i < MC_STOCK_PROBE.length; i += 1) {
        const name = MC_STOCK_PROBE[i]
        let parsed = null
        if (styles && typeof styles.getPropertyValue === 'function') {
          try {
            parsed = mcParseColor(styles.getPropertyValue(name))
          } catch (_error) {
            parsed = null
          }
        }
        const fb = fallback[name] || [128, 128, 128]
        out[name] = parsed
          ? { r: parsed.r, g: parsed.g, b: parsed.b }
          : { r: fb[0], g: fb[1], b: fb[2] }
      }
      mcStock = out
      mcStockScheme = scheme
      return out
    }

    /** Invalidate the sample (used before a re-apply after a scheme flip). */
    function mcResetStock() {
      mcStock = null
      mcStockScheme = null
    }

    /** `rgba()` of one sampled token with a new alpha. */
    function mcStockAlpha(token, alpha, darkHint) {
      const stock = mcSampleStock(false, darkHint)
      const parts = stock[token] || { r: 128, g: 128, b: 128 }
      return mcRgba(parts.r, parts.g, parts.b, alpha)
    }

    /**
     * Build the token overrides: only surfaces get a new alpha, everything
     * else keeps the theme's own colour. Plugin widgets get neutral edges and
     * the theme's own accent so nothing is tinted.
     * @param {boolean} dark - true when the GUI is in its dark scheme.
     * @param {number} glass - 0 (panels vanish, wallpaper at its original
     *   brightness) .. 1 (surfaces as opaque as the theme allows).
     * @returns {Record<string, string>} token name → CSS value.
     */
    function mcTokens(dark, glass) {
      const g = mcClamp(glass, 0, 1)
      const t = {}

      /* Surface alpha curve: it starts at zero so the slider's left end shows
         the wallpaper exactly as the file is, and grows linearly. Dialogs,
         menus and tooltips keep a readability floor. g = 0.62 → base 0.38 /
         layer-1 0.50 / overlay 0.94. */
      const baseA = 0.62 * g
      const l1A = 0.8 * g
      const l2A = 0.88 * g
      const l3A = 0.92 * g
      const ovA = 0.86 + 0.13 * g
      const sbA = 0.66 * g

      t['--dsw-alias-bg-base'] = mcStockAlpha('--dsw-alias-bg-base', baseA, dark)
      t['--dsw-alias-bg-layer-1'] = mcStockAlpha('--dsw-alias-bg-layer-1', l1A, dark)
      t['--dsw-alias-bg-layer-2'] = mcStockAlpha('--dsw-alias-bg-layer-2', l2A, dark)
      t['--dsw-alias-bg-layer-3'] = mcStockAlpha('--dsw-alias-bg-layer-3', l3A, dark)
      t['--dsw-alias-bg-module-platform'] = mcStockAlpha('--dsw-alias-bg-module-platform', l2A, dark)
      t['--dsw-alias-bg-overlay'] = mcStockAlpha('--dsw-alias-bg-overlay', ovA, dark)
      t['--dsw-specific-sidebar-fill'] = mcStockAlpha('--dsw-specific-sidebar-fill', sbA, dark)
      t['--dsw-specific-bubble'] = mcStockAlpha('--dsw-specific-bubble', l2A, dark)
      t['--dsw-specific-input-major'] = mcStockAlpha('--dsw-specific-input-major', l1A, dark)
      t['--dsw-specific-login-input'] = mcStockAlpha('--dsw-specific-input-major', l1A, dark)
      t['--dsw-specific-menu'] = mcStockAlpha('--dsw-specific-menu', ovA, dark)
      t['--dsw-specific-tip'] = mcStockAlpha('--dsw-specific-tip', ovA, dark)

      /* Plugin widgets: same palette, Minecraft block bevel, no hue change. */
      const panelA = dark ? 0.82 : 0.9
      t['--mc-panel'] = mcStockAlpha('--dsw-alias-bg-layer-1', panelA, dark)
      t['--mc-panel-2'] = mcStockAlpha('--dsw-alias-bg-layer-2', Math.min(1, panelA + 0.06), dark)
      t['--mc-panel-3'] = mcStockAlpha('--dsw-alias-bg-layer-3', Math.min(1, panelA + 0.1), dark)
      t['--mc-edge-light'] = dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.72)'
      t['--mc-edge-dark'] = dark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.22)'
      t['--mc-accent'] = mcStockAlpha('--dsw-alias-brand-primary', 1, dark)
      t['--mc-accent-2'] = mcStockAlpha('--dsw-alias-state-warn-primary', 1, dark)
      t['--mc-text'] = mcStockAlpha('--dsw-alias-label-primary', 1, dark)
      t['--mc-text-dim'] = mcStockAlpha('--dsw-alias-label-secondary', 1, dark)
      t['--mc-shadow'] = dark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.18)'
      t['--mc-wood'] = dark ? 'rgb(58,58,60)' : 'rgb(206,203,196)'
      t['--mc-wood-2'] = dark ? 'rgb(74,74,77)' : 'rgb(184,180,171)'
      t['--mc-slot'] = dark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.08)'
      t['--mc-tooltip-bg'] = mcStockAlpha('--dsw-alias-tooltip-bg', 1, dark)
      t['--mc-tooltip-edge'] = dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.16)'
      return t
    }

    /** Token names currently written as inline properties on <body>. */
    const mcAppliedTokens = []

    /** Scheme the current overrides were built for ('dark' | 'light' | null). */
    let mcAppliedScheme = null

    /** Push the current palette into inline custom properties on <body>. */
    function mcApplyPalette() {
      const body = document.body
      if (!body) return
      const settings = mcSettings.get()
      const dark = mcIsDark()
      const scheme = dark ? 'dark' : 'light'
      /* A scheme flip invalidates the sampled stock colours: our old inline
         values would pollute the sample, so strip → re-sample → re-apply. */
      if (mcAppliedScheme !== null && mcAppliedScheme !== scheme) {
        mcStripPalette()
        mcResetStock()
      }
      const tokens = mcTokens(dark, settings.ui.glass)
      const style = body.style
      const enabled = !!settings.enabled

      /* Whole-GUI tokens only while the theme is on, so switching it off gives
         the stock palette back; the plugin's own --mc-* variables stay for its
         HUD, which is visible in both states. */
      for (const name of Object.keys(tokens)) {
        const own = name.indexOf('--mc-') === 0
        if (!enabled && !own) continue
        try {
          style.setProperty(name, tokens[name])
          if (mcAppliedTokens.indexOf(name) < 0) mcAppliedTokens.push(name)
        } catch (_error) {
          /* unknown property name: skip it */
        }
      }

      body.setAttribute(MC_BODY_ATTR, enabled ? 'on' : 'off')
      body.setAttribute('data-mc-scheme', scheme)
      mcAppliedScheme = scheme
    }

    /** Remove every token and attribute the plugin added to <body>. */
    function mcStripPalette() {
      const body = document.body
      if (!body) return
      for (const name of mcAppliedTokens) {
        try {
          body.style.removeProperty(name)
        } catch (_error) {
          /* ignore */
        }
      }
      mcAppliedTokens.length = 0
      mcAppliedScheme = null
      body.removeAttribute(MC_BODY_ATTR)
      body.removeAttribute('data-mc-scheme')
    }

/* ---- src/25-photos.js ---- */
/* ============================================================
 * minecraft-ui / 25-photos.js —— 壁纸目录（宿主半静态提供，不进 JS 包）
 *
 * 为什么不是编译期写死的清单：
 *   开源发布时仓库里只带一张壁纸，用户自己的收藏不入库（版权原因）；
 *   所以壁纸列表来自宿主半的目录清单 `GET /api/minecraft-ui/wallpapers`，
 *   把 `<slug>.webp`（可选 `<slug>.thumb.webp`）丢进 assets/wallpapers/ 就能用，
 *   名字与描述写在 manifest.json / manifest.local.json 里。
 *
 * 文件约定：<slug>.webp 为 1600 宽大图，<slug>.thumb.webp 为 480 宽缩略图。
 * 顶层标识符统一带 mc / MC_ 前缀，只在拼接后的浏览器函数体里使用。
 * ============================================================ */

/** 壁纸静态路由前缀（与宿主半 index.js 的 ASSET_PREFIX 保持一致）。 */
const MC_PHOTO_PREFIX = '/api/minecraft-ui/wallpapers'

/**
 * 壁纸清单（可变）：加载完成后填入，`id` 形如 `photo-<slug>`。
 * 运行时与选择面板都直接读这个数组，所以这里就地替换内容而不是换引用。
 */
const MC_PHOTOS = []

/** 清单加载状态：镜像 + 订阅，供 React 组件与运行时共用。 */
const mcPhotoLibrary = {
  items: MC_PHOTOS,
  ready: false,
  error: '',
  promise: null,
  listeners: new Set(),
}

function mcPhotoEmit() {
  for (const listener of Array.from(mcPhotoLibrary.listeners)) {
    try {
      listener(mcPhotoLibrary)
    } catch (error) {
      console.warn('[minecraft-ui] wallpaper library listener failed', error)
    }
  }
}

/** 把清单条目转成内部条目的形状。 */
function mcPhotoShape(entry) {
  const slug = String(entry && entry.slug ? entry.slug : '')
  return {
    id: 'photo-' + slug,
    slug: slug,
    name: (entry && entry.name) || slug,
    desc: (entry && entry.desc) || '',
    kind: 'photo',
    dark: true,
  }
}

/**
 * 拉取壁纸目录（幂等；永不 reject）。宿主半目录为空时得到一个空清单，
 * 此时插件只显示用户自己上传的壁纸，不会报错。
 * @returns {Promise<Array<{ id: string, slug: string, name: string, desc: string }>>} 清单。
 */
function mcLoadPhotoLibrary() {
  if (mcPhotoLibrary.promise) return mcPhotoLibrary.promise
  mcPhotoLibrary.promise = Promise.resolve()
    .then(function fetchList() {
      return fetch(MC_PHOTO_PREFIX, { cache: 'no-store' })
    })
    .then(function toJson(response) {
      return response && response.ok ? response.json() : { ok: false, photos: [] }
    })
    .then(function onList(payload) {
      const entries = payload && Array.isArray(payload.photos) ? payload.photos : []
      const next = entries.map(mcPhotoShape).filter(function valid(entry) {
        return !!entry.slug
      })
      MC_PHOTOS.length = 0
      for (let i = 0; i < next.length; i += 1) MC_PHOTOS.push(next[i])
      mcPhotoLibrary.ready = true
      mcPhotoLibrary.error = payload && payload.ok === false && !next.length ? 'empty' : ''
      mcPhotoEmit()
      return MC_PHOTOS
    })
    .catch(function onError(error) {
      console.warn('[minecraft-ui] wallpaper library failed', error)
      mcPhotoLibrary.ready = true
      mcPhotoLibrary.error = 'error'
      mcPhotoEmit()
      return MC_PHOTOS
    })
  return mcPhotoLibrary.promise
}

/** 重新拉取壁纸目录（用户往目录里丢了新图之后用）。 */
function mcPhotoRefresh() {
  mcPhotoLibrary.promise = null
  mcPhotoLibrary.ready = false
  return mcLoadPhotoLibrary()
}

/** 订阅壁纸目录变化；返回取消订阅函数。 */
function mcSubscribePhotos(listener) {
  mcPhotoLibrary.listeners.add(listener)
  return function unsubscribePhotos() {
    mcPhotoLibrary.listeners.delete(listener)
  }
}

/**
 * 按 id 找一张照片壁纸。
 * @param {string} id - 形如 `photo-yuwen-1`。
 * @returns {{ id: string, slug: string, name: string, desc: string } | null} 条目。
 */
function mcPhotoFind(id) {
  for (let i = 0; i < MC_PHOTOS.length; i += 1) {
    if (MC_PHOTOS[i].id === id) return MC_PHOTOS[i]
  }
  return null
}

/**
 * 照片壁纸的浏览器地址（相对路径，跟随页面 origin）。
 * @param {string} id - 形如 `photo-yuwen-1`。
 * @param {boolean} thumb - true 时给 480 宽缩略图。
 * @returns {string} URL，找不到时为空串。
 */
function mcPhotoUrl(id, thumb) {
  const entry = mcPhotoFind(id)
  if (!entry) return ''
  return MC_PHOTO_PREFIX + '/' + entry.slug + (thumb ? '.thumb' : '') + '.webp'
}

/* ---- src/27-library.js ---- */
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

/* ---- src/30-audio.js ---- */
/* ============================================================================
 * 30-audio.js — Minecraft 风格 WebAudio 音频引擎
 *
 * 声音来源（可完全不含版权素材，开源仓库也能正常出声）
 *  - 界面音效：GET /api/minecraft-ui/sounds/<文件名> 的 5 个 mp3，
 *    preload() 时 fetch + decodeAudioData 并缓存；hover 例外，保留极轻合成 tick。
 *    采样缺失（404 / 解码失败）时，click / open / close / toggle / success /
 *    levelUp / error 一律回退到本文件内的合成音，绝不静默变哑；每个音效最多 warn 一次。
 *  - BGM：GET /api/minecraft-ui/music 返回的宿主目录曲目清单（.ogg），
 *    加上宿主用 setUserTracks() 注入的用户曲目（浏览器 IndexedDB 里的 Blob），
 *    两者合并成一个播放列表；懒解码单曲、缓存最近 3 首、播完自动接下一首，
 *    切歌 1s 交叉淡入淡出。
 *  - 环境音（下雨 / 风声）已整体移除，雨声归入 BGM 曲目。
 *
 * 自动播放策略
 *  - preload() 允许在无手势时创建一个 suspended 的 AudioContext 并解码 5 个音效采样，
 *    但不会 resume、不会发声；真正的发声必须等 unlock()（真实用户手势）。
 *  - 未 unlock 前所有播放函数静默返回；所有对外方法 try/catch 兜底，绝不抛错；
 *    控制台只在"采样缺失、已改用合成音"时 warn（每个音效最多一条）。
 *
 * 性能
 *  - 短音效"即用即弃"（到时自动 disconnect 全部节点）；
 *    BGM 是单个采样源（src + gain），停止 / 切歌时立即断开，不留残响节点。
 *  - 音量：master / sfx / bgm 三组独立增益，setTargetAtTime 平滑，
 *    播放中调整也不会爆音。
 *
 * 该文件会被原样拼接进浏览器里的一个函数体内部（不是 ESM 模块），因此：
 *  - 没有 import / export / require / 顶层 await / 顶层 return / 'use strict'；
 *  - 顶层只有 const / let / function 声明，标识符统一 mcSnd* / MC_SND_* / MC_SAMPLE_* 前缀；
 *  - 输出对象为 MC_AUDIO，另导出辅助函数 mcAudioSupported()。
 *  - 不使用方波长音（刺耳），不使用 setInterval 高频轮询。
 * ==========================================================================*/

/* ---------------------------------------------------------------------------
 * 0. 常量与模块状态
 * -------------------------------------------------------------------------*/

/** 三组总线默认音量（保守：BGM 0.22，目标是"若有若无"）。 */
const mcSndVolumes = { master: 0.75, sfx: 0.6, bgm: 0.22 };

/** 宿主提供的 Minecraft BGM 曲目路由（同源）：清单 JSON 与单曲音频。 */
const MC_MUSIC_BASE = '/api/minecraft-ui/music';
/** 已解码 BGM 缓存上限（单曲约 2MB，最多缓存最近 3 首）。 */
const MC_SND_BGM_CACHE_MAX = 3;

/** 宿主提供的 Minecraft 原版音频素材路由（同源，返回 audio/mpeg）。 */
const MC_SAMPLE_BASE = '/api/minecraft-ui/sounds';

/** 需要预加载的 5 个音效采样名（文件名去掉 .mp3；rain 已移入 BGM，不再属于音效）。 */
const MC_SND_SAMPLE_NAMES = [
  'ui-stonecutter-select_recipe-1',   // 石切机"选择配方"：点击音
  'block-chest-open-1',               // 箱子打开
  'block-chest-close-1',              // 箱子关闭
  'block-wooden_door-open-1',         // 木门打开（降速 + 低通 => 错误音）
  'entity-firework_rocket-launch-1'   // 烟花发射（成功 / 升级，只取前 0.9s）
];

/* ---- 音频上下文与总线（unlock 后才存在） ---- */
let mcSndCtx = null;          // AudioContext 实例
let mcSndMaster = null;       // 主增益
let mcSndSfxBus = null;       // 短音效总线
let mcSndBgmBus = null;       // BGM 总线
let mcSndComp = null;         // 母线压缩器（可有可无）
let mcSndReverbIn = null;     // 混响送出节点
let mcSndReverbWet = null;    // 混响湿声增益
let mcSndNoiseBuf = null;     // 2 秒白噪声缓冲（所有噪声源共用）
let mcSndVisAttached = false; // visibilitychange 是否已挂载
let mcSndHidden = false;      // 页面是否隐藏
let mcSndResumeGuardUntil = 0; // resume() 尝试后的短暂保护窗口（防调度堆积）

/* ---- BGM 状态（真实采样：懒加载清单 + 懒解码 + 交叉淡入淡出） ---- */
let mcSndBgmTracks = null;          // 已加载的曲目清单 [{id,name,size}]，null 表示还没加载
let mcSndBgmTracksPromise = null;   // 清单加载的共享 Promise
let mcSndBgmCurrentId = null;       // 当前 / 最近一次要播放的曲目 id
let mcSndBgmPlaying = false;        // 是否"应在播放"
let mcSndBgmSource = null;          // 当前正在播放的 BufferSource
let mcSndBgmGain = null;            // 当前曲目的增益节点
let mcSndBgmToken = 0;              // 播放代次：丢弃过期的异步解码 / onended 回调
let mcSndBgmFadeTimer = null;       // 交叉淡出后回收旧 source 的定时器
let mcSndBgmCache = [];             // 最近解码的曲目（最多 3 首）[{id, buffer}]
let mcSndBgmBufferPromises = {};    // id -> Promise<AudioBuffer|null>（解码去重）
let mcSndBgmWarned = {};            // id -> true，同一首曲目的加载失败只 warn 一次

/* ---- 用户曲目（宿主从 IndexedDB 取出的 Blob，覆盖式注入） ---- */
let mcSndUserTracks = [];       // [{ id, name, size, blob }]，blob 是原始音频 Blob

/* ---- 音效采样缓存（宿主可能完全不提供素材，缺失即走合成兜底） ---- */
let mcSamples = {};             // { name: AudioBuffer|null }，加载失败为 null
let mcSndSampleStates = {};     // name -> 'loading' | 'ok' | 'failed'
let mcSndMissingWarned = {};    // effect -> true，采样缺失改用合成音只 warn 一次
let mcSndPreloadPromise = null; // 共享的加载 Promise（preload 幂等）
let mcSndUnlocked = false;      // 是否已经过真实用户手势 unlock（preload 建上下文不算）

/* ---- 交互限流 ---- */
let mcSndLastHoverAt = 0;
let mcSndToggleOn = false;    // toggle() 不带参数，内部自动交替：开 = 箱子打开声，关 = 箱子关闭声

/* ---------------------------------------------------------------------------
 * 1. 基础工具
 * -------------------------------------------------------------------------*/

/**
 * 当前环境是否支持 WebAudio（window.AudioContext / webkitAudioContext）。
 * @returns {boolean}
 */
function mcAudioSupported() {
  try {
    if (typeof window === 'undefined' || !window) return false;
    return !!(window.AudioContext || window.webkitAudioContext);
  } catch (e) {
    return false;
  }
}

/** 把值夹到 0~1；非法值返回 null。 */
function mcSndClamp01(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (typeof n !== 'number' || !isFinite(n)) return null;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** AudioContext 当前时间（未 unlock 时为 0）。 */
function mcSndNow() {
  try {
    return mcSndCtx && typeof mcSndCtx.currentTime === 'number' ? mcSndCtx.currentTime : 0;
  } catch (e) {
    return 0;
  }
}

/** 按名字取总线：'bgm' / 其它 => sfx。 */
function mcSndBusFor(name) {
  if (name === 'bgm') return mcSndBgmBus;
  return mcSndSfxBus;
}

/** 懒创建并复用 2 秒白噪声缓冲。 */
function mcSndGetNoiseBuffer() {
  if (mcSndNoiseBuf || !mcSndCtx) return mcSndNoiseBuf;
  try {
    const sr = mcSndCtx.sampleRate || 44100;
    const len = Math.floor(sr * 2);
    const buf = mcSndCtx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    mcSndNoiseBuf = buf;
  } catch (e) {
    mcSndNoiseBuf = null;
  }
  return mcSndNoiseBuf;
}

/**
 * 创建一个"声部"：登记节点，统一回收。
 * 每个声部到期（expire）或 stopNow() 时，先 stop 所有音源、再 disconnect 所有节点，
 * 保证 connect / disconnect 成对，不泄漏。
 */
function mcSndMakeVoice() {
  const voice = {
    nodes: [],
    sources: [],
    dead: false,
    timer: null,
    expireAt: 0,
    epoch: 0,
    onstop: null,
    /** 立即停止并断开本声部所有节点（幂等）。 */
    stopNow: function () {
      if (voice.dead) return;
      voice.dead = true;
      if (voice.timer !== null) {
        try { clearTimeout(voice.timer); } catch (e) {}
        voice.timer = null;
      }
      try {
        if (typeof voice.onstop === 'function') voice.onstop(voice);
      } catch (e) {}
      for (let i = 0; i < voice.sources.length; i++) {
        try { voice.sources[i].stop(0); } catch (e) {}
      }
      for (let i = 0; i < voice.nodes.length; i++) {
        try { voice.nodes[i].disconnect(); } catch (e) {}
      }
      voice.sources.length = 0;
      voice.nodes.length = 0;
    },
    /** 安排自动回收；多次调用取最晚时间。 */
    expire: function (ms) {
      const wait = Math.max(20, Math.round(typeof ms === 'number' ? ms : 20));
      const at = Date.now() + wait;
      if (at <= voice.expireAt) return;
      voice.expireAt = at;
      if (voice.timer !== null) {
        try { clearTimeout(voice.timer); } catch (e) {}
        voice.timer = null;
      }
      voice.timer = setTimeout(function () { voice.stopNow(); }, wait);
    }
  };
  return voice;
}

/** 用 setTargetAtTime 平滑设置一个 AudioParam（音量等），避免爆音。 */
function mcSndSmoothParam(param, value) {
  try {
    if (!param || typeof param.setTargetAtTime !== 'function') return;
    param.setTargetAtTime(Math.max(0.0001, value), mcSndNow(), 0.06);
  } catch (e) {}
}

/**
 * 给总线做一次淡入 / 淡出（线性 ramp，收尾值不小于 0.0001，避免指数目标非法）。
 */
function mcSndFadeBus(bus, target, seconds) {
  try {
    if (!bus || !bus.gain) return;
    const t = mcSndNow();
    const g = bus.gain;
    const cur = typeof g.value === 'number' && isFinite(g.value) ? g.value : target;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(0.0001, cur), t);
    g.linearRampToValueAtTime(Math.max(0.0001, target), t + Math.max(0.02, seconds));
  } catch (e) {}
}

/** 尝试恢复被挂起的 AudioContext（失败静默）。 */
function mcSndTryResume() {
  try {
    if (!mcSndCtx || typeof mcSndCtx.resume !== 'function') return;
    const p = mcSndCtx.resume();
    if (p && typeof p.then === 'function') p.then(null, function () {});
  } catch (e) {}
}

/**
 * 现在能否发声：未 unlock / 已关闭 / 页面隐藏 => false。
 * preload 可能已经创建了 suspended 的上下文，但那不算 unlock，所以这里先看手势标志；
 * 挂起状态（如被浏览器暂停）会尝试 resume，并允许本次调度（时间轴在挂起期间冻结，
 * 恢复后即可听到）；用保护窗口避免连续调用把音符堆到一起。
 */
function mcSndCanPlay() {
  try {
    if (!mcSndUnlocked) return false;
    if (!mcSndCtx) return false;
    if (mcSndCtx.state === 'closed') return false;
    if (typeof document !== 'undefined' && document.hidden) return false;
    if (mcSndCtx.state !== 'running') {
      const nowMs = Date.now();
      if (nowMs < mcSndResumeGuardUntil) return false;
      mcSndResumeGuardUntil = nowMs + 250;
      mcSndTryResume();
      return true;
    }
    return true;
  } catch (e) {
    return false;
  }
}

/* ---------------------------------------------------------------------------
 * 2. 上下文 / 总线 / 混响 构建
 * -------------------------------------------------------------------------*/

/** 自制卷积混响：指数衰减噪声脉冲，湿声很轻（0.35），只做一点点空间感。 */
function mcSndBuildReverb() {
  try {
    const ctx = mcSndCtx;
    if (!ctx || typeof ctx.createConvolver !== 'function' || !mcSndMaster) return;
    const sr = ctx.sampleRate || 44100;
    const len = Math.floor(sr * 1.8);
    const buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const k = i / len;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - k, 2.8);
      }
    }
    const conv = ctx.createConvolver();
    conv.buffer = buf;

    mcSndReverbIn = ctx.createGain();
    mcSndReverbWet = ctx.createGain();
    mcSndReverbIn.gain.setValueAtTime(1, mcSndNow());
    mcSndReverbWet.gain.setValueAtTime(0.35, mcSndNow());
    mcSndReverbIn.connect(conv);
    conv.connect(mcSndReverbWet);
    mcSndReverbWet.connect(mcSndMaster);
  } catch (e) {
    mcSndReverbIn = null;
    mcSndReverbWet = null;
  }
}

/** 建立总线：sfx / bgm => master =>（可选压缩器）=> destination。 */
function mcSndBuildGraph() {
  if (!mcSndCtx || mcSndMaster) return;
  const ctx = mcSndCtx;
  const t = mcSndNow();

  mcSndMaster = ctx.createGain();
  mcSndMaster.gain.setValueAtTime(mcSndVolumes.master, t);

  let tail = mcSndMaster;
  try {
    if (typeof ctx.createDynamicsCompressor === 'function') {
      mcSndComp = ctx.createDynamicsCompressor();
      mcSndComp.threshold.setValueAtTime(-16, t);
      mcSndComp.knee.setValueAtTime(22, t);
      mcSndComp.ratio.setValueAtTime(3, t);
      mcSndComp.attack.setValueAtTime(0.004, t);
      mcSndComp.release.setValueAtTime(0.2, t);
      mcSndMaster.connect(mcSndComp);
      tail = mcSndComp;
    }
  } catch (e) {
    mcSndComp = null;
    tail = mcSndMaster;
  }
  tail.connect(ctx.destination);

  mcSndSfxBus = ctx.createGain();
  mcSndBgmBus = ctx.createGain();
  mcSndSfxBus.gain.setValueAtTime(mcSndVolumes.sfx, t);
  mcSndBgmBus.gain.setValueAtTime(mcSndVolumes.bgm, t);
  mcSndSfxBus.connect(mcSndMaster);
  mcSndBgmBus.connect(mcSndMaster);

  mcSndBuildReverb();
}

/* ---------------------------------------------------------------------------
 * 3. unlock / 生命周期 / 可见性
 * -------------------------------------------------------------------------*/

/** 页面可见性变化：隐藏时暂停调度并挂起上下文，恢复时继续。 */
function mcSndOnVisibility() {
  try {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      mcSndHidden = true;
      mcSndPauseSchedulers();
      mcSndSuspend();
    } else if (mcSndHidden) {
      mcSndHidden = false;
      mcSndResume();
    }
  } catch (e) {}
}

/** 只挂一次 visibilitychange 监听（unlock 时调用）。 */
function mcSndAttachVisibility() {
  if (mcSndVisAttached) return;
  try {
    if (typeof document === 'undefined' || !document.addEventListener) return;
    document.addEventListener('visibilitychange', mcSndOnVisibility, false);
    mcSndVisAttached = true;
  } catch (e) {}
}

/** 新 BGM 是单个采样源、没有轮询调度器；保留此函数作为暂停钩子（无定时器可清）。 */
function mcSndPauseSchedulers() {}

/**
 * 创建 AudioContext 并建好音频图 + 可见性监听（幂等）。
 * 只建 suspended 上下文，不 resume、不发声；preload 与 unlock 共用。
 * @returns {AudioContext|null}
 */
function mcSndEnsureCtx() {
  try {
    if (mcSndCtx) return mcSndCtx;
    if (!mcAudioSupported()) return null;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    mcSndCtx = new Ctor();
    mcSndBuildGraph();
    mcSndAttachVisibility();
    if (typeof document !== 'undefined' && document.hidden) {
      mcSndHidden = true;
    }
    return mcSndCtx;
  } catch (e) {
    mcSndCtx = null;
    return null;
  }
}

/**
 * 解锁音频（必须在真实用户手势里调用）：只负责创建/恢复上下文，可重复调用（幂等）。
 * preload 已经建好上下文时，这里只做 resume。
 * @returns {boolean} 成功（上下文已存在且未关闭）返回 true。
 */
function mcSndUnlock() {
  try {
    const ctx = mcSndEnsureCtx();
    if (!ctx) return false;
    mcSndUnlocked = true;
    if (ctx.state !== 'running') {
      mcSndResumeGuardUntil = Date.now() + 250;
      mcSndTryResume();
    }
    mcSndResumeGuardUntil = Date.now() + 250;
    return ctx.state !== 'closed';
  } catch (e) {
    return false;
  }
}

/**
 * 拉取并解码一个采样：fetch 宿主路由 → arrayBuffer → decodeAudioData。
 * 任一环节失败只把 mcSamples[name] 置 null、状态记为 'failed'，从不抛错（返回 false）。
 * 这里不 warn：提示统一放在"该音效回退合成音"的那一次（见 mcSndNoteMissing），
 * 保证开源仓库里缺 5 个素材时，每个音效只刷一条控制台。
 * @returns {Promise<boolean>}
 */
function mcSndLoadSample(ctx, name) {
  mcSndSampleStates[name] = 'loading';
  return Promise.resolve()
    .then(function () {
      if (typeof fetch !== 'function') throw new Error('fetch 不可用');
      return fetch(MC_SAMPLE_BASE + '/' + name + '.mp3');
    })
    .then(function (res) {
      if (!res || !res.ok) throw new Error('HTTP ' + (res && res.status));
      return res.arrayBuffer();
    })
    .then(function (ab) {
      return new Promise(function (resolve, reject) {
        if (typeof ctx.decodeAudioData !== 'function') {
          reject(new Error('decodeAudioData 不可用'));
          return;
        }
        const ret = ctx.decodeAudioData(ab, resolve, reject);
        if (ret && typeof ret.then === 'function') ret.then(resolve, reject);
      });
    })
    .then(function (buf) {
      if (!buf || !(buf.duration > 0)) throw new Error('解码结果为空');
      mcSamples[name] = buf;
      mcSndSampleStates[name] = 'ok';
      return true;
    })
    .catch(function () {
      mcSamples[name] = null;
      mcSndSampleStates[name] = 'failed';
      return false;
    });
}

/**
 * 预加载 5 个 Minecraft 采样（可在无用户手势时调用）：
 * 允许创建一个 suspended 的 AudioContext 并完成解码，但绝不 resume、不发声。
 * 幂等：并发/重复调用共享同一个 Promise；加载失败不 reject。
 * @returns {Promise<void>}
 */
function mcSndPreload() {
  try {
    if (mcSndPreloadPromise) return mcSndPreloadPromise;
    mcSndPreloadPromise = new Promise(function (resolve) {
      const ctx = mcSndEnsureCtx();
      if (!ctx) {
        resolve();
        return;
      }
      const jobs = [];
      for (let i = 0; i < MC_SND_SAMPLE_NAMES.length; i++) {
        const name = MC_SND_SAMPLE_NAMES[i];
        if (mcSamples[name]) jobs.push(Promise.resolve(true));
        else jobs.push(mcSndLoadSample(ctx, name));
      }
      Promise.all(jobs).then(function () { resolve(); }, function () { resolve(); });
    });
    return mcSndPreloadPromise;
  } catch (e) {
    mcSndPreloadPromise = Promise.resolve();
    return mcSndPreloadPromise;
  }
}

/** 音频是否可用（AudioContext 处于 running）。 */
function mcSndIsReady() {
  try {
    return !!(mcSndCtx && mcSndCtx.state === 'running');
  } catch (e) {
    return false;
  }
}

/** 挂起整个音频上下文（BGM 采样源随上下文冻结，恢复后从原位继续）。 */
function mcSndSuspend() {
  try {
    mcSndPauseSchedulers();
    if (mcSndCtx && typeof mcSndCtx.suspend === 'function' && mcSndCtx.state === 'running') {
      const p = mcSndCtx.suspend();
      if (p && typeof p.then === 'function') p.then(null, function () {});
    }
    return true;
  } catch (e) {
    return false;
  }
}

/** 恢复音频上下文；若 BGM 本应播放（例如页面隐藏期间被挂起）则继续当前曲目。 */
function mcSndResume() {
  try {
    if (!mcSndCtx) return false;
    if (mcSndCtx.state !== 'running') mcSndTryResume();
    if (mcSndBgmPlaying && !mcSndBgmSource) {
      mcSndPlayBgmTrack(mcSndBgmCurrentId);
    }
    return true;
  } catch (e) {
    return false;
  }
}

/* ---------------------------------------------------------------------------
 * 4. 通用发声原语：单音（含 pad 长音）与噪声 burst
 * -------------------------------------------------------------------------*/

/**
 * 一个振荡器音符。
 * opt: { type, freq, freqEnd, time, dur, gain, attack, pad,
 *        filterType, filterFreq, filterFreqEnd, q, detune, bus, reverb, voice }
 * @returns {object|null} 声部
 */
function mcSndTone(opt) {
  try {
    if (!mcSndCtx) return null;
    const o = opt || {};
    const ctx = mcSndCtx;
    const now = mcSndNow();
    const t0 = typeof o.time === 'number' ? o.time : now + (o.delay || 0);
    if (t0 < now - 0.5) return null;
    const dur = Math.max(0.03, typeof o.dur === 'number' ? o.dur : 0.2);
    const peak = Math.max(0.0002, typeof o.gain === 'number' ? o.gain : 0.1);
    const voice = o.voice || mcSndMakeVoice();

    const osc = ctx.createOscillator();
    voice.nodes.push(osc);
    osc.type = o.type || 'sine';
    const freq = Math.max(20, typeof o.freq === 'number' ? o.freq : 440);
    try { osc.frequency.setValueAtTime(freq, t0); } catch (e) {}
    if (typeof o.freqEnd === 'number') {
      try {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t0 + dur * 0.92);
      } catch (e) {}
    }
    if (typeof o.detune === 'number') {
      try { osc.detune.setValueAtTime(o.detune, t0); } catch (e) {}
    }

    const gainNode = ctx.createGain();
    voice.nodes.push(gainNode);
    const atk = Math.max(0.001, Math.min(typeof o.attack === 'number' ? o.attack : 0.006, dur * 0.6));
    try {
      const g = gainNode.gain;
      if (o.pad) {
        const rel = Math.min(dur * 0.35, 2.2);
        g.setValueAtTime(0.0001, t0);
        g.linearRampToValueAtTime(peak, t0 + atk);
        g.setValueAtTime(peak, t0 + Math.max(atk + 0.01, dur - rel));
        g.exponentialRampToValueAtTime(0.0001, t0 + dur);
      } else {
        g.setValueAtTime(0.0001, t0);
        g.linearRampToValueAtTime(peak, t0 + atk);
        g.exponentialRampToValueAtTime(0.0001, t0 + dur);
      }
    } catch (e) {}

    let tail = osc;
    if (o.filterType) {
      const bq = ctx.createBiquadFilter();
      voice.nodes.push(bq);
      bq.type = o.filterType;
      try {
        bq.frequency.setValueAtTime(
          Math.max(40, typeof o.filterFreq === 'number' ? o.filterFreq : 1800), t0);
        if (typeof o.filterFreqEnd === 'number') {
          bq.frequency.exponentialRampToValueAtTime(Math.max(40, o.filterFreqEnd), t0 + dur);
        }
        bq.Q.setValueAtTime(typeof o.q === 'number' ? o.q : 1, t0);
      } catch (e) {}
      try { tail.connect(bq); } catch (e) {}
      tail = bq;
    }
    try { tail.connect(gainNode); } catch (e) {}

    const bus = mcSndBusFor(o.bus);
    if (bus) {
      try { gainNode.connect(bus); } catch (e) {}
    }
    if (o.reverb && mcSndReverbIn) {
      const send = ctx.createGain();
      voice.nodes.push(send);
      try {
        send.gain.setValueAtTime(Math.min(1, Math.max(0, o.reverb)), t0);
        gainNode.connect(send);
        send.connect(mcSndReverbIn);
      } catch (e) {}
    }

    try {
      osc.start(t0);
      voice.sources.push(osc);
      osc.stop(t0 + dur + 0.05);
    } catch (e) {}
    voice.expire((t0 - mcSndNow() + dur + 0.2) * 1000);
    return voice;
  } catch (e) {
    return null;
  }
}

/**
 * 一段滤波噪声 burst（Minecraft 短音效的主力：木头 / 石头 / 沙沙声 / whoosh）。
 * opt: { time, dur, gain, filterType, filterFreq, filterFreqEnd, q, rate, bus, reverb, voice }
 */
function mcSndNoise(opt) {
  try {
    if (!mcSndCtx) return null;
    const buf = mcSndGetNoiseBuffer();
    if (!buf) return null;
    const o = opt || {};
    const ctx = mcSndCtx;
    const now = mcSndNow();
    const t0 = typeof o.time === 'number' ? o.time : now + (o.delay || 0);
    if (t0 < now - 0.5) return null;
    // 下限放宽到 4ms：允许木头敲击那种"极短瞬态"（< 8ms）的 burst。
    // 其它调用方传入的都是 >=30ms，行为完全不变。
    const dur = Math.max(0.004, typeof o.dur === 'number' ? o.dur : 0.05);
    const peak = Math.max(0.0002, typeof o.gain === 'number' ? o.gain : 0.1);
    const voice = o.voice || mcSndMakeVoice();

    const src = ctx.createBufferSource();
    voice.nodes.push(src);
    src.buffer = buf;
    try { src.loop = true; } catch (e) {}
    if (typeof o.rate === 'number') {
      try { src.playbackRate.setValueAtTime(o.rate, t0); } catch (e) {}
    }

    const bq = ctx.createBiquadFilter();
    voice.nodes.push(bq);
    bq.type = o.filterType || 'bandpass';
    try {
      bq.frequency.setValueAtTime(
        Math.max(40, typeof o.filterFreq === 'number' ? o.filterFreq : 1200), t0);
      if (typeof o.filterFreqEnd === 'number') {
        bq.frequency.exponentialRampToValueAtTime(Math.max(40, o.filterFreqEnd), t0 + dur);
      }
      bq.Q.setValueAtTime(typeof o.q === 'number' ? o.q : 1, t0);
    } catch (e) {}

    const gainNode = ctx.createGain();
    voice.nodes.push(gainNode);
    try {
      const g = gainNode.gain;
      g.setValueAtTime(0.0001, t0);
      g.linearRampToValueAtTime(peak, t0 + 0.002);
      g.exponentialRampToValueAtTime(0.0001, t0 + dur);
    } catch (e) {}

    try { src.connect(bq); bq.connect(gainNode); } catch (e) {}
    const bus = mcSndBusFor(o.bus);
    if (bus) {
      try { gainNode.connect(bus); } catch (e) {}
    }
    if (o.reverb && mcSndReverbIn) {
      const send = ctx.createGain();
      voice.nodes.push(send);
      try {
        send.gain.setValueAtTime(Math.min(1, Math.max(0, o.reverb)), t0);
        gainNode.connect(send);
        send.connect(mcSndReverbIn);
      } catch (e) {}
    }

    try {
      src.start(t0, Math.random() * 1.5);
      voice.sources.push(src);
      src.stop(t0 + dur + 0.03);
    } catch (e) {}
    voice.expire((t0 - mcSndNow() + dur + 0.2) * 1000);
    return voice;
  } catch (e) {
    return null;
  }
}

/**
 * 木琴 / 铃铛音色：基音 + 两个弱泛音，快速指数衰减（C418 味的"叮"）。
 * 三个振荡器共用一个声部，回收更省。
 */
function mcSndBell(freq, t0, dur, gain, bus, reverb, voice) {
  const v = voice || mcSndMakeVoice();
  mcSndTone({
    type: 'sine', freq: freq, time: t0, dur: dur, gain: gain,
    attack: 0.005, bus: bus, reverb: reverb, voice: v
  });
  mcSndTone({
    type: 'sine', freq: freq * 2, time: t0, dur: dur * 0.55, gain: gain * 0.22,
    attack: 0.003, bus: bus, reverb: reverb ? reverb * 0.5 : 0, voice: v
  });
  mcSndTone({
    type: 'sine', freq: freq * 2.997, time: t0, dur: dur * 0.32, gain: gain * 0.08,
    attack: 0.002, bus: bus, reverb: reverb ? reverb * 0.3 : 0, voice: v
  });
  return v;
}

/* ---- 采样播放（Minecraft 原版音频素材，宿主同源路由提供） ---- */

/** 按名字取已解码的采样缓冲；没有（未加载 / 加载失败）返回 null。 */
function mcSndGetSample(name) {
  try {
    const buf = mcSamples && mcSamples[name];
    return buf || null;
  } catch (e) {
    return null;
  }
}

/**
 * 播放一个已解码的音频采样：BufferSource -> [lowpass] -> 包络增益 -> 总线。
 * opt: { time, gain, rate, bus, lowpass, lowpassQ, fadeOut, truncate }
 *  - truncate：只取采样前 N 秒，到点前 fadeOut 淡出（烟花这种长素材用）。
 *  - 采样未就绪 / 无上下文 => 返回 null，由调用方决定"静默跳过"还是"回退合成"。
 * @returns {object|null} 声部（到时自动 stop + disconnect）
 */
function mcSndPlaySample(name, opt) {
  try {
    if (!mcSndCtx) return null;
    const buf = mcSndGetSample(name);
    if (!buf) return null;
    const o = opt || {};
    const ctx = mcSndCtx;
    const t0 = typeof o.time === 'number' ? o.time : mcSndNow() + 0.003;
    const rate = Math.max(0.5, Math.min(2, typeof o.rate === 'number' ? o.rate : 1));
    const peak = Math.max(0.0002, typeof o.gain === 'number' ? o.gain : 0.8);
    const bufDur = typeof buf.duration === 'number' && buf.duration > 0 ? buf.duration : 1;
    const truncate = typeof o.truncate === 'number' && o.truncate > 0 ? o.truncate : 0;
    const playDur = Math.max(0.03, Math.min(bufDur / rate, truncate > 0 ? truncate : Infinity));
    const fadeOut = Math.max(0.01, typeof o.fadeOut === 'number' ? o.fadeOut : 0.02);
    const voice = mcSndMakeVoice();

    const src = ctx.createBufferSource();
    voice.nodes.push(src);
    try { src.buffer = buf; } catch (e) {}
    try { src.playbackRate.setValueAtTime(rate, t0); } catch (e) {}

    const gainNode = ctx.createGain();
    voice.nodes.push(gainNode);
    try {
      const g = gainNode.gain;
      g.setValueAtTime(0.0001, t0);
      g.linearRampToValueAtTime(peak, t0 + 0.002);
      g.setValueAtTime(peak, t0 + Math.max(0.004, playDur - fadeOut));
      g.linearRampToValueAtTime(0.0001, t0 + playDur);
    } catch (e) {}

    let tail = src;
    if (typeof o.lowpass === 'number') {
      const bq = ctx.createBiquadFilter();
      voice.nodes.push(bq);
      try {
        bq.type = 'lowpass';
        bq.frequency.setValueAtTime(Math.max(80, o.lowpass), t0);
        bq.Q.setValueAtTime(typeof o.lowpassQ === 'number' ? o.lowpassQ : 0.8, t0);
      } catch (e) {}
      try { src.connect(bq); } catch (e) {}
      tail = bq;
    }
    try { tail.connect(gainNode); } catch (e) {}
    const bus = mcSndBusFor(o.bus || 'sfx');
    if (bus) {
      try { gainNode.connect(bus); } catch (e) {}
    }
    try {
      src.start(t0, 0);
      voice.sources.push(src);
      src.stop(t0 + playDur + 0.05);
    } catch (e) {}
    voice.expire((t0 - mcSndNow() + playDur + 0.25) * 1000);
    return voice;
  } catch (e) {
    return null;
  }
}

/* ---------------------------------------------------------------------------
 * 5. 短音效（Minecraft 原版采样；仓库不带素材时全部回退合成音，绝不静默变哑）
 * -------------------------------------------------------------------------*/

/* ---- 采样缺失时的统一提示 / 补加载 ---- */

/**
 * 某个音效的采样缺失（404 / 解码失败）时打一条 warn，说明已用合成音替代。
 * 每个音效最多一条：连点 / 反复开关不会刷屏。
 */
function mcSndWarnMissing(effect, sampleName) {
  try {
    if (mcSndMissingWarned[effect]) return;
    mcSndMissingWarned[effect] = true;
    console.warn(
      '[minecraft-ui][audio] 采样缺失（' + sampleName + '.mp3），已改用合成音：' + effect);
  } catch (e) {}
}

/**
 * 采样没播出来时的统一处理：
 *  - 已确定为 'failed'（404 / 解码失败）=> 打一条 warn，调用方随即走合成兜底；
 *  - 还在 'loading' 或尚未开始 => 静默补一次 preload()，避免启动阶段误报。
 */
function mcSndNoteMissing(effect, sampleName) {
  try {
    if (mcSndSampleStates[sampleName] === 'failed') mcSndWarnMissing(effect, sampleName);
    else mcSndPreload();
  } catch (e) {}
}

/* ---- 点击：用户指定的 Minecraft 石切机"选择配方"采样 ---- */

/**
 * 按钮点击 / 选择：播放 `ui-stonecutter-select_recipe-1`（Minecraft UI 的短促"嗒"）。
 * playbackRate 1.0 ± 0.02 抖动避免机械重复；采样缺失 / 还没解码好时回退合成木质轻叩。
 */
function mcSndClick() {
  try {
    if (!mcSndCanPlay()) return;
    const rate = 1 + (Math.random() * 2 - 1) * 0.02;
    const gain = 0.75 + Math.random() * 0.1;
    if (mcSndPlaySample('ui-stonecutter-select_recipe-1', { gain: gain, rate: rate })) return;
    mcSndNoteMissing('click', 'ui-stonecutter-select_recipe-1');
    mcSndClickSynth(gain);
  } catch (e) {}
}

/**
 * click 的合成兜底：短噪声瞬态（木头的"哒"）+ 低沉 triangle 体 + 一点高位泛音，
 * 整体 60~90ms，听感像 Minecraft 的木头按钮，干爽不拖尾。
 */
function mcSndClickSynth(gain) {
  try {
    if (!mcSndCanPlay()) return;
    const t0 = mcSndNow() + 0.003;
    const peak = Math.min(1, Math.max(0.1, typeof gain === 'number' ? gain : 0.8)) * 0.5;
    const v = mcSndMakeVoice();
    mcSndNoise({
      time: t0, dur: 0.028, gain: peak * 0.55, filterType: 'bandpass',
      filterFreq: 2600, filterFreqEnd: 1400, q: 1.1, bus: 'sfx', voice: v
    });
    mcSndTone({
      type: 'triangle', freq: 196, freqEnd: 150, time: t0, dur: 0.072,
      gain: peak * 0.42, attack: 0.002,
      filterType: 'lowpass', filterFreq: 1200, q: 0.7, bus: 'sfx', voice: v
    });
    mcSndTone({
      type: 'triangle', freq: 392, time: t0, dur: 0.018, gain: peak * 0.12,
      attack: 0.001, bus: 'sfx', voice: v
    });
  } catch (e) {}
}

/** hover：一下几乎不可察的 4ms 极短 tick（实测峰值约为 click 的 1/4），无音调；45ms 限流。 */
function mcSndHover() {
  try {
    if (!mcSndCanPlay()) return;
    const nowMs = Date.now();
    if (nowMs - mcSndLastHoverAt < 45) return;
    mcSndLastHoverAt = nowMs;
    mcSndNoise({
      time: mcSndNow() + 0.004, dur: 0.004, gain: 0.18, filterType: 'bandpass',
      filterFreq: 2400, filterFreqEnd: 2000, q: 1, bus: 'sfx'
    });
  } catch (e) {}
}

/**
 * 开关：开 = 箱子打开采样（rate 1.0），关 = 箱子关闭采样（rate 0.98），音量略低于 click。
 * toggle() 不带参数，所以内部用一个布尔量自动交替：连续调用就是"开 → 关 → 开 …"。
 * 采样缺失时开 / 关分别复用 open / close 的合成兜底（同一个 'toggle' 提示，最多一条）。
 */
function mcSndToggle() {
  try {
    if (!mcSndCanPlay()) return;
    mcSndToggleOn = !mcSndToggleOn;
    const sample = mcSndToggleOn ? 'block-chest-open-1' : 'block-chest-close-1';
    const played = mcSndToggleOn
      ? mcSndPlaySample(sample, { gain: 0.62, rate: 1.0 })
      : mcSndPlaySample(sample, { gain: 0.6, rate: 0.98 });
    if (played) return;
    mcSndNoteMissing('toggle', sample);
    if (mcSndToggleOn) mcSndOpenSynth();
    else mcSndCloseSynth();
  } catch (e) {}
}

/** 成就 / 完成：烟花发射采样（只取前 0.9s 后淡出）；采样缺失时回退合成上行琶音。 */
function mcSndSuccess() {
  try {
    if (!mcSndCanPlay()) return;
    if (mcSndPlaySample('entity-firework_rocket-launch-1', {
      gain: 0.7, rate: 1.0, truncate: 0.9, fadeOut: 0.18
    })) return;
    mcSndNoteMissing('success', 'entity-firework_rocket-launch-1');
    mcSndSuccessSynth();
  } catch (e) {}
}

/** success 的合成兜底：三个音的上行琶音（C5 E5 G5），约 300ms。 */
function mcSndSuccessSynth() {
  try {
    if (!mcSndCanPlay()) return;
    const t0 = mcSndNow() + 0.005;
    const seq = [523.25, 659.25, 783.99];
    const v = mcSndMakeVoice();
    for (let i = 0; i < seq.length; i++) {
      mcSndBell(seq[i], t0 + i * 0.09, 0.16, 0.12, 'sfx', 0.28, v);
    }
  } catch (e) {}
}

/**
 * 失败 / 错误：木门打开采样降速到 0.86 并压暗（lowpass 1100Hz），
 * 听感像"门卡住 / 关不上"，比原版短促下行更贴 Minecraft；采样缺失时回退合成低沉短低音。
 */
function mcSndError() {
  try {
    if (!mcSndCanPlay()) return;
    if (mcSndPlaySample('block-wooden_door-open-1', { gain: 0.62, rate: 0.86, lowpass: 1100 })) return;
    mcSndNoteMissing('error', 'block-wooden_door-open-1');
    mcSndErrorSynth();
  } catch (e) {}
}

/** error 的合成兜底：约 200ms 的低沉短低音（triangle 下滑 + 低通压暗 + 一点低频噪声）。 */
function mcSndErrorSynth() {
  try {
    if (!mcSndCanPlay()) return;
    const t0 = mcSndNow() + 0.004;
    const v = mcSndMakeVoice();
    mcSndTone({
      type: 'triangle', freq: 130.81, freqEnd: 98, time: t0, dur: 0.2, gain: 0.2,
      attack: 0.004, filterType: 'lowpass', filterFreq: 520, q: 0.7,
      bus: 'sfx', reverb: 0.1, voice: v
    });
    mcSndTone({
      type: 'sine', freq: 65.41, time: t0, dur: 0.18, gain: 0.12, attack: 0.004,
      bus: 'sfx', voice: v
    });
    mcSndNoise({
      time: t0, dur: 0.05, gain: 0.04, filterType: 'lowpass', filterFreq: 400, q: 0.6,
      bus: 'sfx', voice: v
    });
  } catch (e) {}
}

/** 弹窗打开：箱子打开采样；采样缺失时回退合成的"咔哒 + 轻提升"。 */
function mcSndOpen() {
  try {
    if (!mcSndCanPlay()) return;
    if (mcSndPlaySample('block-chest-open-1', { gain: 0.8, rate: 1.0 })) return;
    mcSndNoteMissing('open', 'block-chest-open-1');
    mcSndOpenSynth();
  } catch (e) {}
}

/** open 的合成兜底：短"咔哒"瞬态 + 两个上行音，约 120ms 的柔和提升感。 */
function mcSndOpenSynth() {
  try {
    if (!mcSndCanPlay()) return;
    const t0 = mcSndNow() + 0.003;
    const v = mcSndMakeVoice();
    mcSndNoise({
      time: t0, dur: 0.022, gain: 0.13, filterType: 'bandpass',
      filterFreq: 2200, filterFreqEnd: 1100, q: 1.0, bus: 'sfx', voice: v
    });
    mcSndTone({
      type: 'sine', freq: 392, time: t0 + 0.006, dur: 0.075, gain: 0.075,
      attack: 0.006, bus: 'sfx', reverb: 0.12, voice: v
    });
    mcSndTone({
      type: 'sine', freq: 587.33, time: t0 + 0.058, dur: 0.065, gain: 0.055,
      attack: 0.006, bus: 'sfx', reverb: 0.12, voice: v
    });
  } catch (e) {}
}

/** 弹窗关闭：箱子关闭采样；采样缺失时回退合成的"咔哒 + 收尾"。 */
function mcSndClose() {
  try {
    if (!mcSndCanPlay()) return;
    if (mcSndPlaySample('block-chest-close-1', { gain: 0.78, rate: 1.0 })) return;
    mcSndNoteMissing('close', 'block-chest-close-1');
    mcSndCloseSynth();
  } catch (e) {}
}

/** close 的合成兜底：短"咔哒"瞬态 + 两个下行音，约 120ms 的收起感。 */
function mcSndCloseSynth() {
  try {
    if (!mcSndCanPlay()) return;
    const t0 = mcSndNow() + 0.003;
    const v = mcSndMakeVoice();
    mcSndNoise({
      time: t0, dur: 0.024, gain: 0.12, filterType: 'bandpass',
      filterFreq: 2400, filterFreqEnd: 900, q: 1.0, bus: 'sfx', voice: v
    });
    mcSndTone({
      type: 'sine', freq: 523.25, time: t0 + 0.004, dur: 0.07, gain: 0.065,
      attack: 0.005, bus: 'sfx', reverb: 0.1, voice: v
    });
    mcSndTone({
      type: 'sine', freq: 349.23, time: t0 + 0.052, dur: 0.075, gain: 0.06,
      attack: 0.006, bus: 'sfx', reverb: 0.1, voice: v
    });
  } catch (e) {}
}

/** 升级：烟花发射采样（rate 1.06 更亮、只取前 0.9s 后淡出）；采样缺失时回退合成琶音。 */
function mcSndLevelUp() {
  try {
    if (!mcSndCanPlay()) return;
    if (mcSndPlaySample('entity-firework_rocket-launch-1', {
      gain: 0.75, rate: 1.06, truncate: 0.9, fadeOut: 0.18
    })) return;
    mcSndNoteMissing('levelUp', 'entity-firework_rocket-launch-1');
    mcSndLevelUpSynth();
  } catch (e) {}
}

/** levelUp 的合成兜底：比 success 更亮的三个音上行琶音（C5 G5 C6），约 300ms。 */
function mcSndLevelUpSynth() {
  try {
    if (!mcSndCanPlay()) return;
    const t0 = mcSndNow() + 0.005;
    const seq = [523.25, 783.99, 1046.5];
    const v = mcSndMakeVoice();
    for (let i = 0; i < seq.length; i++) {
      mcSndBell(seq[i], t0 + i * 0.09, 0.17, 0.115, 'sfx', 0.32, v);
    }
  } catch (e) {}
}

/* ---------------------------------------------------------------------------
 * 6. BGM（宿主目录曲目 + setUserTracks 用户曲目合并列表：
 *    懒加载清单 / 惰性解码 LRU(3) / 播完自动接下一首 / 约 1s 交叉淡入淡出）
 * -------------------------------------------------------------------------*/

/** 去掉扩展名与尾部 [xxx] 片段，作为清单里缺少 name 时的兜底显示名。 */
function mcSndBgmFallbackName(file) {
  try {
    return String(file)
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/\s*\[[^\]]*\]\s*/g, ' ')
      .trim();
  } catch (e) {
    return String(file);
  }
}

/**
 * 懒加载 BGM 宿主曲目清单：GET /api/minecraft-ui/music -> { ok, tracks: [{file,name,size}] }。
 * 幂等：并发 / 重复调用共享同一个 Promise；失败只 warn 并返回 []，永不 reject。
 * 返回值与 getBgmTracks() 对齐：宿主曲目 + 已注入的用户曲目合并列表。
 * @returns {Promise<Array<{id:string,name:string,size:number,source:string}>>}
 */
function mcSndLoadBgmTracks() {
  try {
    if (mcSndBgmTracksPromise) {
      // 已加载完成：每次返回"当前合并列表"的新快照，后注入的用户曲目也能立刻出现在返回里。
      if (mcSndBgmTracks !== null) return Promise.resolve(mcSndBgmAllTracks());
      return mcSndBgmTracksPromise;   // 仍在加载：并发调用共享同一个 Promise
    }
    mcSndBgmTracksPromise = Promise.resolve()
      .then(function () {
        if (typeof fetch !== 'function') throw new Error('fetch 不可用');
        return fetch(MC_MUSIC_BASE);
      })
      .then(function (res) {
        if (!res || !res.ok) throw new Error('HTTP ' + (res && res.status));
        return res.json();
      })
      .then(function (data) {
        const raw = data && Array.isArray(data.tracks) ? data.tracks : [];
        const list = [];
        for (let i = 0; i < raw.length; i++) {
          const item = raw[i] || {};
          if (typeof item.file !== 'string' || !item.file) continue;
          list.push({
            id: item.file,
            name: typeof item.name === 'string' && item.name ? item.name : mcSndBgmFallbackName(item.file),
            size: typeof item.size === 'number' ? item.size : 0
          });
        }
        list.sort(function (a, b) { return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0); });
        mcSndBgmTracks = list;
        return mcSndBgmAllTracks();
      })
      .catch(function (err) {
        mcSndBgmTracks = [];
        try {
          console.warn('[minecraft-ui][audio] BGM 清单加载失败', err);
        } catch (e) {}
        return mcSndBgmAllTracks();
      });
    return mcSndBgmTracksPromise;
  } catch (e) {
    mcSndBgmTracks = [];
    mcSndBgmTracksPromise = Promise.resolve(mcSndBgmAllTracks());
    return mcSndBgmTracksPromise;
  }
}

/** 在用户曲目表里按 id 找一条（找不到返回 null）。 */
function mcSndFindUserTrack(id) {
  try {
    for (let i = 0; i < mcSndUserTracks.length; i++) {
      if (mcSndUserTracks[i].id === id) return mcSndUserTracks[i];
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * 覆盖式写入用户曲目表（宿主从 IndexedDB 读出后调用，unlock 前后都可安全调用）。
 * list: [{ id, name, blob }]，blob 是原始音频 Blob；非法条目直接跳过。
 * 被删除 / 被替换（即使 id 相同、blob 变了）的曲目会同时丢掉解码缓存与在途 Promise。
 * @returns {boolean} 是否接受了新表
 */
function mcSndSetUserTracks(list) {
  try {
    const source = Array.isArray(list) ? list : [];
    const next = [];
    const keep = {};
    for (let i = 0; i < source.length; i++) {
      const item = source[i] || {};
      const id = typeof item.id === 'string' ? item.id : '';
      if (!id || keep[id]) continue;
      const blob = item.blob || null;
      if (!blob || typeof blob.arrayBuffer !== 'function') continue;
      keep[id] = blob;
      next.push({
        id: id,
        name: typeof item.name === 'string' && item.name ? item.name : id,
        size: typeof blob.size === 'number' && blob.size > 0 ? blob.size : 0,
        blob: blob
      });
    }
    const prev = mcSndUserTracks;
    for (let i = 0; i < prev.length; i++) {
      if (!keep[prev[i].id] || keep[prev[i].id] !== prev[i].blob) mcSndDropBgmCache(prev[i].id);
    }
    mcSndUserTracks = next;
    return true;
  } catch (e) {
    return false;
  }
}

/** 移除一首用户曲目并丢掉解码缓存（可选 API，供宿主删除单曲时调用）。 */
function mcSndDropUserTrack(id) {
  try {
    if (typeof id !== 'string' || !id) return false;
    const kept = [];
    let removed = false;
    for (let i = 0; i < mcSndUserTracks.length; i++) {
      if (mcSndUserTracks[i].id === id) removed = true;
      else kept.push(mcSndUserTracks[i]);
    }
    mcSndUserTracks = kept;
    mcSndDropBgmCache(id);
    return removed;
  } catch (e) {
    return false;
  }
}

/**
 * 合并后的播放列表：宿主目录曲目（source: 'file'）在前，用户曲目（source: 'user'）在后。
 * 每次返回新数组 / 新对象，调用方改不坏引擎内部状态；宿主清单未加载时只有用户曲目。
 * @returns {Array<{id:string,name:string,size:number,source:string}>}
 */
function mcSndBgmAllTracks() {
  const out = [];
  try {
    const host = mcSndBgmTracks || [];
    for (let i = 0; i < host.length; i++) {
      out.push({
        id: host[i].id,
        name: host[i].name,
        size: typeof host[i].size === 'number' ? host[i].size : 0,
        source: 'file'
      });
    }
    for (let i = 0; i < mcSndUserTracks.length; i++) {
      const t = mcSndUserTracks[i];
      out.push({ id: t.id, name: t.name, size: t.size, source: 'user' });
    }
  } catch (e) {}
  return out;
}

/** 同步返回合并后的曲目列表 [{id,name,size,source}]（宿主清单未加载时只有用户曲目）。 */
function mcSndGetBgmTracks() {
  return mcSndBgmAllTracks();
}

/** 合并列表里的下一首 id（循环；id 不在表里时回到第一首）。 */
function mcSndBgmNextId(id) {
  try {
    const list = mcSndBgmAllTracks();
    if (!list.length) return null;
    if (!id) return list[0].id;
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[(i + 1) % list.length].id;
    }
    return list[0].id;
  } catch (e) {
    return null;
  }
}

/** 从已解码缓存里取曲目。 */
function mcSndBgmCacheFind(id) {
  for (let i = 0; i < mcSndBgmCache.length; i++) {
    if (mcSndBgmCache[i].id === id) return mcSndBgmCache[i].buffer;
  }
  return null;
}

/** 写入解码缓存（LRU：最多 MC_SND_BGM_CACHE_MAX 首）。 */
function mcSndBgmCachePush(id, buffer) {
  try {
    const kept = [];
    for (let i = 0; i < mcSndBgmCache.length; i++) {
      if (mcSndBgmCache[i].id !== id) kept.push(mcSndBgmCache[i]);
    }
    kept.push({ id: id, buffer: buffer });
    while (kept.length > MC_SND_BGM_CACHE_MAX) kept.shift();
    mcSndBgmCache = kept;
  } catch (e) {}
}

/** 丢掉一首曲目的解码结果、在途 Promise 与"已 warn"标记（删除 / 替换用户曲目时用）。 */
function mcSndDropBgmCache(id) {
  try {
    if (typeof id !== 'string' || !id) return;
    const kept = [];
    for (let i = 0; i < mcSndBgmCache.length; i++) {
      if (mcSndBgmCache[i].id !== id) kept.push(mcSndBgmCache[i]);
    }
    mcSndBgmCache = kept;
    delete mcSndBgmBufferPromises[id];
    delete mcSndBgmWarned[id];
  } catch (e) {}
}

/** 同一首曲目加载失败只 warn 一次（避免循环取下一首时刷屏）。 */
function mcSndWarnBgmFailure(id) {
  try {
    if (mcSndBgmWarned[id]) return;
    mcSndBgmWarned[id] = true;
    console.warn('[minecraft-ui][audio] BGM 加载失败（已跳过，稍后可重试）: ' + id);
  } catch (e) {}
}

/** 宿主目录曲目：GET /api/minecraft-ui/music/<encodeURIComponent(id)> -> ArrayBuffer。 */
function mcSndFetchHostTrackArrayBuffer(id) {
  return Promise.resolve()
    .then(function () {
      if (typeof fetch !== 'function') throw new Error('fetch 不可用');
      return fetch(MC_MUSIC_BASE + '/' + encodeURIComponent(id));
    })
    .then(function (res) {
      if (!res || !res.ok) throw new Error('HTTP ' + (res && res.status));
      return res.arrayBuffer();
    });
}

/** 用户曲目：直接读 Blob（宿主已把文件放进 IndexedDB，不走宿主路由）。 */
function mcSndReadUserTrackArrayBuffer(track) {
  return Promise.resolve()
    .then(function () {
      if (!track || !track.blob || typeof track.blob.arrayBuffer !== 'function') {
        throw new Error('用户曲目缺少 blob');
      }
      return track.blob.arrayBuffer();
    })
    .then(function (ab) {
      if (!ab) throw new Error('用户曲目读取结果为空');
      return ab;
    });
}

/**
 * 懒解码一首曲目（宿主曲目走 fetch，用户曲目走 blob.arrayBuffer）-> decodeAudioData。
 * 命中缓存直接返回；并发同一首共享同一个 Promise；失败只 warn 一次并返回 null，
 * 绝不 reject —— playBgmTrack() 因此在解码失败时返回 false，但调用方不会拿到异常。
 * @returns {Promise<AudioBuffer|null>}
 */
function mcSndGetBgmBuffer(id) {
  try {
    if (!id) return Promise.resolve(null);
    const cached = mcSndBgmCacheFind(id);
    if (cached) return Promise.resolve(cached);
    if (mcSndBgmBufferPromises[id]) return mcSndBgmBufferPromises[id];
    const ctx = mcSndEnsureCtx();
    if (!ctx) return Promise.resolve(null);
    const user = mcSndFindUserTrack(id);
    const p = Promise.resolve()
      .then(function () {
        return user ? mcSndReadUserTrackArrayBuffer(user) : mcSndFetchHostTrackArrayBuffer(id);
      })
      .then(function (ab) {
        return new Promise(function (resolve, reject) {
          if (typeof ctx.decodeAudioData !== 'function') {
            reject(new Error('decodeAudioData 不可用'));
            return;
          }
          const ret = ctx.decodeAudioData(ab, resolve, reject);
          if (ret && typeof ret.then === 'function') ret.then(resolve, reject);
        });
      })
      .then(function (buf) {
        if (!buf || !(buf.duration > 0)) throw new Error('解码结果为空');
        // 用户曲目可能在解码期间被 setUserTracks 删除 / 替换：别把过期 buffer 写进缓存
        if (user) {
          const fresh = mcSndFindUserTrack(id);
          if (!fresh || fresh.blob !== user.blob) return buf;
        }
        mcSndBgmCachePush(id, buf);
        return buf;
      })
      .catch(function () {
        mcSndWarnBgmFailure(id);
        return null;
      });
    mcSndBgmBufferPromises[id] = p;
    p.then(function () {
      if (mcSndBgmBufferPromises[id] === p) delete mcSndBgmBufferPromises[id];
    }, function () {
      if (mcSndBgmBufferPromises[id] === p) delete mcSndBgmBufferPromises[id];
    });
    return p;
  } catch (e) {
    return Promise.resolve(null);
  }
}

/** 停止并断开一个 BGM source（幂等；被切歌 / 停止 / 自然播完都会走这里）。 */
function mcSndBgmStopSource(src, gain) {
  try { if (src && typeof src.stop === 'function') src.stop(0); } catch (e) {}
  try { if (src) src.disconnect(); } catch (e) {}
  try { if (gain) gain.disconnect(); } catch (e) {}
}

/**
 * 建一个正在播放的采样源：src -> gain -> BGM 总线，gain 从 0 线性淡入到 1。
 * onended 用于"单曲播完自动接下一首"；被切歌 / 停止时会给 source 换掉后忽略。
 */
function mcSndBgmMakeSource(buf, fadeIn, token) {
  const ctx = mcSndCtx;
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  src.buffer = buf;
  src.loop = false;
  src.connect(gain);
  gain.connect(mcSndBgmBus);
  const t = mcSndNow();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(1, t + Math.max(0.02, fadeIn));
  src.onended = function () {
    try {
      if (mcSndBgmSource !== src) return;    // 已被交叉淡出 / 切歌 / 停止取代
      if (!mcSndBgmPlaying) return;          // 手动停止
      if (mcSndBgmToken !== token) return;   // 已被新的播放请求取代
      mcSndBgmSource = null;
      mcSndBgmGain = null;
      mcSndBgmStopSource(src, gain);
      mcSndPlayBgmTrack(mcSndBgmNextId(mcSndBgmCurrentId));
    } catch (e) {}
  };
  src.start(t, 0);
  return { src: src, gain: gain };
}

/**
 * 播放指定曲目（不传 id 时用当前曲目；没有当前则第一首）。
 * 列表是"宿主目录 + 用户曲目"的合并列表；id 命中用户曲目时读 blob.arrayBuffer() 再解码。
 * 首次播放该曲目才解码；已在播时用 1s 交叉淡入淡出。
 * 未 unlock 时只记录意图、不建 source（静默返回 false）；
 * 解码 / 读取失败时 warn 一次并返回 false，不向调用方抛错（正在播的歌保持现状）。
 * @returns {Promise<boolean>}
 */
function mcSndPlayBgmTrack(id) {
  try {
    if (!mcSndUnlocked || !mcSndCtx) {
      if (typeof id === 'string' && id) mcSndBgmCurrentId = id;
      return Promise.resolve(false);
    }
    const token = ++mcSndBgmToken;
    return mcSndLoadBgmTracks().then(function () {
      const list = mcSndBgmAllTracks();
      if (!list.length) return false;
      let target = (typeof id === 'string' && id) ? id : mcSndBgmCurrentId;
      let found = false;
      for (let i = 0; i < list.length; i++) {
        if (list[i].id === target) { found = true; break; }
      }
      if (!found) target = list[0].id;
      mcSndBgmCurrentId = target;
      return mcSndGetBgmBuffer(target).then(function (buf) {
        if (token !== mcSndBgmToken) return false;
        if (!buf || !mcSndCtx || !mcSndBgmBus) return false;
        const oldSrc = mcSndBgmSource;
        const oldGain = mcSndBgmGain;
        const made = mcSndBgmMakeSource(buf, oldSrc ? 0.95 : 0.35, token);
        mcSndBgmSource = made.src;
        mcSndBgmGain = made.gain;
        mcSndBgmPlaying = true;
        // 旧曲目 1s 内淡出到 0，再停掉并断开
        if (oldSrc) {
          try {
            const t = mcSndNow();
            const g = oldGain.gain;
            const cur = typeof g.value === 'number' && isFinite(g.value) ? g.value : 1;
            g.cancelScheduledValues(t);
            g.setValueAtTime(Math.max(0.0001, cur), t);
            g.linearRampToValueAtTime(0.0001, t + 1.0);
          } catch (e) {}
          if (mcSndBgmFadeTimer !== null) {
            try { clearTimeout(mcSndBgmFadeTimer); } catch (e) {}
            mcSndBgmFadeTimer = null;
          }
          mcSndBgmFadeTimer = setTimeout(function () {
            mcSndBgmFadeTimer = null;
            mcSndBgmStopSource(oldSrc, oldGain);
          }, 1100);
        }
        mcSndSmoothParam(mcSndBgmBus ? mcSndBgmBus.gain : null, mcSndVolumes.bgm);
        return true;
      });
    });
  } catch (e) {
    return Promise.resolve(false);
  }
}

/** 切到合并列表的下一首（循环），带约 1s 交叉淡入淡出。 @returns {Promise<boolean>} */
function mcSndNextBgmTrack() {
  try {
    if (!mcSndUnlocked || !mcSndCtx) return Promise.resolve(false);
    return mcSndLoadBgmTracks().then(function () {
      const nextId = mcSndBgmNextId(mcSndBgmCurrentId);
      if (!nextId) return false;
      return mcSndPlayBgmTrack(nextId);
    });
  } catch (e) {
    return Promise.resolve(false);
  }
}

/** startBgm 保留原键名：语义 = 按当前 / 第一首开始播放。 */
function mcSndStartBgm() {
  try {
    return mcSndPlayBgmTrack(mcSndBgmCurrentId);
  } catch (e) {
    return Promise.resolve(false);
  }
}

/** 停止 BGM：0.5s 淡出后停止并断开节点（重复调用安全）。 */
function mcSndStopBgm() {
  try {
    mcSndBgmToken++;
    mcSndBgmPlaying = false;
    const src = mcSndBgmSource;
    const gain = mcSndBgmGain;
    mcSndBgmSource = null;
    mcSndBgmGain = null;
    if (!src && !gain) return;
    try {
      if (gain && gain.gain) {
        const t = mcSndNow();
        const cur = gain.gain.value;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(Math.max(0.0001, typeof cur === 'number' && cur > 0.0001 ? cur : 1), t);
        gain.gain.linearRampToValueAtTime(0.0001, t + 0.5);
      }
    } catch (e) {}
    setTimeout(function () {
      mcSndBgmStopSource(src, gain);
    }, 560);
  } catch (e) {}
}

/** BGM 是否在播放。 */
function mcSndIsBgmPlaying() {
  try {
    return !!(mcSndBgmPlaying && mcSndBgmSource);
  } catch (e) {
    return false;
  }
}

/* ---------------------------------------------------------------------------
 * 7. 音量控制
 * -------------------------------------------------------------------------*/

/** 把某个总线的增益平滑过渡到当前设定值。 */
function mcSndApplyVolume(key) {
  try {
    if (!mcSndCtx) return;
    const value = Math.max(0.0001, mcSndVolumes[key]);
    if (key === 'master') mcSndSmoothParam(mcSndMaster ? mcSndMaster.gain : null, value);
    else if (key === 'sfx') mcSndSmoothParam(mcSndSfxBus ? mcSndSfxBus.gain : null, value);
    else if (key === 'bgm') mcSndSmoothParam(mcSndBgmBus ? mcSndBgmBus.gain : null, value);
  } catch (e) {}
}

/** 设置一组音量（0~1），未 unlock 时只记录，播放中立即平滑生效。 */
function mcSndSetVolume(key, value) {
  try {
    const v = mcSndClamp01(value);
    if (v === null) return;
    if (!(key in mcSndVolumes)) return;
    mcSndVolumes[key] = v;
    mcSndApplyVolume(key);
  } catch (e) {}
}

/** 读取当前三组音量。 */
function mcSndGetVolumes() {
  return {
    master: mcSndVolumes.master,
    sfx: mcSndVolumes.sfx,
    bgm: mcSndVolumes.bgm
  };
}

/* ---------------------------------------------------------------------------
 * 8. 对外 API
 * -------------------------------------------------------------------------*/

/**
 * Minecraft 风格 WebAudio 音频引擎。
 * 所有方法内部 try/catch，未 unlock 时静默；需在用户手势里先调用 unlock()。
 */
const MC_AUDIO = {
  /** 创建 / 恢复 AudioContext（用户手势内调用，可重复调用）。 */
  unlock: mcSndUnlock,
  /** 预加载 5 个音效采样：无手势也可调用（建 suspended 上下文并解码，不发声）。 */
  preload: mcSndPreload,
  /** AudioContext 是否处于 running。 */
  isReady: mcSndIsReady,
  /** 主音量 0~1。 */
  setMasterVolume: function (v) { mcSndSetVolume('master', v); },
  /** 短期音效音量 0~1。 */
  setSfxVolume: function (v) { mcSndSetVolume('sfx', v); },
  /** BGM 音量 0~1（播放 / 交叉淡入淡出中即时生效）。 */
  setBgmVolume: function (v) { mcSndSetVolume('bgm', v); },
  /** 当前音量快照 { master, sfx, bgm }。 */
  getVolumes: mcSndGetVolumes,

  /* —— 短音效（Minecraft 原版采样） —— */
  click: mcSndClick,
  hover: mcSndHover,
  toggle: mcSndToggle,
  success: mcSndSuccess,
  error: mcSndError,
  open: mcSndOpen,
  close: mcSndClose,
  levelUp: mcSndLevelUp,

  /* —— BGM（宿主目录曲目 + 用户曲目合并列表） —— */
  /** 拉取宿主曲目清单（幂等，失败 warn 返回 []；用户曲目不受影响）。 */
  loadBgmTracks: mcSndLoadBgmTracks,
  /** 覆盖式写入用户曲目 [{id,name,blob}]；unlock 前后都可调用，被删/被替换的曲目自动清缓存。 */
  setUserTracks: mcSndSetUserTracks,
  /** 删除一首用户曲目（可选 API，宿主删单曲时用），同时清掉解码缓存。 */
  dropUserTrack: mcSndDropUserTrack,
  /** 同步读取合并列表 [{id,name,size,source}]（source: 'file' | 'user'）。 */
  getBgmTracks: mcSndGetBgmTracks,
  /** 播放指定曲目（不传 id = 当前/第一首）；未 unlock 只记录意图；解码失败返回 false 不抛错。 */
  playBgmTrack: mcSndPlayBgmTrack,
  /** 切到下一首（循环，1s 交叉淡入淡出）。 */
  nextBgmTrack: mcSndNextBgmTrack,
  /** 保留键：按当前/第一首开始播放（等价 playBgmTrack()）。 */
  startBgm: mcSndStartBgm,
  /** 停止 BGM（0.5s 淡出）。 */
  stopBgm: mcSndStopBgm,
  /** BGM 是否在播放。 */
  isBgmPlaying: mcSndIsBgmPlaying,

  /* —— 辅助：整页音频挂起 / 恢复（可见性由引擎自动处理，这里留给集成方手动控制） —— */
  suspend: mcSndSuspend,
  resume: mcSndResume
};

/* ---- src/40-styles.js ---- */

    /* ------------------------------------------------------------------ *
     * 4. Stylesheet
     *
     * Every component rule is scoped by `body[data-mc-theme="on"]`, so simply
     * removing the attribute restores the stock GUI instantly. The plugin's own
     * widgets live under `[data-mc-ui]`, whose class selectors outrank the
     * component rules above.
     * ------------------------------------------------------------------ */

    const MC_CSS = `
/* ============================ wallpaper layer ============================ */
#mc-wallpaper-layer {
  position: fixed;
  inset: 0;
  z-index: -2;
  pointer-events: none;
  overflow: hidden;
  background: #0d0e10;
  contain: strict;
}
#mc-wallpaper-layer .mcu-wall {
  position: absolute;
  inset: -1px;
  background-position: center center;
  background-repeat: no-repeat;
  background-size: cover;
  image-rendering: pixelated;
  opacity: 0;
  transition: opacity var(--mc-fade, 1.8s) ease-in-out;
  will-change: opacity;
}
#mc-wallpaper-layer .mcu-wall.is-visible { opacity: 1; }
/* Photographs must scale smoothly; only the procedural scenes are pixel art. */
#mc-wallpaper-layer .mcu-wall.mcu-wall--photo { image-rendering: auto; }
#mc-wallpaper-layer .mcu-wall-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(10,11,13,0.05) 0%, rgba(10,11,13,0.08) 55%, rgba(10,11,13,0.1) 100%);
}
body[data-mc-scheme="light"] #mc-wallpaper-layer .mcu-wall-scrim {
  background: linear-gradient(180deg, rgba(252,250,246,0.05) 0%, rgba(252,250,246,0.08) 55%, rgba(250,247,241,0.1) 100%);
}
#mc-wallpaper-layer .mcu-wall-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(115% 85% at 50% 42%, rgba(0,0,0,0) 46%, rgba(0,0,0,0.2) 100%);
}
#mc-particles {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  opacity: 0.85;
}
#mc-wallpaper-layer.is-off { display: none; }

/* Root + window frame must stop painting an opaque background or the wallpaper
   (a negative z-index layer) stays hidden behind the shell. */
body[data-mc-theme="on"] #root,
body[data-mc-theme="on"] [id="root"] { background: none !important; }
body[data-mc-theme="on"] [data-slot="root"],
body[data-mc-theme="on"] [data-dsh-surface="root"] { background: transparent !important; }
body[data-mc-theme="on"] [class*="_frame"] { background: transparent !important; }

/* Per-surface stone texture: barely visible grain that sells the material
   without hurting text contrast. */
body[data-mc-theme="on"] [data-dsh-surface="sidebar"],
body[data-mc-theme="on"] [data-dsh-surface="settings"] [class*="panel" i],
body[data-mc-theme="on"] [data-pane="sidebar"] {
  background-image:
    repeating-linear-gradient(0deg, rgba(255,255,255,0.016) 0 2px, rgba(0,0,0,0) 2px 5px),
    repeating-linear-gradient(90deg, rgba(0,0,0,0.045) 0 1px, rgba(0,0,0,0) 1px 26px);
}

/* ============================== buttons ================================ */
body[data-mc-theme="on"] button,
body[data-mc-theme="on"] [role="button"] {
  border-radius: 2px !important;
  box-shadow:
    inset 2px 2px 0 0 var(--mc-edge-light),
    inset -2px -2px 0 0 var(--mc-edge-dark),
    0 2px 0 0 rgba(0,0,0,0.34) !important;
  text-shadow: 1px 1px 0 rgba(0,0,0,0.32);
  transition: background-color 0.12s ease, box-shadow 0.08s ease, transform 0.08s ease, color 0.12s ease;
}
body[data-mc-theme="on"] button:active:not(:disabled),
body[data-mc-theme="on"] [role="button"]:active:not([aria-disabled="true"]) {
  transform: translateY(2px);
  box-shadow:
    inset 2px 2px 0 0 var(--mc-edge-dark),
    inset -2px -2px 0 0 rgba(255,255,255,0.06),
    0 0 0 0 rgba(0,0,0,0) !important;
}
body[data-mc-theme="on"] button:disabled,
body[data-mc-theme="on"] [aria-disabled="true"] {
  filter: saturate(0.55) brightness(0.9);
}

/* ============================== surfaces =============================== */
body[data-mc-theme="on"] [role="dialog"],
body[data-mc-theme="on"] [data-dsh-part="dialog"],
body[data-mc-theme="on"] [class*="dialog" i] {
  border-radius: 2px !important;
  box-shadow:
    inset 2px 2px 0 0 var(--mc-edge-light),
    inset -2px -2px 0 0 var(--mc-edge-dark),
    0 8px 0 0 rgba(0,0,0,0.22),
    0 18px 44px rgba(0,0,0,0.45) !important;
}
body[data-mc-theme="on"] [role="menu"],
body[data-mc-theme="on"] [role="listbox"],
body[data-mc-theme="on"] [class*="menu" i],
body[data-mc-theme="on"] [class*="popover" i] {
  border-radius: 2px !important;
  box-shadow:
    inset 1px 1px 0 0 rgba(255,255,255,0.08),
    inset -1px -1px 0 0 rgba(0,0,0,0.45),
    0 6px 18px rgba(0,0,0,0.42) !important;
}
body[data-mc-theme="on"] [class*="card" i]:not([class*="cardHeader"]):not([class*="cardBody"]):not([class*="cardFooter"]) {
  border-radius: 2px !important;
  box-shadow:
    inset 2px 2px 0 0 var(--mc-edge-light),
    inset -2px -2px 0 0 var(--mc-edge-dark),
    0 2px 0 0 rgba(0,0,0,0.26) !important;
}
body[data-mc-theme="on"] [role="tabpanel"],
body[data-mc-theme="on"] [role="tablist"] {
  border-radius: 2px;
}

/* ============================== form fields ============================ */
body[data-mc-theme="on"] input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]),
body[data-mc-theme="on"] textarea,
body[data-mc-theme="on"] select {
  border-radius: 1px !important;
  box-shadow:
    inset 2px 2px 0 0 rgba(0,0,0,0.42),
    inset -1px -1px 0 0 rgba(255,255,255,0.05);
  text-shadow: none;
  transition: box-shadow 0.12s ease;
}
body[data-mc-theme="on"] input:focus-visible,
body[data-mc-theme="on"] textarea:focus-visible,
body[data-mc-theme="on"] select:focus-visible {
  box-shadow:
    inset 2px 2px 0 0 rgba(0,0,0,0.42),
    inset -1px -1px 0 0 rgba(255,255,255,0.05),
    0 0 0 2px var(--mc-accent);
}
body[data-mc-theme="on"] [data-composer-input],
body[data-mc-theme="on"] [contenteditable="true"] {
  border-radius: 1px !important;
}
body[data-mc-theme="on"] ::placeholder { color: var(--dsw-alias-label-dimmed); opacity: 1; }

/* ============================== navigation ============================= */
body[data-mc-theme="on"] [data-slot="sidebar"] [aria-current="true"],
body[data-mc-theme="on"] [data-slot="sidebar"] [aria-selected="true"],
body[data-mc-theme="on"] [data-pane="sidebar"] [aria-current="true"],
body[data-mc-theme="on"] [data-pane="sidebar"] [aria-selected="true"] {
  box-shadow:
    inset 3px 0 0 0 var(--mc-accent),
    inset 1px 1px 0 0 rgba(255,255,255,0.1),
    inset -1px -1px 0 0 rgba(0,0,0,0.32) !important;
  border-radius: 1px;
}
body[data-mc-theme="on"] [data-pane="sidebar"] { box-shadow: inset -2px 0 0 0 rgba(0,0,0,0.42); }
body[data-mc-theme="on"] [data-slot="conversation.session"],
body[data-mc-theme="on"] [data-slot="session-header"],
body[data-mc-theme="on"] [data-dsh-surface="session-header"] {
  box-shadow: inset 0 -2px 0 0 rgba(0,0,0,0.28);
}

/* ============================== scrollbars ============================= */
body[data-mc-theme="on"] ::-webkit-scrollbar { width: 12px; height: 12px; }
body[data-mc-theme="on"] ::-webkit-scrollbar-track {
  background: rgba(0,0,0,0.2);
  box-shadow: inset 1px 1px 0 rgba(0,0,0,0.35);
}
body[data-mc-theme="on"] ::-webkit-scrollbar-thumb {
  background-color: var(--dsw-alias-scrollbar-bg-l2);
  border: 2px solid transparent;
  background-clip: padding-box;
  border-radius: 0;
  box-shadow: inset 2px 2px 0 var(--mc-edge-light), inset -2px -2px 0 var(--mc-edge-dark);
}
body[data-mc-theme="on"] ::-webkit-scrollbar-thumb:hover {
  background-color: var(--dsw-alias-scrollbar-hover-l2);
  background-clip: padding-box;
}
body[data-mc-theme="on"] ::-webkit-scrollbar-corner { background: transparent; }

/* ============================ text, focus, code ======================== */
body[data-mc-theme="on"] ::selection { background: var(--mc-accent); color: #ffffff; }
body[data-mc-theme="on"][data-mc-scheme="light"] ::selection { background: var(--mc-accent); color: #ffffff; }
body[data-mc-theme="on"] :focus-visible {
  outline: 2px solid var(--mc-accent) !important;
  outline-offset: 2px !important;
}
body[data-mc-theme="on"] [role="tooltip"] {
  border-radius: 2px !important;
  border: 2px solid var(--mc-tooltip-edge) !important;
  background-color: var(--mc-tooltip-bg) !important;
  color: var(--dsw-alias-tooltip-fg) !important;
  box-shadow: 0 2px 0 rgba(0,0,0,0.35), inset 1px 1px 0 rgba(255,255,255,0.08) !important;
  image-rendering: pixelated;
}
body[data-mc-theme="on"] pre,
body[data-mc-theme="on"] [class*="md-code-block"] {
  border-radius: 1px !important;
  box-shadow:
    inset 1px 1px 0 0 rgba(0,0,0,0.35),
    inset -1px -1px 0 0 rgba(255,255,255,0.04) !important;
}
body[data-mc-theme="on"] code {
  text-shadow: none;
}
body[data-mc-theme="on"] hr {
  border: 0;
  border-top: 2px solid var(--dsw-alias-border-l2);
}

/* =========================== plugin widgets =========================== */
[data-mc-ui] {
  --mcu-font: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", system-ui, sans-serif;
  --mcu-mono: "Cascadia Mono", "Consolas", ui-monospace, monospace;
  font-family: var(--mcu-font);
  color: var(--mc-text);
  box-sizing: border-box;
}
[data-mc-ui] *, [data-mc-ui] *::before, [data-mc-ui] *::after { box-sizing: border-box; }
[data-mc-ui] .mcu-shadow {
  box-shadow:
    inset 2px 2px 0 0 var(--mc-edge-light),
    inset -2px -2px 0 0 var(--mc-edge-dark),
    0 3px 0 0 rgba(0,0,0,0.3);
}
[data-mc-ui] .mcu-title {
  font-weight: 700;
  letter-spacing: 0.05em;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.4);
}
[data-mc-ui][data-mc-scheme="light"] .mcu-title { text-shadow: 1px 1px 0 rgba(255,255,255,0.65); }

/* ---- HUD ---- */
/* The console is bottom-anchored: the collapse/expand button never moves, and
   the function panel grows upwards from it in a 3-column block grid (a 7-button
   horizontal row used to stretch across the composer). */
.mcu-hud {
  position: fixed;
  right: var(--mc-hud-right, 16px);
  bottom: var(--mc-hud-bottom, 64px);
  /* 往下挪自身长度的 2/3：34px 方块按钮约 23px，取 24px。用固定像素而非
     百分比，所以展开/收起改变高度时基准位置不会变。 */
  transform: translateY(var(--mc-hud-drop, 24px));
  z-index: 60;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  pointer-events: none;
}
.mcu-hud > * { pointer-events: auto; }
.mcu-hud-panel {
  display: grid;
  grid-template-columns: repeat(3, 34px);
  gap: 6px;
  padding: 8px;
  background: var(--mc-panel);
  border: 2px solid rgba(0,0,0,0.5);
  border-radius: 2px;
  box-shadow:
    inset 2px 2px 0 0 var(--mc-edge-light),
    inset -2px -2px 0 0 var(--mc-edge-dark),
    0 3px 0 0 rgba(0,0,0,0.32);
}
.mcu-hud-panel .mcu-btn { width: 34px; height: 34px; }
.mcu-hud-row { display: flex; align-items: center; gap: 6px; }.mcu-btn {
  -webkit-appearance: none;
  appearance: none;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  padding: 0;
  background: var(--mc-panel-2);
  color: var(--mc-text);
  border: 2px solid rgba(0,0,0,0.45);
  border-radius: 2px;
  cursor: pointer;
  box-shadow: inset 2px 2px 0 0 var(--mc-edge-light), inset -2px -2px 0 0 var(--mc-edge-dark);
  transition: background-color 0.12s ease, transform 0.06s ease, box-shadow 0.06s ease;
}
.mcu-btn:hover { background: var(--mc-panel-3); }
.mcu-btn:active {
  transform: translateY(2px);
  box-shadow: inset 2px 2px 0 0 var(--mc-edge-dark), inset -2px -2px 0 0 rgba(255,255,255,0.06);
}
.mcu-btn[aria-pressed="true"] {
  background: var(--mc-accent);
  color: #ffffff;
  box-shadow: inset 2px 2px 0 0 rgba(255,255,255,0.14), inset -2px -2px 0 0 rgba(0,0,0,0.5);
}
body[data-mc-scheme="light"] .mcu-btn[aria-pressed="true"] { background: var(--mc-accent); color: #ffffff; }
.mcu-btn svg { display: block; shape-rendering: crispEdges; }
.mcu-btn:focus-visible { outline: 2px solid var(--mc-accent); outline-offset: 2px; }

.mcu-textbtn {
  -webkit-appearance: none;
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 4px 12px;
  font-family: var(--mcu-font);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: var(--mc-text);
  background: var(--mc-panel-2);
  border: 2px solid rgba(0,0,0,0.45);
  border-radius: 2px;
  cursor: pointer;
  box-shadow: inset 2px 2px 0 0 var(--mc-edge-light), inset -2px -2px 0 0 var(--mc-edge-dark), 0 2px 0 rgba(0,0,0,0.3);
  text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
  transition: background-color 0.12s ease, transform 0.06s ease;
}
.mcu-textbtn:hover { background: var(--mc-panel-3); }
.mcu-textbtn:active { transform: translateY(2px); box-shadow: inset 2px 2px 0 0 var(--mc-edge-dark); }
.mcu-textbtn.is-primary {
  background: var(--mc-accent);
  color: #ffffff;
  border-color: rgba(0,0,0,0.45);
}
.mcu-textbtn.is-primary:hover { filter: brightness(1.1); }
.mcu-textbtn.is-ghost { background: transparent; box-shadow: none; border-color: transparent; }
.mcu-textbtn.is-ghost:hover { background: var(--mc-panel-2); }
.mcu-textbtn:disabled { opacity: 0.55; cursor: not-allowed; }

/* ---- modal ---- */
.mcu-overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(0,0,0,0.55);
  /* shell.overlay is a click-through layer: opt back into pointer events or
     the backdrop and the dialog controls stop receiving clicks. */
  pointer-events: auto;
  animation: mcu-fade 0.16s ease-out;
}
.mcu-dialog {
  display: flex;
  flex-direction: column;
  width: min(720px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  background: var(--mc-panel);
  color: var(--mc-text);
  border: 2px solid rgba(0,0,0,0.62);
  border-radius: 3px;
  box-shadow:
    inset 2px 2px 0 0 var(--mc-edge-light),
    inset -2px -2px 0 0 var(--mc-edge-dark),
    0 10px 0 0 rgba(0,0,0,0.2),
    0 20px 48px rgba(0,0,0,0.5);
  animation: mcu-pop 0.18s cubic-bezier(0.2, 1.4, 0.5, 1);
  overflow: hidden;
}
.mcu-dialog.mcu-dialog--wide { width: min(900px, calc(100vw - 32px)); }
.mcu-dialog--sheet { width: min(520px, calc(100vw - 32px)); }
.mcu-dialog__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: var(--mc-panel-2);
  border-bottom: 2px solid rgba(0,0,0,0.34);
  box-shadow: inset 0 -2px 0 0 rgba(0,0,0,0.22), inset 0 2px 0 0 var(--mc-edge-light);
}
.mcu-dialog__head h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.4);
}
.mcu-dialog__body {
  padding: 14px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.mcu-dialog__foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 12px;
  background: var(--mc-panel-2);
  border-top: 2px solid rgba(0,0,0,0.34);
}
.mcu-iconbtn {
  -webkit-appearance: none;
  appearance: none;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  padding: 0;
  font-size: 15px;
  line-height: 1;
  color: var(--mc-text);
  background: var(--mc-panel-3);
  border: 2px solid rgba(0,0,0,0.45);
  border-radius: 2px;
  cursor: pointer;
  box-shadow: inset 1px 1px 0 0 var(--mc-edge-light), inset -1px -1px 0 0 var(--mc-edge-dark);
}
.mcu-iconbtn:hover { background: var(--mc-panel-3); }

/* ---- settings / rows ---- */
.mcu-sheet { display: flex; flex-direction: column; gap: 16px; }
.mcu-section {
  background: var(--mc-panel-2);
  border: 2px solid rgba(0,0,0,0.42);
  border-radius: 2px;
  box-shadow: inset 2px 2px 0 0 var(--mc-edge-light), inset -2px -2px 0 0 var(--mc-edge-dark);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mcu-section__title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--mc-accent);
  text-shadow: 1px 1px 0 rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  gap: 8px;
}
.mcu-section__title::before {
  content: "";
  width: 8px;
  height: 8px;
  background: var(--mc-accent);
  box-shadow: 2px 2px 0 rgba(0,0,0,0.4);
}
.mcu-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-height: 30px;
}
.mcu-row--stack { flex-direction: column; align-items: stretch; gap: 6px; }
.mcu-row__label { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.mcu-row__name { font-size: 13px; font-weight: 600; }
.mcu-row__hint { font-size: 11px; color: var(--mc-text-dim); line-height: 1.45; }
.mcu-row__control { display: flex; align-items: center; gap: 8px; flex: none; }
.mcu-divider { height: 2px; background: rgba(0,0,0,0.28); box-shadow: 0 1px 0 rgba(255,255,255,0.06); }

/* ---- toggle ---- */
.mcu-toggle {
  -webkit-appearance: none;
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 74px;
  height: 26px;
  padding: 0 8px 0 6px;
  font-family: var(--mcu-font);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--mc-text-dim);
  background: var(--mc-slot);
  border: 2px solid rgba(0,0,0,0.5);
  border-radius: 2px;
  cursor: pointer;
  box-shadow: inset 2px 2px 0 0 rgba(0,0,0,0.35), inset -1px -1px 0 0 rgba(255,255,255,0.05);
}
.mcu-toggle__dot { width: 10px; height: 10px; background: #5d6157; box-shadow: 0 0 0 2px rgba(0,0,0,0.35); flex: none; }
.mcu-toggle[aria-checked="true"] { color: #ffffff; background: var(--mc-accent); box-shadow: inset 2px 2px 0 0 rgba(255,255,255,0.12), inset -2px -2px 0 0 rgba(0,0,0,0.4); }
.mcu-toggle[aria-checked="true"] .mcu-toggle__dot { background: var(--mc-accent); box-shadow: 0 0 0 2px rgba(0,0,0,0.35), 0 0 8px rgba(138,201,90,0.55); }
body[data-mc-scheme="light"] .mcu-toggle[aria-checked="true"] { color: #ffffff; background: var(--mc-accent); }
.mcu-toggle:focus-visible { outline: 2px solid var(--mc-accent); outline-offset: 2px; }

/* ---- range ---- */
.mcu-range {
  -webkit-appearance: none;
  appearance: none;
  width: 148px;
  height: 20px;
  background: transparent;
  cursor: pointer;
}
.mcu-range::-webkit-slider-runnable-track {
  height: 10px;
  background: var(--mc-slot);
  border: 2px solid rgba(0,0,0,0.5);
  box-shadow: inset 1px 1px 0 rgba(0,0,0,0.4);
}
.mcu-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 20px;
  margin-top: -7px;
  background: var(--mc-panel-3);
  border: 2px solid rgba(0,0,0,0.6);
  box-shadow: inset 2px 2px 0 0 var(--mc-edge-light), inset -2px -2px 0 0 var(--mc-edge-dark);
  cursor: grab;
}
.mcu-range:active::-webkit-slider-thumb { cursor: grabbing; background: var(--mc-accent); }

/* ---- segmented choices ---- */
.mcu-seg { display: inline-flex; gap: 4px; }
.mcu-seg .mcu-textbtn { min-height: 26px; padding: 2px 9px; font-size: 12px; }
.mcu-seg .mcu-textbtn[aria-pressed="true"] { background: var(--mc-accent); color: #ffffff; }
body[data-mc-scheme="light"] .mcu-seg .mcu-textbtn[aria-pressed="true"] { background: var(--mc-accent); color: #ffffff; }

/* ---- wallpaper picker ---- */
.mcu-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(158px, 1fr));
  gap: 10px;
}
.mcu-slot {
  -webkit-appearance: none;
  appearance: none;
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  padding: 0;
  overflow: hidden;
  background: var(--mc-slot);
  border: 2px solid rgba(0,0,0,0.5);
  border-radius: 2px;
  cursor: pointer;
  box-shadow: inset 2px 2px 0 rgba(0,0,0,0.3), inset -2px -2px 0 var(--mc-edge-light);
}
.mcu-slot img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated;
  pointer-events: none;
}
/* Photo thumbnails are real photographs: keep them smooth. */
.mcu-slot--photo img { image-rendering: auto; }
/* Imported wallpaper tile: the delete button sits on top of the tile. */
.mcu-slotwrap { position: relative; display: block; }
.mcu-slotwrap .mcu-slot { width: 100%; }
.mcu-slot__del {
  -webkit-appearance: none;
  appearance: none;
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  color: #f4f6f4;
  background: rgba(0,0,0,0.62);
  border: 2px solid rgba(0,0,0,0.5);
  border-radius: 2px;
  box-shadow: inset 2px 2px 0 rgba(255,255,255,0.14), inset -2px -2px 0 rgba(0,0,0,0.45);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.14s ease;
}
.mcu-slotwrap:hover .mcu-slot__del,
.mcu-slot__del:focus-visible { opacity: 1; }
.mcu-slot__del:hover { background: #8a2f2f; }
.mcu-slot__del:active { transform: translateY(1px); }
/* Upload tile: same 16:9 footprint as a wallpaper slot. */
.mcu-slot--add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--mc-text-dim);
  background: repeating-linear-gradient(45deg, rgba(0,0,0,0.16) 0 6px, transparent 6px 12px), var(--mc-slot);
  border: 2px dashed rgba(255,255,255,0.3);
  box-shadow: inset 2px 2px 0 rgba(0,0,0,0.3);
}
.mcu-slot--add .mcu-slot__name {
  position: static;
  padding: 0;
  color: inherit;
  background: none;
  text-shadow: none;
}
.mcu-slot--add:hover { color: var(--mc-text); border-color: var(--mc-accent); }
.mcu-slot__name {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 3px 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #f2f6ec;
  background: rgba(8,10,8,0.62);
  text-shadow: 1px 1px 0 rgba(0,0,0,0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mcu-slot:hover { border-color: var(--mc-accent); }
.mcu-slot[aria-pressed="true"] {
  border-color: var(--mc-accent);
  box-shadow: 0 0 0 2px var(--mc-accent), inset 2px 2px 0 rgba(0,0,0,0.3);
}
.mcu-slot[aria-pressed="true"]::after {
  content: "";
  position: absolute;
  top: 4px;
  right: 4px;
  width: 12px;
  height: 12px;
  background: var(--mc-accent);
  box-shadow: 2px 2px 0 rgba(0,0,0,0.55);
}
.mcu-slot:focus-visible { outline: 2px solid var(--mc-accent); outline-offset: 2px; }

/* ---- achievement toast ---- */
.mcu-toast-stack {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 80;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}
.mcu-toast {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 240px;
  max-width: 340px;
  padding: 10px 14px;
  background: #23272a;
  color: #f0f2ec;
  border: 2px solid #6f6f6f;
  border-radius: 2px;
  box-shadow: inset 2px 2px 0 rgba(255,255,255,0.18), inset -2px -2px 0 rgba(0,0,0,0.55), 0 6px 18px rgba(0,0,0,0.45);
  animation: mcu-toast-in 0.35s cubic-bezier(0.2, 1.5, 0.5, 1);
  font-family: var(--mcu-font);
}
.mcu-toast__icon {
  width: 22px;
  height: 22px;
  flex: none;
  background: #c9a227;
  box-shadow: 2px 2px 0 rgba(0,0,0,0.5), inset 2px 2px 0 rgba(255,255,255,0.35);
}
.mcu-toast__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.mcu-toast__title { font-size: 12px; font-weight: 700; color: #ffd84a; letter-spacing: 0.06em; }
.mcu-toast__body { font-size: 12px; color: #dfe4da; line-height: 1.4; }

/* ---- misc ---- */
.mcu-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--mc-text-dim);
  background: var(--mc-slot);
  border: 1px solid rgba(0,0,0,0.4);
  box-shadow: inset 1px 1px 0 rgba(255,255,255,0.06);
}
.mcu-fine { font-size: 11px; color: var(--mc-text-dim); line-height: 1.5; }
.mcu-kbd {
  font-family: var(--mcu-mono);
  font-size: 11px;
  padding: 1px 4px;
  background: var(--mc-slot);
  border: 1px solid rgba(0,0,0,0.45);
  box-shadow: inset 1px 1px 0 rgba(255,255,255,0.06);
}

@keyframes mcu-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes mcu-pop { from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: none; } }
@keyframes mcu-toast-in { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: none; } }

/* ---- widget state overrides ---------------------------------------------
   The stock component rules use !important on box-shadow (so the bevel wins
   over any app styling), which also outranks the widget states below. They
   are restated here with !important and a body-scoped selector, so only our
   own controls (.mcu-*) change state. */
body[data-mc-theme="on"] .mcu-btn:active {
  box-shadow: inset 2px 2px 0 0 var(--mc-edge-dark), inset -2px -2px 0 0 rgba(255,255,255,0.06) !important;
}
body[data-mc-theme="on"] .mcu-btn[aria-pressed="true"] {
  box-shadow: inset 2px 2px 0 0 rgba(255,255,255,0.14), inset -2px -2px 0 0 rgba(0,0,0,0.5) !important;
}
body[data-mc-theme="on"] .mcu-toggle[aria-checked="true"] {
  box-shadow: inset 2px 2px 0 0 rgba(255,255,255,0.12), inset -2px -2px 0 0 rgba(0,0,0,0.4) !important;
}
body[data-mc-theme="on"] .mcu-slot[aria-pressed="true"] {
  box-shadow: 0 0 0 2px var(--mc-accent), inset 2px 2px 0 rgba(0,0,0,0.3) !important;
}

/* ---- in-app tab strips (conversation header) ----------------------------
   The stock tabs already draw their own selection frame; our bevel/accent
   shadows were painted *inside* that frame, which made the active box look
   narrower and clipped at the left edge. Keep the stock geometry intact. */
body[data-mc-theme="on"] [role="tablist"] {
  box-shadow: none !important;
}
body[data-mc-theme="on"] [role="tablist"] *,
body[data-mc-theme="on"] [role="tab"],
body[data-mc-theme="on"] [role="tab"]:hover,
body[data-mc-theme="on"] [role="tab"][aria-selected="true"],
body[data-mc-theme="on"] [role="tab"][aria-current="true"],
body[data-mc-theme="on"] button[aria-selected],
body[data-mc-theme="on"] button[aria-current="page"],
body[data-mc-theme="on"] button[aria-current="true"] {
  border-radius: 2px !important;
  box-shadow: none !important;
  background-image: none !important;
}

/* variant chooser can carry more buttons than one line */
.mcu-seg--wrap { flex-wrap: wrap; }

/* Local music library: one chip per uploaded track, plus the upload button. */
.mcu-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.mcu-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 3px 4px 3px 8px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--mc-text);
  background: var(--mc-slot);
  border: 2px solid rgba(255,255,255,0.16);
  border-radius: 2px;
  box-shadow: inset 1px 1px 0 rgba(0,0,0,0.35);
}
.mcu-chip__name {
  max-width: 168px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.mcu-chip__del {
  -webkit-appearance: none;
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  color: var(--mc-text-dim);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 2px;
}
.mcu-chip__del:hover,
.mcu-chip__del:focus-visible {
  color: #fff;
  background: #8a2f2f;
  outline: none;
}

@media (prefers-reduced-motion: reduce) {
  #mc-wallpaper-layer .mcu-wall { transition: none; }
  .mcu-dialog, .mcu-overlay, .mcu-toast { animation: none; }
  body[data-mc-theme="on"] button:active:not(:disabled) { transform: none; }
}
`

/* ---- src/45-runtime.js ---- */

    /* ------------------------------------------------------------------ *
     * 5. Browser runtime
     *
     * Owns everything that is not React: the wallpaper layer and its rotation
     * timer, the ambient particle canvas, the delegated click-sound wiring, the
     * scheme watcher, and the small toast bus the React overlay subscribes to.
     * ------------------------------------------------------------------ */

    /* ----------------------------- toast bus ----------------------------- */

    const mcToasts = (function () {
      let seq = 0
      const items = []
      const listeners = new Set()

      function emit() {
        const snapshot = items.slice()
        for (const listener of Array.from(listeners)) {
          try {
            listener(snapshot)
          } catch (_error) {
            /* ignore a broken subscriber */
          }
        }
      }

      return {
        subscribe(listener) {
          listeners.add(listener)
          listener(items.slice())
          return function unsubscribe() {
            listeners.delete(listener)
          }
        },
        push(title, body, ttlMs) {
          const item = { id: ++seq, title: title, body: body, ttl: ttlMs || 4200 }
          items.push(item)
          emit()
          const timer = window.setTimeout(function expire() {
            const at = items.findIndex(function find(entry) {
              return entry.id === item.id
            })
            if (at >= 0) {
              items.splice(at, 1)
              emit()
            }
          }, item.ttl)
          return function cancel() {
            window.clearTimeout(timer)
            const at = items.findIndex(function find(entry) {
              return entry.id === item.id
            })
            if (at >= 0) {
              items.splice(at, 1)
              emit()
            }
          }
        },
        clear() {
          items.length = 0
          emit()
        },
      }
    })()

    /** Show an advancement-style toast, honouring the achievement option. */
    function mcAchievement(key, overrideBody) {
      if (!mcSettings.get().ui.achievements) return
      const body = overrideBody || mcT('ach.' + key)
      if (!body) return
      mcToasts.push(mcT('ach.title'), body)
    }

    /* --------------------------- audio plumbing -------------------------- */

    /** True when the WebAudio half of the plugin is present in this bundle. */
    function mcHasAudio() {
      try {
        return typeof MC_AUDIO === 'object' && MC_AUDIO !== null
      } catch (_error) {
        return false
      }
    }

    /** Call an audio-engine method if it exists; never let sound break the UI. */
    function mcSound(method, a, b) {
      if (!mcHasAudio()) return undefined
      try {
        const fn = MC_AUDIO[method]
        if (typeof fn !== 'function') return undefined
        return fn.call(MC_AUDIO, a, b)
      } catch (error) {
        console.warn('[minecraft-ui] sound "' + method + '" failed', error)
        return undefined
      }
    }

    /* ----------------------------- wallpaper ----------------------------- */

    const mcWall = {
      layer: null,
      panes: { a: null, b: null },
      scrim: null,
      activePane: 'a',
      scene: null,
      pendingScene: null,
      timer: null,
      fadeTimer: null,
    }

    /** Wallpaper used when the active one is missing (shipped with the plugin). */
    const MC_FALLBACK_SCENE = 'photo-cozy-cabin'

    /**
     * The whole wallpaper library, in picker order: the user's imported
     * photographs first, then the bundled photo wallpapers. Each entry carries
     * `kind` so the picker can group them.
     */
    function mcScenes() {
      const out = []
      /* Wallpapers the user imported: they live in IndexedDB and come first,
         because they are the ones the user just picked. */
      try {
        if (typeof mcUserWallpapers === 'object' && mcUserWallpapers && Array.isArray(mcUserWallpapers.items)) {
          for (let i = 0; i < mcUserWallpapers.items.length; i += 1) {
            const item = mcUserWallpapers.items[i]
            out.push({ id: item.id, name: item.name, desc: item.desc, kind: 'user', dark: true })
          }
        }
      } catch (_error) {
        /* user library absent */
      }
      try {
        if (typeof MC_PHOTOS !== 'undefined' && Array.isArray(MC_PHOTOS)) {
          for (let i = 0; i < MC_PHOTOS.length; i += 1) {
            const photo = MC_PHOTOS[i]
            out.push({ id: photo.id, name: photo.name, desc: photo.desc, kind: 'photo', dark: true })
          }
        }
      } catch (_error) {
        /* photo module absent */
      }
      return out
    }

    /** Whether a scene id names one of the user's photograph wallpapers. */
    function mcIsPhotoScene(sceneId) {
      try {
        if (typeof mcUserFind === 'function' && mcUserFind(sceneId)) return true
        return typeof mcPhotoFind === 'function' && !!mcPhotoFind(sceneId)
      } catch (_error) {
        return false
      }
    }

    /** Scene ids in library order. */
    function mcSceneIds() {
      return mcScenes().map(function id(scene) {
        return scene.id
      })
    }

    /** Human name for a scene id (falls back to the id). */
    function mcSceneName(sceneId) {
      const found = mcScenes().find(function match(scene) {
        return scene.id === sceneId
      })
      return found && found.name ? found.name : sceneId
    }

    /** Resolve one scene id to the URL the layer paints. */
    function mcWallpaperUrl(sceneId) {
      /* Imported wallpapers are object URLs backed by IndexedDB blobs. */
      if (typeof mcUserUrl === 'function' && typeof mcUserFind === 'function' && mcUserFind(sceneId)) {
        return mcUserUrl(sceneId, false)
      }
      /* Every other wallpaper is a file served by the host half. */
      return typeof mcPhotoUrl === 'function' ? mcPhotoUrl(sceneId, false) : ''
    }

    /** Create the fixed wallpaper stack once, on demand. */
    function mcWallMountLayer() {
      let layer = document.getElementById('mc-wallpaper-layer')
      if (!layer) {
        layer = document.createElement('div')
        layer.id = 'mc-wallpaper-layer'
        layer.setAttribute('aria-hidden', 'true')
        layer.setAttribute(MC_UI_ATTR, 'wallpaper')
        for (const pane of ['a', 'b']) {
          const element = document.createElement('div')
          element.className = 'mcu-wall'
          element.setAttribute('data-pane', pane)
          layer.appendChild(element)
          mcWall.panes[pane] = element
        }
        mcWall.scrim = document.createElement('div')
        mcWall.scrim.className = 'mcu-wall-scrim'
        layer.appendChild(mcWall.scrim)
        const vignette = document.createElement('div')
        vignette.className = 'mcu-wall-vignette'
        layer.appendChild(vignette)
        mcWall.vignette = vignette
        document.body.appendChild(layer)
      } else {
        mcWall.panes.a = layer.querySelector('[data-pane="a"]')
        mcWall.panes.b = layer.querySelector('[data-pane="b"]')
        mcWall.scrim = layer.querySelector('.mcu-wall-scrim')
        mcWall.vignette = layer.querySelector('.mcu-wall-vignette')
      }
      mcWall.layer = layer
      return layer
    }

    /**
     * Apply dimming / blur / brightness to the wallpaper layer.
     *
     * Round 4: the user wants the *original* brightness reachable, so
     * - `wallpaper.gain` = 1.0 means "pixel-for-pixel as stored", up to 1.6×;
     * - `wallpaper.dim` = 0 adds no veil and no vignette at all,
     * - the panel-opacity slider (ui.glass) can reach 0 = panels fully clear.
     * Together those three can expose the wallpaper at its own brightness.
     */
    function mcWallStyle() {
      if (!mcWall.layer) return
      const wallpaper = mcSettings.get().wallpaper
      const dim = mcClamp(wallpaper.dim, 0, 0.35)
      const gain = mcClamp(wallpaper.gain, 0.7, 1.6)
      const blur = mcClamp(wallpaper.blur, 0, 12)
      mcWall.layer.style.setProperty('--mc-fade', '1.8s')
      for (const pane of ['a', 'b']) {
        const element = mcWall.panes[pane]
        if (!element) continue
        /* Every wallpaper is a photograph now: gain 1.0 = the file untouched. */
        const parts = ['brightness(' + (Math.round(gain * 100) / 100) + ')', 'saturate(1.03)']
        if (blur > 0) parts.unshift('blur(' + blur + 'px)')
        element.style.filter = parts.join(' ')
        element.style.transform = blur > 0 ? 'scale(1.04)' : 'none'
      }
      if (mcWall.scrim) {
        /* No baseline veil: dim = 0 must leave the file untouched. */
        const top = dim * 0.36
        const mid = dim * 0.38
        const bottom = dim * 0.4
        const round = function round(value) {
          return (Math.round(value * 1000) / 1000).toFixed(3)
        }
        const rgb = mcIsDark() ? '10,11,13' : '252,250,246'
        mcWall.scrim.style.background =
          'linear-gradient(180deg, rgba(' + rgb + ',' + round(top) + ') 0%, rgba(' + rgb + ',' +
          round(mid) + ') 55%, rgba(' + rgb + ',' + round(bottom) + ') 100%)'
      }
      if (mcWall.vignette) {
        mcWall.vignette.style.opacity = String(Math.round((0.05 + dim * 2.4) * 100) / 100)
      }
    }

    /**
     * Mirror the current wallpaper onto <html> as a plain background. The
     * negative-z layer is what actually crossfades, but this guarantees the
     * picture is there even if the layer is covered by an opaque surface.
     * @param {string} url - image URL (data URL or host-served path).
     */
    function mcWallApplyHtml(url) {
      const root = document.documentElement
      if (!root) return
      const style = root.style
      style.backgroundImage = 'url("' + url + '")'
      style.backgroundSize = 'cover'
      style.backgroundPosition = 'center center'
      style.backgroundRepeat = 'no-repeat'
      style.backgroundAttachment = 'fixed'
    }

    /** Drop the <html> background again (theme switched off / teardown). */
    function mcWallClearHtml() {
      const root = document.documentElement
      if (!root) return
      const style = root.style
      style.removeProperty('background-image')
      style.removeProperty('background-size')
      style.removeProperty('background-position')
      style.removeProperty('background-repeat')
      style.removeProperty('background-attachment')
    }

    /** Crossfade the layer to a scene id. */
    function mcWallShow(sceneId, immediate) {
      if (!sceneId) return
      mcWallMountLayer()
      if (mcWall.scene === sceneId && mcWall.panes[mcWall.activePane]) return
      const url = mcWallpaperUrl(sceneId)
      if (!url) {
        /* Either the catalogue is still loading or this id is no longer in it:
           remember the intent and let mcWallResync() repaint once the list is
           known, instead of flashing a placeholder. */
        mcWall.pendingScene = sceneId
        if (!mcPhotoLibrary.ready) return
        /* Catalogue known and the id is gone: paint a neutral gradient, never a tint. */
        mcWall.layer.style.background = mcIsDark()
          ? 'linear-gradient(160deg, #1a1b1e 0%, #101113 100%)'
          : 'linear-gradient(160deg, #f6f4ef 0%, #e6e3dc 100%)'
        mcWall.scene = sceneId
        return
      }
      let done = false
      const from = mcWall.activePane
      const to = from === 'a' ? 'b' : 'a'
      const next = mcWall.panes[to]
      const prev = mcWall.panes[from]
      if (!next || !prev) return
      const commit = function commit() {
        if (done) return
        done = true
        next.style.backgroundImage = 'url("' + url + '")'
        next.classList.add('is-visible')
        prev.classList.remove('is-visible')
        mcWall.activePane = to
        mcWall.scene = sceneId
        mcWall.layer.style.background = 'none'
        mcWallApplyHtml(url)
      }
      const paint = function paint() {
        if (immediate) {
          commit()
          return
        }
        window.requestAnimationFrame(function onFrame() {
          window.requestAnimationFrame(commit)
        })
      }

      /* The picture comes over HTTP: wait for the decode so the crossfade is not blank. */
      const preload = new Image()
      preload.onload = paint
      preload.onerror = function onError() {
        console.warn('[minecraft-ui] wallpaper "' + sceneId + '" failed to load:', url)
        if (sceneId === MC_FALLBACK_SCENE) {
          mcWallApplyHtml(mcWallpaperUrl(MC_FALLBACK_SCENE))
          return
        }
        mcAchievement('wallpaperFailed', mcSceneName(sceneId))
        mcWallSelect(MC_FALLBACK_SCENE, { silent: true })
      }
      preload.src = url
    }

    /**
     * Repaint after the wallpaper catalogue changed (first load, or the user
     * dropped new files into the folder). A scene that vanished from the
     * catalogue falls back to the first one that still exists.
     */
    function mcWallResync() {
      const settings = mcSettings.get()
      const wanted = mcWall.pendingScene || settings.wallpaper.sceneId
      mcWall.pendingScene = null
      if (!wanted) return
      if (!mcWallpaperUrl(wanted)) {
        const scenes = mcScenes()
        if (!scenes.length) return
        mcWallSelect(scenes[0].id, { silent: true })
        return
      }
      mcWall.scene = null
      mcWallShow(wanted, true)
      mcWallArmTimer()
    }

    /** Next scene id in library order (wrapping, skipping the current one). */
    function mcWallNextScene(direction) {
      const ids = mcSceneIds()
      if (!ids.length) return null
      const step = direction === -1 ? -1 : 1
      const at = ids.indexOf(mcWall.scene)
      const index = (at < 0 ? 0 : at + step + ids.length) % ids.length
      return ids[index]
    }

    /** Stop the rotation timer. */
    function mcWallStopTimer() {
      if (mcWall.timer !== null) {
        window.clearTimeout(mcWall.timer)
        mcWall.timer = null
      }
    }

    /** (Re)arm the rotation timer from the current options. */
    function mcWallArmTimer() {
      mcWallStopTimer()
      const settings = mcSettings.get()
      if (!settings.enabled) return
      const wallpaper = settings.wallpaper
      if (!wallpaper.auto) return
      const ids = mcSceneIds()
      if (ids.length < 2) return
      const delay = mcClamp(wallpaper.intervalSec, 20, 3600) * 1000
      mcWall.timer = window.setTimeout(function rotate() {
        mcWall.timer = null
        const next = mcWallNextScene(1)
        if (next) {
          mcSettings.patch({ wallpaper: { sceneId: next } })
          mcAchievement('wallpaper', mcSceneName(next))
        }
        mcWallArmTimer()
      }, delay)
    }

    /** Manual switch: persist the new scene, crossfade and restart the timer. */
    function mcWallSelect(sceneId, options) {
      mcSettings.patch({ wallpaper: { sceneId: sceneId } })
      mcWallShow(sceneId)
      mcWallStyle()
      mcWallArmTimer()
      if (options && options.silent) return
      mcAchievement('wallpaper', mcSceneName(sceneId))
    }

    /* ------------------------------ music ------------------------------- */

    /**
     * Background-music track list, fetched from the host half once. The audio
     * engine owns playback; this mirror exists so the options panel can render
     * a playlist without touching the engine's internals.
     */
    const mcBgm = { items: [], ready: false, error: '', promise: null, listeners: new Set() }

    function mcBgmEmit() {
      for (const listener of Array.from(mcBgm.listeners)) {
        try {
          listener(mcBgm)
        } catch (error) {
          console.warn('[minecraft-ui] bgm listener failed', error)
        }
      }
    }

    /** Load the playlist (idempotent; never rejects). */
    function mcLoadBgmLibrary() {
      if (mcBgm.promise) return mcBgm.promise
      if (!mcHasAudio() || typeof MC_AUDIO.loadBgmTracks !== 'function') {
        mcBgm.ready = true
        mcBgm.error = 'audio'
        mcBgm.promise = Promise.resolve([])
        return mcBgm.promise
      }
      mcBgm.promise = Promise.resolve()
        .then(function fetchTracks() {
          return MC_AUDIO.loadBgmTracks()
        })
        .then(function onTracks(tracks) {
          mcBgm.items = Array.isArray(tracks) ? tracks.slice() : []
          mcBgm.ready = true
          mcBgm.error = mcBgm.items.length ? '' : 'empty'
          mcBgmEmit()
          return mcBgm.items
        })
        .catch(function onError(error) {
          console.warn('[minecraft-ui] background music library failed', error)
          mcBgm.ready = true
          mcBgm.error = 'error'
          mcBgmEmit()
          return []
        })
      return mcBgm.promise
    }

    function mcSubscribeBgm(listener) {
      mcBgm.listeners.add(listener)
      return function unsubscribeBgm() {
        mcBgm.listeners.delete(listener)
      }
    }

    /** Display name of one playlist entry (falls back to the file name). */
    function mcBgmName(trackId) {
      if (!trackId) return ''
      const found = mcBgm.items.find(function match(track) {
        return track.id === trackId
      })
      return found && found.name ? found.name : trackId
    }

    /** Snapshot of the user's uploaded background music (may be empty). */
    function mcUserMusicItems() {
      try {
        if (typeof mcUserMusic === 'object' && mcUserMusic && Array.isArray(mcUserMusic.items)) {
          return mcUserMusic.items
        }
      } catch (_error) {
        /* user music library absent */
      }
      return []
    }

    /**
     * Hand the uploaded tracks (IndexedDB blobs) to the audio engine and copy
     * the engine's merged playlist back into the picker mirror. Both the folder
     * tracks and the uploaded ones are played by the same engine, so the
     * playlist order stays "folder first, then my uploads".
     */
    function mcSyncUserMusic() {
      const items = mcUserMusicItems()
      if (mcHasAudio() && typeof MC_AUDIO.setUserTracks === 'function') {
        mcSound(
          'setUserTracks',
          items.map(function shape(item) {
            return { id: item.id, name: item.name, blob: item.blob }
          })
        )
        const merged = mcSound('getBgmTracks')
        if (Array.isArray(merged)) mcBgm.items = merged.slice()
      } else if (items.length) {
        /* No engine: still show the uploads so the user sees their library. */
        mcBgm.items = mcBgm.items
          .filter(function keepFile(track) {
            return track.id.indexOf('user-music-') !== 0
          })
          .concat(
            items.map(function shape(item) {
              return { id: item.id, name: item.name, size: item.bytes || 0, source: 'user' }
            })
          )
      }
      mcBgm.ready = true
      mcBgm.error = mcBgm.items.length ? '' : 'empty'
      mcBgmEmit()
      /* The active track may have been deleted: fall back to the first one. */
      const settings = mcSettings.get()
      if (settings.bgm.trackId && !mcBgm.items.some(function has(track) {
        return track.id === settings.bgm.trackId
      })) {
        mcSettings.patch({ bgm: { trackId: mcBgm.items.length ? mcBgm.items[0].id : '' } })
        if (settings.bgm.enabled) mcSyncAudio()
      }
    }

    /** Drop and reload the uploaded-track list (used after import / delete). */
    function mcRefreshUserMusic() {
      if (typeof mcUserMusicRefresh === 'function') {
        return mcUserMusicRefresh().then(function onReload() {
          mcSyncUserMusic()
          return mcBgm.items
        })
      }
      mcSyncUserMusic()
      return Promise.resolve(mcBgm.items)
    }

    /* --------------------------- hud anchoring -------------------------- */

    /**
     * The HUD sits at the bottom-right. The user asked for it to line up with
     * the composer's send button, so its vertical offset is measured from that
     * button instead of being a fixed number: `--mc-hud-bottom` is set to the
     * distance from the window bottom to the button's bottom edge, and the
     * stylesheet consumes it. When the button cannot be found the variable is
     * removed and the stylesheet's own default takes over.
     */
    const mcHudAnchor = { observer: null, element: null, frame: null, onResize: null, seq: [], lastBottom: null, lastRight: null }

    /**
     * Measure where the HUD should sit: the bottom edge of the composer's
     * bottom control row (the row holding the submit button) and its right
     * edge. Every candidate must be laid out inside the lower part of the
     * window; if nothing passes, no override is published at all and the
     * stylesheet default (bottom-right corner) takes over.
     * @returns {{ bottom: number, right: number } | null}
     */
    function mcHudMeasure() {
      const viewH = window.innerHeight
      const viewW = window.innerWidth
      const floor = viewH * 0.4
      let bottom = 0
      let right = 0
      let found = false

      function consider(rect) {
        if (!rect || rect.height < 4 || rect.width < 4) return
        if (rect.top < floor) return
        if (rect.bottom > viewH + 4) return
        found = true
        if (rect.bottom > bottom) bottom = rect.bottom
        if (rect.right > right) right = rect.right
      }

      const composer = mcHudComposer()
      if (composer) {
        /* The bottom control row: its buttons (attach, permissions, model,
           send …) share a bottom edge, and the right-most of them is submit. */
        let buttons = []
        try {
          buttons = Array.prototype.slice.call(composer.querySelectorAll('button'))
        } catch (_error) {
          buttons = []
        }
        for (const button of buttons) {
          consider(button.getBoundingClientRect())
        }
        /* Multi-line input grows upwards; the textarea's bottom edge is the
           row's bottom edge and is a good candidate when it is the lowest one. */
        let area = null
        try {
          area = composer.querySelector('textarea')
        } catch (_error) {
          area = null
        }
        if (area) consider(area.getBoundingClientRect())
        const box = composer.getBoundingClientRect()
        if (box && box.height > 8 && box.top > floor) {
          found = true
          if (box.bottom - 6 > bottom) bottom = box.bottom - 6
          if (box.right - 12 > right) right = box.right - 12
        }
      }
      if (!found) return null
      return { bottom: viewH - bottom, right: viewW - right }
    }

    /** Clamp, remember and publish the measured offsets. */
    function mcHudAnchorApply() {
      mcHudAnchor.frame = null
      const root = document.documentElement
      if (!root) return
      const measured = mcHudMeasure()
      /* A plausible measurement is a send button 30..150px above the window
         bottom. Anything else means we latched onto the wrong element (a
         centred empty-state composer, a scrolled panel, …), and the fixed
         bottom-right corner from the stylesheet is the safer answer. */
      const sane =
        measured &&
        measured.bottom >= 30 &&
        measured.bottom <= 150 &&
        measured.right >= 8 &&
        measured.right <= Math.round(window.innerWidth * 0.45)
      if (!sane) {
        root.style.removeProperty('--mc-hud-bottom')
        root.style.removeProperty('--mc-hud-right')
        mcHudAnchor.lastBottom = null
        mcHudAnchor.lastRight = null
        return
      }
      const bottom = Math.round(measured.bottom)
      const right = Math.round(measured.right)
      if (mcHudAnchor.lastBottom !== bottom) {
        mcHudAnchor.lastBottom = bottom
        root.style.setProperty('--mc-hud-bottom', bottom + 'px')
      }
      if (mcHudAnchor.lastRight !== right) {
        mcHudAnchor.lastRight = right
        root.style.setProperty('--mc-hud-right', right + 'px')
      }
    }
    function mcHudAnchorSchedule() {
      if (mcHudAnchor.frame !== null) return
      mcHudAnchor.frame = window.requestAnimationFrame(mcHudAnchorApply)
    }

    function mcHudAnchorStart() {
      if (mcHudAnchor.observer) return
      mcHudAnchorSchedule()
      /* The composer is rendered after the plugin mounts and its height changes
         with multi-line input, so re-measure a couple of times early on. */
      for (const delay of [120, 600, 1800]) {
        mcHudAnchor.seq.push(window.setTimeout(mcHudAnchorSchedule, delay))
      }
      mcHudAnchor.onResize = function onResize() {
        mcHudAnchorSchedule()
      }
      window.addEventListener('resize', mcHudAnchor.onResize)
      try {
        const observer = new MutationObserver(function onChange() {
          const stored = mcHudAnchor.element
          if (!stored || !stored.isConnected) {
            mcHudAnchor.element = null
            mcHudAnchorSchedule()
            return
          }
          /* The button survived the mutation: its geometry may still have moved
             (composer growing, panels opening), so re-measure in the next frame. */
          mcHudAnchorSchedule()
        })
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] })
        mcHudAnchor.observer = observer
      } catch (_error) {
        /* anchoring is cosmetic: without observation it just uses the default */
      }
    }

    function mcHudAnchorStop() {
      if (mcHudAnchor.frame !== null) {
        window.cancelAnimationFrame(mcHudAnchor.frame)
        mcHudAnchor.frame = null
      }
      for (const id of mcHudAnchor.seq) window.clearTimeout(id)
      mcHudAnchor.seq.length = 0
      mcHudAnchor.lastBottom = null
      mcHudAnchor.lastRight = null
      if (mcHudAnchor.onResize) window.removeEventListener('resize', mcHudAnchor.onResize)
      mcHudAnchor.onResize = null
      if (mcHudAnchor.observer) {
        try {
          mcHudAnchor.observer.disconnect()
        } catch (_error) {
          /* ignore */
        }
      }
      mcHudAnchor.observer = null
      mcHudAnchor.element = null
      const root = document.documentElement
      if (root) {
        root.style.removeProperty('--mc-hud-bottom')
        root.style.removeProperty('--mc-hud-right')
      }
    }

    /* ----------------------------- particles ---------------------------- */

    const mcParticles = {
      canvas: null,
      raf: null,
      motes: [],
      width: 0,
      height: 0,
    }

    function mcParticleSeed(count) {
      const motes = []
      for (let i = 0; i < count; i += 1) {
        motes.push({
          x: Math.random(),
          y: Math.random(),
          r: 1 + Math.floor(Math.random() * 2),
          speed: 0.00004 + Math.random() * 0.00012,
          drift: (Math.random() - 0.5) * 0.00006,
          phase: Math.random() * Math.PI * 2,
          alpha: 0.16 + Math.random() * 0.32,
        })
      }
      return motes
    }

    function mcParticlesResize() {
      const canvas = mcParticles.canvas
      if (!canvas) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      mcParticles.width = window.innerWidth
      mcParticles.height = window.innerHeight
      canvas.width = Math.max(1, Math.round(mcParticles.width * dpr))
      canvas.height = Math.max(1, Math.round(mcParticles.height * dpr))
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function mcParticlesFrame(time) {
      const canvas = mcParticles.canvas
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const dark = mcIsDark()
      ctx.clearRect(0, 0, mcParticles.width, mcParticles.height)
      const t = time / 1000
      for (let i = 0; i < mcParticles.motes.length; i += 1) {
        const mote = mcParticles.motes[i]
        mote.y -= mote.speed * (mcParticles.height / 60)
        mote.x += Math.sin(t * 0.35 + mote.phase) * 0.12 + mote.drift
        if (mote.y < -0.02) mote.y = 1.02
        if (mote.x < -0.02) mote.x = 1.02
        if (mote.x > 1.02) mote.x = -0.02
        const x = mote.x * mcParticles.width
        const y = mote.y * mcParticles.height
        const twinkle = 0.6 + 0.4 * Math.sin(t * 1.2 + mote.phase)
        ctx.fillStyle = dark
          ? 'rgba(232,236,242,' + (mote.alpha * twinkle).toFixed(3) + ')'
          : 'rgba(86,92,104,' + (mote.alpha * twinkle * 0.8).toFixed(3) + ')'
        ctx.fillRect(Math.round(x), Math.round(y), mote.r, mote.r)
      }
      mcParticles.raf = window.requestAnimationFrame(mcParticlesFrame)
    }

    function mcParticlesStart() {
      if (mcParticles.raf !== null) return
      let canvas = document.getElementById('mc-particles')
      if (!canvas) {
        canvas = document.createElement('canvas')
        canvas.id = 'mc-particles'
        canvas.setAttribute('aria-hidden', 'true')
        canvas.setAttribute(MC_UI_ATTR, 'particles')
        document.body.appendChild(canvas)
      }
      mcParticles.canvas = canvas
      if (!mcParticles.motes.length) mcParticles.motes = mcParticleSeed(26)
      mcParticlesResize()
      mcParticles.raf = window.requestAnimationFrame(mcParticlesFrame)
    }

    function mcParticlesStop() {
      if (mcParticles.raf !== null) {
        window.cancelAnimationFrame(mcParticles.raf)
        mcParticles.raf = null
      }
      if (mcParticles.canvas) {
        const ctx = mcParticles.canvas.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, mcParticles.canvas.width, mcParticles.canvas.height)
      }
    }

    /* --------------------------- sound wiring --------------------------- */

    const MC_INTERACTIVE = [
      'button',
      '[role="button"]',
      'a[href]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[role="option"]',
      '[role="switch"]',
      '[role="checkbox"]',
      '[role="radio"]',
      'input[type="checkbox"]',
      'input[type="radio"]',
      'summary',
    ].join(',')

    const mcSoundState = { onClick: null, onPointerOver: null, onUnlock: null, lastHover: 0, hoverTarget: null }

    /** Skip the plugin's own widgets: they trigger their sounds explicitly. */
    function mcOwnUi(node) {
      return !!(node && node.closest && node.closest('[' + MC_UI_ATTR + ']'))
    }

    function mcHandleClick(event) {
      const settings = mcSettings.get()
      if (!settings.enabled || !settings.sfx.enabled) return
      const target = event.target
      if (!target || !target.closest) return
      if (mcOwnUi(target)) return
      const hit = target.closest(MC_INTERACTIVE) || (event.target.closest && event.target.closest('[contenteditable="true"]'))
      if (!hit) return
      if (hit.disabled || hit.getAttribute('aria-disabled') === 'true') return
      const role = hit.getAttribute('role')
      if (role === 'switch' || role === 'checkbox' || role === 'radio') {
        mcSound('toggle')
        return
      }
      mcSound('click')
    }

    function mcHandlePointerOver(event) {
      const settings = mcSettings.get()
      if (!settings.enabled || !settings.sfx.enabled || settings.sfx.hover !== true) return
      const target = event.target
      if (!target || !target.closest || mcOwnUi(target)) return
      const hit = target.closest('button,[role="button"],[role="menuitem"],[role="tab"]')
      if (!hit || hit === mcSoundState.hoverTarget) return
      const now = Date.now()
      if (now - mcSoundState.lastHover < 140) return
      mcSoundState.lastHover = now
      mcSoundState.hoverTarget = hit
      mcSound('hover')
    }

    function mcUnlockAudio() {
      mcSound('unlock')
    }

    /** Attach the delegated listeners; returns a cleanup function. */
    function mcInstallSound() {
      if (mcSoundState.onClick) return mcWallRemoveSound
      mcSoundState.onClick = mcHandleClick
      mcSoundState.onPointerOver = mcHandlePointerOver
      mcSoundState.onUnlock = mcUnlockAudio
      document.addEventListener('click', mcSoundState.onClick, true)
      document.addEventListener('pointerover', mcSoundState.onPointerOver, true)
      document.addEventListener('pointerdown', mcSoundState.onUnlock, true)
      document.addEventListener('keydown', mcSoundState.onUnlock, true)
      return mcWallRemoveSound
    }

    function mcWallRemoveSound() {
      if (!mcSoundState.onClick) return
      document.removeEventListener('click', mcSoundState.onClick, true)
      document.removeEventListener('pointerover', mcSoundState.onPointerOver, true)
      document.removeEventListener('pointerdown', mcSoundState.onUnlock, true)
      document.removeEventListener('keydown', mcSoundState.onUnlock, true)
      mcSoundState.onClick = null
      mcSoundState.onPointerOver = null
      mcSoundState.onUnlock = null
    }

    /** Push the current volumes and play/stop state into the audio engine. */
    function mcSyncAudio() {
      if (!mcHasAudio()) return
      const settings = mcSettings.get()
      mcSound('setSfxVolume', settings.sfx.volume)
      mcSound('setBgmVolume', settings.bgm.enabled ? settings.bgm.volume : 0)
      const wantBgm = settings.enabled && settings.bgm.enabled
      if (wantBgm) {
        if (!mcSound('isBgmPlaying')) mcSound('playBgmTrack', settings.bgm.trackId || undefined)
      } else if (mcSound('isBgmPlaying')) {
        mcSound('stopBgm')
      }
    }

    /** Switch to the next background-music track (HUD button / options panel). */
    function mcBgmNext() {
      if (!mcHasAudio()) return
      const settings = mcSettings.get()
      const list = mcBgm.items
      let nextId = ''
      if (list.length) {
        const at = list.findIndex(function find(track) {
          return track.id === settings.bgm.trackId
        })
        nextId = list[(at < 0 ? 0 : at + 1) % list.length].id
      }
      mcSound('unlock')
      if (nextId) {
        mcSound('playBgmTrack', nextId)
        mcSettings.patch({ bgm: { enabled: true, trackId: nextId } })
        mcSound('setBgmVolume', settings.bgm.volume)
        mcAchievement('trackOn', mcBgmName(nextId))
        return
      }
      /* Playlist not loaded yet: let the engine advance on its own. */
      mcSound('nextBgmTrack')
      mcAchievement('bgmOn')
    }

    /* --------------------------- scheme watcher -------------------------- */

    const mcScheme = { observer: null, dark: null }

    /** Re-draw everything that depends on the light/dark scheme. */
    function mcSyncScheme(force) {
      const dark = mcIsDark()
      if (!force && dark === mcScheme.dark) return
      mcScheme.dark = dark
      mcApplyPalette()
      mcWallStyle()
      const current = mcSettings.get().wallpaper.sceneId
      if (current) mcWallShow(current)
    }

    function mcInstallSchemeWatcher() {
      if (mcScheme.observer) return function noop() {}
      const callback = function onChange() {
        mcSyncScheme(false)
      }
      const observer = new MutationObserver(callback)
      const attributes = ['data-ds-dark-theme', 'data-ds-theme', 'class', 'style']
      try {
        observer.observe(document.documentElement, { attributes: true, attributeFilter: attributes })
        if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: attributes })
      } catch (_error) {
        /* observation is best-effort */
      }
      mcScheme.observer = observer
      mcScheme.dark = mcIsDark()
      return function disconnect() {
        try {
          observer.disconnect()
        } catch (_error) {
          /* ignore */
        }
        mcScheme.observer = null
      }
    }

    /* ----------------------------- lifecycle ---------------------------- */

    const mcRuntime = {
      started: false,
      unsubSettings: null,
      unsubUsers: null,
      unsubPhotos: null,
      unsubMusic: null,
      removeSound: null,
      disposeScheme: null,
      onResize: null,
      onVisibility: null,
      unsubToasts: null,
    }

    /** Stop the wallpaper rotation and the particles so idle CPU stays at zero. */
    function mcRuntimeSleep() {
      mcWallStopTimer()
      mcParticlesStop()
    }

    /** Re-apply every runtime surface from the current options. */
    function mcRuntimeSync(reason) {
      const settings = mcSettings.get()

      /* The console is shifted down by a constant, user-tunable amount so that
         expanding or collapsing its panel never moves the button itself. */
      const rootElement = document.documentElement
      if (rootElement) {
        const drop = Math.round(mcClamp(settings.ui.hudDrop, 0, 240))
        rootElement.style.setProperty('--mc-hud-drop', drop + 'px')
      }

      if (!settings.enabled) {
        mcRuntimeSleep()
        if (mcWall.layer) mcWall.layer.classList.add('is-off')
        mcWallClearHtml()
        mcSound('stopBgm')
        return
      }

      if (mcWall.layer) {
        /* Coming back from "theme off": force a repaint so <html> gets its
           background again (mcWallShow() would otherwise short-circuit). */
        if (mcWall.layer.classList.contains('is-off')) mcWall.scene = null
        mcWall.layer.classList.remove('is-off')
      }
      const sceneId = settings.wallpaper.sceneId
      if (sceneId) mcWallShow(sceneId)
      mcWallStyle()
      mcWallArmTimer()

      if (settings.wallpaper.particles) mcParticlesStart()
      else mcParticlesStop()

      mcSyncAudio()
      if (reason === 'init') mcInstallSound()
    }

    /** Mount the runtime: layer, listeners, watchers, then a first sync. */
    function mcRuntimeStart() {
      if (mcRuntime.started) {
        mcRuntimeSync('sync')
        return
      }
      mcRuntime.started = true
      mcWallMountLayer()
      mcInstallSound()
      mcHudAnchorStart()
      mcLoadBgmLibrary()
        .then(function onPlaylist() {
          /* The folder playlist is known: merge the uploaded tracks in. */
          if (mcRuntime.started) mcSyncUserMusic()
        })
        .catch(function onPlaylistError(error) {
          console.warn('[minecraft-ui] background music library failed to load', error)
        })
      mcLoadPhotoLibrary()
      mcRuntime.disposeScheme = mcInstallSchemeWatcher()
      mcRuntime.onResize = function handleResize() {
        if (mcParticles.canvas) {
          mcParticlesResize()
          mcParticles.motes = mcParticleSeed(26)
        }
      }
      mcRuntime.onVisibility = function handleVisibility() {
        if (document.hidden) {
          mcWallStopTimer()
          mcParticlesStop()
        } else {
          mcRuntimeSync('resume')
        }
      }
      window.addEventListener('resize', mcRuntime.onResize)
      document.addEventListener('visibilitychange', mcRuntime.onVisibility)
      mcRuntime.unsubSettings = mcSettings.subscribe(function onSettings(next) {
        mcApplyPalette()
        mcRuntimeSync('change')
      })
      mcRuntimeSync('init')

      /* Imported wallpapers live in IndexedDB and load asynchronously: once they
         are known, repaint the active scene (it may have been an unknown id a
         moment ago) and re-arm the rotation timer with the new list. */
      try {
        if (typeof mcUserRefresh !== 'function') return
        mcUserRefresh()
          .then(function onUserWallpapers() {
            if (!mcRuntime.started) return
            const current = mcSettings.get().wallpaper.sceneId
            if (current) {
              mcWall.scene = null
              mcWallShow(current, true)
            }
            mcWallArmTimer()
          })
          .catch(function onUserError(error) {
            console.warn('[minecraft-ui] user wallpaper library failed to load', error)
          })
        if (typeof mcUserWallpapers === 'object' && mcUserWallpapers && typeof mcUserWallpapers.subscribe === 'function') {
          mcRuntime.unsubUsers = mcUserWallpapers.subscribe(function onUserLibrary() {
            if (!mcRuntime.started) return
            const settings = mcSettings.get()
            const current = settings.wallpaper.sceneId
            /* The wallpaper the user just deleted: fall back to a pixel scene. */
            if (current && typeof mcUserFind === 'function' && current.indexOf('user-') === 0 && !mcUserFind(current)) {
              mcWallSelect(MC_FALLBACK_SCENE, { silent: true })
              return
            }
            if (current) mcWallShow(current, true)
            mcWallArmTimer()
          })
        }
      } catch (error) {
        console.warn('[minecraft-ui] user wallpaper library unavailable', error)
      }

      /* The wallpaper catalogue comes over HTTP: repaint once it is known, and
         follow later changes (the user drops new files into the folder). */
      try {
        if (typeof mcSubscribePhotos === 'function') {
          mcRuntime.unsubPhotos = mcSubscribePhotos(function onPhotos() {
            if (mcRuntime.started) mcWallResync()
          })
        }
        if (typeof mcLoadPhotoLibrary === 'function') {
          mcLoadPhotoLibrary().then(function onCatalogue() {
            if (mcRuntime.started) mcWallResync()
          })
        }
      } catch (error) {
        console.warn('[minecraft-ui] wallpaper catalogue unavailable', error)
      }

      /* Uploaded background music lives in IndexedDB as well. */
      try {
        if (typeof mcUserMusic === 'object' && mcUserMusic && typeof mcUserMusic.subscribe === 'function') {
          mcRuntime.unsubMusic = mcUserMusic.subscribe(function onUserMusic() {
            if (mcRuntime.started) mcSyncUserMusic()
          })
        }
        mcRefreshUserMusic()
      } catch (error) {
        console.warn('[minecraft-ui] user music library unavailable', error)
      }
    }

    /** Tear everything down (used by the plugin's dispose path). */
    function mcRuntimeStop() {
      if (!mcRuntime.started) return
      mcRuntime.started = false
      mcRuntimeSleep()
      if (mcRuntime.unsubSettings) mcRuntime.unsubSettings()
      mcRuntime.unsubSettings = null
      if (mcRuntime.unsubUsers) mcRuntime.unsubUsers()
      mcRuntime.unsubUsers = null
      if (mcRuntime.unsubPhotos) mcRuntime.unsubPhotos()
      mcRuntime.unsubPhotos = null
      if (mcRuntime.unsubMusic) mcRuntime.unsubMusic()
      mcRuntime.unsubMusic = null
      if (mcRuntime.removeSound) mcRuntime.removeSound()
      mcWallRemoveSound()
      if (mcRuntime.disposeScheme) mcRuntime.disposeScheme()
      mcRuntime.disposeScheme = null
      mcHudAnchorStop()
      if (mcRuntime.onResize) window.removeEventListener('resize', mcRuntime.onResize)
      if (mcRuntime.onVisibility) document.removeEventListener('visibilitychange', mcRuntime.onVisibility)
      mcRuntime.onResize = null
      mcRuntime.onVisibility = null
      if (mcWall.layer && mcWall.layer.parentNode) mcWall.layer.parentNode.removeChild(mcWall.layer)
      mcWall.layer = null
      mcWallClearHtml()
      mcWall.panes.a = null
      mcWall.panes.b = null
      mcWall.scrim = null
      mcWall.scene = null
      mcWallStopTimer()
      mcParticlesStop()
      if (mcParticles.canvas && mcParticles.canvas.parentNode) mcParticles.canvas.parentNode.removeChild(mcParticles.canvas)
      mcParticles.canvas = null
      if (mcHasAudio()) {
        mcSound('stopBgm')
      }
      if (document.documentElement) document.documentElement.style.removeProperty('--mc-hud-drop')
    }

/* ---- src/50-ui.js ---- */

    /* ------------------------------------------------------------------ *
     * 6. React widgets
     *
     * Everything the plugin paints itself: the floating console (HUD), the
     * wallpaper library dialog, the options sheet, the settings page and the
     * advancement toasts. Plain createElement — the bundle has no JSX step.
     * ------------------------------------------------------------------ */

    /** Subscribe to the options store. */
    function useMcSettings() {
      const [snapshot, setSnapshot] = React.useState(function init() {
        return mcSettings.get()
      })
      React.useEffect(function subscribe() {
        return mcSettings.subscribe(function onChange(next) {
          setSnapshot(next)
        })
      }, [])
      return snapshot
    }

    /** Subscribe to the toast bus. */
    function useMcToasts() {
      const [items, setItems] = React.useState(function init() {
        return []
      })
      React.useEffect(function subscribe() {
        return mcToasts.subscribe(function onChange(next) {
          setItems(next)
        })
      }, [])
      return items
    }

    /** Subscribe to the user's imported wallpaper library. */
    function useMcUserWallpapers() {
      const [state, setState] = React.useState(function init() {
        return typeof mcUserWallpapers === 'object' && mcUserWallpapers
          ? mcUserWallpapers.snapshot()
          : { items: [], ready: true, error: '' }
      })
      React.useEffect(function subscribe() {
        if (typeof mcUserWallpapers !== 'object' || !mcUserWallpapers) return undefined
        const unsubscribe = mcUserWallpapers.subscribe(function onChange(next) {
          setState({ items: next.items.slice(), ready: next.ready, error: next.error })
        })
        if (!mcUserWallpapers.ready) mcUserRefresh()
        return unsubscribe
      }, [])
      return state
    }

    /** Subscribe to the background-music playlist. */
    function useMcBgmTracks() {
      const [state, setState] = React.useState(function init() {
        return { items: mcBgm.items.slice(), ready: mcBgm.ready, error: mcBgm.error }
      })
      React.useEffect(function subscribe() {
        const unsubscribe = mcSubscribeBgm(function onChange(next) {
          setState({ items: next.items.slice(), ready: next.ready, error: next.error })
        })
        mcLoadBgmLibrary()
        return unsubscribe
      }, [])
      return state
    }

    /** Subscribe to the wallpaper catalogue served by the host half. */
    function useMcPhotoLibrary() {
      const [state, setState] = React.useState(function init() {
        if (typeof mcPhotoLibrary !== 'object' || !mcPhotoLibrary) return { items: [], ready: true, error: '' }
        return { items: mcPhotoLibrary.items.slice(), ready: mcPhotoLibrary.ready, error: mcPhotoLibrary.error }
      })
      React.useEffect(function subscribe() {
        if (typeof mcPhotoLibrary !== 'object' || !mcPhotoLibrary) return undefined
        const unsubscribe = mcSubscribePhotos(function onChange(next) {
          setState({ items: next.items.slice(), ready: next.ready, error: next.error })
        })
        if (!mcPhotoLibrary.ready) mcLoadPhotoLibrary()
        return unsubscribe
      }, [])
      return state
    }

    /** Subscribe to the locally uploaded music library. */
    function useMcUserMusic() {
      const [state, setState] = React.useState(function init() {
        return typeof mcUserMusic === 'object' && mcUserMusic
          ? mcUserMusic.snapshot()
          : { items: [], ready: true, error: '' }
      })
      React.useEffect(function subscribe() {
        if (typeof mcUserMusic !== 'object' || !mcUserMusic) return undefined
        const unsubscribe = mcUserMusic.subscribe(function onChange(next) {
          setState({ items: next.items.slice(), ready: next.ready, error: next.error })
        })
        if (!mcUserMusic.ready) mcRefreshUserMusic()
        return unsubscribe
      }, [])
      return state
    }

    /* ------------------------------ icons ------------------------------- */

    /** 12脳12 pixel glyphs; '#' paints with the icon colour, letters use `colors`. */
    const MC_ICONS = {
      block: [
        '............',
        '.##########.',
        '.#gggggggg#.',
        '.#gGgggggg#.',
        '.#dddddddd#.',
        '.#dd#dd#dd#.',
        '.#dddddddd#.',
        '.#dd#dd#dd#.',
        '.#dddddddd#.',
        '.#dddddddd#.',
        '.##########.',
        '............',
      ],
      image: [
        '............',
        '.##########.',
        '.#........#.',
        '.#..####..#.',
        '.#.####...#.',
        '.#........#.',
        '.#...##...#.',
        '.#..####..#.',
        '.#........#.',
        '.##########.',
        '............',
        '............',
      ],
      sound: [
        '............',
        '....#.......',
        '...##...#...',
        '..###..#.#..',
        '..###..#.#..',
        '..###..#.#..',
        '..###..#.#..',
        '...##...#...',
        '....#.......',
        '............',
        '............',
        '............',
      ],
      music: [
        '............',
        '....####....',
        '....#..#....',
        '....#..#....',
        '....#.......',
        '....#.......',
        '..#.#.......',
        '.###........',
        '.###........',
        '..#.........',
        '............',
        '............',
      ],
      wind: [
        '............',
        '............',
        '.#######....',
        '............',
        '......#####.',
        '............',
        '..######....',
        '............',
        '....####....',
        '............',
        '............',
        '............',
      ],
      sliders: [
        '............',
        '.....##.....',
        '.##########.',
        '.....##.....',
        '............',
        '..###.......',
        '.##########.',
        '..###.......',
        '............',
        '.......###..',
        '.##########.',
        '.......###..',
      ],
      close: [
        '............',
        '..#......#..',
        '...#....#...',
        '....####....',
        '.....##.....',
        '....####....',
        '...#....#...',
        '..#......#..',
        '............',
        '............',
        '............',
        '............',
      ],
      next: [
        '............',
        '....#.......',
        '....##......',
        '....###.....',
        '....####....',
        '....#####...',
        '....####....',
        '....###.....',
        '....##......',
        '....#.......',
        '............',
        '............',
      ],
      chevron: [
        '............',
        '............',
        '..#......#..',
        '...#....#...',
        '....#..#....',
        '.....##.....',
        '............',
        '............',
        '............',
        '............',
        '............',
        '............',
      ],
      check: [
        '............',
        '..........#.',
        '.........##.',
        '........##..',
        '.#.....##...',
        '.##...##....',
        '..##.##.....',
        '...###......',
        '....#.......',
        '............',
        '............',
        '............',
      ],
      plus: [
        '............',
        '............',
        '.....##.....',
        '.....##.....',
        '.....##.....',
        '.##########.',
        '.##########.',
        '.....##.....',
        '.....##.....',
        '.....##.....',
        '............',
        '............',
      ],
      trash: [
        '............',
        '....####....',
        '.##########.',
        '............',
        '..########..',
        '..#.#..#.#..',
        '..#.#..#.#..',
        '..#.#..#.#..',
        '..#.#..#.#..',
        '..########..',
        '............',
        '............',
      ],
      eye: [
        '............',
        '............',
        '...######...',
        '.##......##.',
        '#...####...#',
        '#..##..##..#',
        '#..##..##..#',
        '#...####...#',
        '.##......##.',
        '...######...',
        '............',
        '............',
      ],
    }

    const MC_ICON_COLORS = {
      g: '#5f9c3a',
      G: '#7bbb52',
      d: '#7a5a3c',
    }

    /** Rasterise one 12脳12 glyph into an SVG made of pixel rects. */
    function McIcon(props) {
      const name = props.name
      const size = props.size || 18
      const rows = MC_ICONS[name] || MC_ICONS.block
      const color = props.color || 'currentColor'
      const rects = []
      for (let y = 0; y < rows.length; y += 1) {
        const row = rows[y]
        for (let x = 0; x < row.length; x += 1) {
          const cell = row.charAt(x)
          if (cell === '.' || cell === ' ') continue
          const fill = cell === '#' ? color : MC_ICON_COLORS[cell] || color
          rects.push(h('rect', { key: x + '-' + y, x: x, y: y, width: 1, height: 1, fill: fill }))
        }
      }
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 12 12',
          'aria-hidden': 'true',
          focusable: 'false',
          style: { shapeRendering: 'crispEdges', display: 'block' },
        },
        rects
      )
    }

    /* --------------------------- small controls -------------------------- */

    function McToggle(props) {
      const on = !!props.value
      return h(
        'button',
        {
          type: 'button',
          role: 'switch',
          'aria-checked': on ? 'true' : 'false',
          className: 'mcu-toggle',
          onClick: function onClick() {
            if (props.silent !== true) mcSound('toggle')
            props.onChange(!on)
          },
          title: props.title || undefined,
        },
        h('span', { className: 'mcu-toggle__dot' }),
        h('span', null, on ? mcT('common.on') : mcT('common.off'))
      )
    }

    function McRange(props) {
      return h(
        'div',
        { className: 'mcu-row__control' },
        h('input', {
          type: 'range',
          className: 'mcu-range',
          min: props.min === undefined ? 0 : props.min,
          max: props.max === undefined ? 1 : props.max,
          step: props.step === undefined ? 0.01 : props.step,
          value: props.value,
          'aria-label': props.label || mcT('tip.volume'),
          onChange: function onChange(event) {
            props.onChange(Number(event.target.value))
          },
        }),
        h('span', { className: 'mcu-fine', style: { minWidth: '38px', textAlign: 'right' } }, props.display || '')
      )
    }

    function McRow(props) {
      return h(
        'div',
        { className: 'mcu-row' + (props.stack ? ' mcu-row--stack' : '') },
        h(
          'div',
          { className: 'mcu-row__label' },
          h('span', { className: 'mcu-row__name' }, props.name),
          props.hint ? h('span', { className: 'mcu-row__hint' }, props.hint) : null
        ),
        props.children
      )
    }

    function McSection(props) {
      return h(
        'section',
        { className: 'mcu-section' },
        h('h3', { className: 'mcu-section__title' }, props.title),
        props.children
      )
    }

    /** Percentage label for a 0..1 volume. */
    function mcPercent(value) {
      return Math.round(mcClamp(value, 0, 1) * 100) + '%'
    }

    /* ------------------------------ dialogs ------------------------------ */

    function McDialog(props) {
      const onClose = props.onClose
      React.useEffect(
        function escapeKey() {
          function onKeyDown(event) {
            if (event.key === 'Escape') {
              event.stopPropagation()
              onClose()
            }
          }
          document.addEventListener('keydown', onKeyDown, true)
          return function cleanup() {
            document.removeEventListener('keydown', onKeyDown, true)
          }
        },
        [onClose]
      )
      const className =
        'mcu-dialog' + (props.wide ? ' mcu-dialog--wide' : '') + (props.sheet ? ' mcu-dialog--sheet' : '')
      return h(
        'div',
        {
          className: 'mcu-overlay',
          'data-mc-ui': 'dialog',
          onMouseDown: function onMouseDown(event) {
            if (event.target === event.currentTarget) onClose()
          },
        },
        h(
          'div',
          { className: className, role: 'dialog', 'aria-modal': 'true', 'aria-label': props.title },
          h(
            'div',
            { className: 'mcu-dialog__head' },
            h('h2', null, props.title),
            h(
              'button',
              {
                type: 'button',
                className: 'mcu-iconbtn',
                onClick: onClose,
                title: mcT('common.close'),
                'aria-label': mcT('common.close'),
              },
              h(McIcon, { name: 'close', size: 14 })
            )
          ),
          h('div', { className: 'mcu-dialog__body' }, props.children)
        )
      )
    }

    /* ---------------------------- music playlist ------------------------- */

    /* ---------------------------- file picker --------------------------- */

    /** Open the OS file picker through a transient <input type=file>. */
    function mcPickFiles(accept, multiple, onFiles) {
      let input = null
      const cleanup = function cleanup() {
        if (input && input.parentNode) input.parentNode.removeChild(input)
        window.removeEventListener('focus', onFocus)
      }
      const onFocus = function onFocus() {
        window.setTimeout(cleanup, 300)
      }
      input = document.createElement('input')
      input.type = 'file'
      if (accept) input.accept = accept
      input.multiple = multiple !== false
      input.style.display = 'none'
      input.addEventListener('change', function onChange() {
        const files = input.files
        cleanup()
        if (files && files.length) onFiles(files)
      })
      document.body.appendChild(input)
      window.addEventListener('focus', onFocus)
      mcSound('open')
      input.click()
    }

    /* ---------------------------- user music ---------------------------- */

    /** Import picked audio files into the local library. */
    function mcImportUserMusic(files) {
      if (typeof mcUserMusicAddFiles !== 'function') {
        mcAchievement('wallpaperFailed', mcT('bgm.uploadFailed'))
        return
      }
      mcUserMusicAddFiles(files)
        .then(function onAdded(ids) {
          if (!ids || !ids.length) {
            mcAchievement('wallpaperFailed', mcT('bgm.uploadFailed'))
            return
          }
          const item = typeof mcUserMusicFind === 'function' ? mcUserMusicFind(ids[0]) : null
          mcSound('success')
          mcAchievement('trackAdded', ids.length > 1 ? String(ids.length) : item ? item.name : '')
        })
        .catch(function onError(error) {
          console.warn('[minecraft-ui] music import failed', error)
          mcAchievement('wallpaperFailed', mcT('bgm.uploadFailed'))
        })
    }

    /** Delete one uploaded track (the runtime re-picks a track if it was playing). */
    function mcRemoveUserMusic(id) {
      if (typeof mcUserMusicRemove !== 'function') return
      const item = typeof mcUserMusicFind === 'function' ? mcUserMusicFind(id) : null
      mcUserMusicRemove(id)
        .then(function onRemoved() {
          mcSound('close')
          mcAchievement('trackRemoved', item ? item.name : '')
        })
        .catch(function onError(error) {
          console.warn('[minecraft-ui] music delete failed', error)
          mcAchievement('wallpaperFailed', mcT('bgm.uploadFailed'))
        })
    }

    /**
     * Local music library: one chip per uploaded track (name + delete) and an
     * upload button. The playlist selector above already lists these tracks;
     * this row is where they are managed, mirroring the wallpaper library.
     */
    function McUserMusicLibrary(props) {
      const library = props.library || { items: [], error: '' }
      const items = Array.isArray(library.items) ? library.items : []
      const children = items.map(function chip(item) {
        return h(
          'span',
          { key: item.id, className: 'mcu-chip' },
          h('span', { className: 'mcu-chip__name', title: item.name }, item.name),
          h(
            'button',
            {
              type: 'button',
              className: 'mcu-chip__del',
              title: mcT('bgm.delete'),
              'aria-label': mcT('bgm.delete') + ' ' + item.name,
              onClick: function onClick(event) {
                event.preventDefault()
                event.stopPropagation()
                mcRemoveUserMusic(item.id)
              },
            },
            h(McIcon, { name: 'trash', size: 12 })
          )
        )
      })
      children.push(
        h(
          'button',
          {
            key: '__upload',
            type: 'button',
            className: 'mcu-textbtn',
            onClick: function onClick() {
              mcPickFiles('audio/*', true, mcImportUserMusic)
            },
          },
          h(McIcon, { name: 'plus', size: 14 }),
          mcT('bgm.upload')
        )
      )
      return h('div', { className: 'mcu-chips' }, children)
    }

    /**
     * Playlist selector: one button per track, folder files first and locally
     * uploaded music after them. Selecting a track turns BGM on and remembers
     * the choice in the options store.
     */
    function McBgmPicker(props) {
      const tracks = props.tracks && Array.isArray(props.tracks.items) ? props.tracks.items : []
      const ready = props.tracks ? props.tracks.ready : true
      const current = props.current
      if (!tracks.length) {
        let text = ''
        if (!ready) text = mcT('bgm.loading')
        else if (props.tracks && props.tracks.error === 'audio') text = mcT('bgm.empty')
        else text = mcT('bgm.empty')
        return h('p', { className: 'mcu-fine' }, text)
      }
      return h(
        'div',
        { className: 'mcu-seg mcu-seg--wrap' },
        tracks.map(function track(entry) {
          return h(
            'button',
            {
              key: entry.id,
              type: 'button',
              className: 'mcu-textbtn',
              'aria-pressed': current === entry.id ? 'true' : 'false',
              title: (entry.source === 'user' ? mcT('bgm.mine') + ' · ' : '') + (entry.name || entry.id),
              onClick: function onClick() {
                mcSound('click')
                mcSettings.patch({ bgm: { enabled: true, trackId: entry.id } })
                mcSyncAudio()
                mcAchievement('trackOn', entry.name || entry.id)
              },
            },
            entry.name || entry.id
          )
        })
      )
    }

    /* -------------------------- wallpaper library ------------------------ */

    /** Import the picked files, then switch to the first one. */
    function mcImportUserWallpapers(files) {
      mcUserAddFiles(files)
        .then(function onAdded(ids) {
          if (!ids || !ids.length) {
            mcAchievement('wallpaperFailed', mcT('wall.uploadFailed'))
            return
          }
          const item = mcUserFind(ids[0])
          mcSound('success')
          mcAchievement('wallpaperAdded', ids.length > 1 ? String(ids.length) : item ? item.name : '')
          mcWallSelect(ids[0])
        })
        .catch(function onError(error) {
          console.warn('[minecraft-ui] wallpaper import failed', error)
          mcAchievement('wallpaperFailed', mcT('wall.uploadFailed'))
        })
    }

    /** Delete one imported wallpaper (the runtime switches away if it was active). */
    function mcRemoveUserWallpaper(id) {
      const item = mcUserFind(id)
      mcUserRemove(id)
        .then(function onRemoved() {
          mcSound('close')
          mcAchievement('wallpaperRemoved', item ? item.name : '')
        })
        .catch(function onError(error) {
          console.warn('[minecraft-ui] wallpaper delete failed', error)
          mcAchievement('wallpaperFailed', mcT('wall.uploadFailed'))
        })
    }

    function McWallpaperPicker(props) {
      const settings = useMcSettings()
      const userLibrary = useMcUserWallpapers()
      const photosLibrary = useMcPhotoLibrary()
      const wallpaper = settings.wallpaper
      const scenes = mcScenes()
      const intervals = [60, 180, 300, 600, 1800]

      const userScenes = scenes.filter(function onlyUser(scene) {
        return scene.kind === 'user'
      })
      const photos = scenes.filter(function onlyPhotos(scene) {
        return scene.kind === 'photo'
      })

      function makeSlot(scene) {
        /* Imported wallpapers show their own 480px thumbnail; the bundled
           photographs are pre-scaled files served by the host half. */
        let url = ''
        if (scene.kind === 'user' && typeof mcUserUrl === 'function') url = mcUserUrl(scene.id, true)
        else if (typeof mcPhotoUrl === 'function') url = mcPhotoUrl(scene.id, true)
        const active = scene.id === wallpaper.sceneId
        const tile = h(
          'button',
          {
            key: scene.id,
            type: 'button',
            className: 'mcu-slot mcu-slot--photo',
            'aria-pressed': active ? 'true' : 'false',
            title: scene.desc || scene.name,
            onClick: function onClick() {
              if (active) return
              mcSound('open')
              mcWallSelect(scene.id)
            },
          },
          url ? h('img', { src: url, alt: scene.name, loading: 'lazy', draggable: 'false' }) : null,
          h('span', { className: 'mcu-slot__name' }, scene.name)
        )
        if (scene.kind !== 'user') return tile
        /* Imported wallpapers get a delete button; a <button> cannot nest in a
           <button>, so the tile and the delete control are siblings. */
        return h(
          'div',
          { key: scene.id, className: 'mcu-slotwrap' },
          tile,
          h(
            'button',
            {
              type: 'button',
              className: 'mcu-slot__del',
              title: mcT('wall.delete'),
              'aria-label': mcT('wall.delete') + ' ' + scene.name,
              onClick: function onClick(event) {
                event.preventDefault()
                event.stopPropagation()
                mcRemoveUserWallpaper(scene.id)
              },
            },
            h(McIcon, { name: 'trash', size: 12 })
          )
        )
      }

      /** Open the OS file picker for new wallpaper images. */
      function chooseFiles() {
        mcPickFiles('image/*', true, mcImportUserWallpapers)
      }

      const groups = []
      groups.push(
        h(
          McSection,
          { key: 'user', title: mcT('wall.mine') },
          h(
            'div',
            { className: 'mcu-grid' },
            userScenes.map(makeSlot),
            h(
              'button',
              {
                key: 'upload',
                type: 'button',
                className: 'mcu-slot mcu-slot--add',
                title: mcT('wall.upload'),
                onClick: chooseFiles,
              },
              h(McIcon, { name: 'plus', size: 22 }),
              h('span', { className: 'mcu-slot__name' }, mcT('wall.upload'))
            )
          ),
          h(
            'p',
            { className: 'mcu-fine' },
            userLibrary.error ? mcT('wall.mineError') : mcT('wall.mineHint')
          )
        )
      )
      if (photos.length) {
        groups.push(
          h(
            McSection,
            { key: 'photos', title: mcT('wall.photos') },
            h('div', { className: 'mcu-grid' }, photos.map(makeSlot)),
            h(
              'div',
              { className: 'mcu-row__control' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'mcu-textbtn is-ghost',
                  onClick: function onClick() {
                    mcSound('click')
                    mcPhotoRefresh().then(function onDone() {
                      mcWallResync()
                    })
                  },
                },
                mcT('wall.refresh')
              )
            )
          )
        )
      }
      if (!photos.length && !userScenes.length) {
        groups.push(
          h(
            'div',
            { key: 'empty', className: 'mcu-fine' },
            photosLibrary.ready ? mcT('wall.empty') : mcT('bgm.loading')
          )
        )
      }

      return h(
        McDialog,
        { title: mcT('wall.library'), onClose: props.onClose, wide: true },
        h(
          McSection,
          { title: mcT('wall.title') },
          h(
            McRow,
            {
              name: mcT('wall.auto'),
              hint: mcT('wall.current') + ': ' + mcSceneName(wallpaper.sceneId),
            },
            h(
              'div',
              { className: 'mcu-row__control' },
              h(McToggle, {
                value: wallpaper.auto,
                title: mcT('wall.auto'),
                onChange: function onChange(next) {
                  mcSettings.patch({ wallpaper: { auto: next } })
                },
              }),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mcu-textbtn',
                  onClick: function onClick() {
                    mcSound('click')
                    const next = mcWallNextScene(1)
                    if (next) mcWallSelect(next)
                    mcWallArmTimer()
                  },
                },
                mcT('wall.next'),
                h(McIcon, { name: 'next', size: 14 })
              )
            )
          ),
          h(
            McRow,
            { name: mcT('wall.interval'), stack: true },
            h(
              'div',
              { className: 'mcu-seg' },
              intervals.map(function option(seconds) {
                const label = seconds < 60 ? seconds + 's' : Math.round(seconds / 60) + 'm'
                return h(
                  'button',
                  {
                    key: seconds,
                    type: 'button',
                    className: 'mcu-textbtn',
                    'aria-pressed': wallpaper.intervalSec === seconds ? 'true' : 'false',
                    onClick: function onClick() {
                      mcSound('click')
                      mcSettings.patch({ wallpaper: { intervalSec: seconds } })
                      mcWallArmTimer()
                    },
                  },
                  label
                )
              })
            )
          ),
          h(
            McRow,
            { name: mcT('wall.dim'), stack: true },
            h(McRange, {
              value: wallpaper.dim,
              min: 0,
              max: 0.35,
              step: 0.01,
              display: mcPercent(wallpaper.dim),
              onChange: function onChange(value) {
                mcSettings.patch({ wallpaper: { dim: value } })
                mcWallStyle()
              },
            })
          ),
          h(
            McRow,
            { name: mcT('wall.gain'), hint: mcT('wall.gainHint'), stack: true },
            h(McRange, {
              value: wallpaper.gain,
              min: 0.7,
              max: 1.6,
              step: 0.01,
              display: Math.round(wallpaper.gain * 100) + '%',
              onChange: function onChange(value) {
                mcSettings.patch({ wallpaper: { gain: value } })
                mcWallStyle()
              },
            })
          ),
          h(
            McRow,
            { name: mcT('wall.particles') },
            h(McToggle, {
              value: wallpaper.particles,
              onChange: function onChange(next) {
                mcSettings.patch({ wallpaper: { particles: next } })
              },
            })
          )
        ),
        groups
      )
    }

    /* ---------------------------- options sheet --------------------------- */

    function McOptionsContent() {
      const settings = useMcSettings()
      const wallpaper = settings.wallpaper
      const sfx = settings.sfx
      const bgm = settings.bgm
      const bgmTracks = useMcBgmTracks()
      const userMusic = useMcUserMusic()
      const ui = settings.ui

      return h(
        'div',
        { className: 'mcu-sheet' },
        h(
          McSection,
          { title: mcT('ui.title') },
          h(
            McRow,
            { name: mcT('hud.toggle'), hint: 'Ctrl/⌘ + Alt + M' },
            h(McToggle, {
              value: settings.enabled,
              onChange: function onChange(next) {
                mcSettings.patch({ enabled: next })
                if (next) mcSound('levelUp')
                mcAchievement(next ? 'themeOn' : 'themeOff')
                mcSyncAudio()
              },
            })
          ),
          h(
            McRow,
            { name: mcT('ui.glass'), hint: mcT('ui.glassHint'), stack: true },
            h(McRange, {
              value: ui.glass,
              min: 0,
              max: 1,
              step: 0.01,
              display: mcPercent(ui.glass),
              onChange: function onChange(value) {
                mcSettings.patch({ ui: { glass: value } })
              },
            })
          ),
          h(
            McRow,
            { name: mcT('ui.achievements') },
            h(McToggle, {
              value: ui.achievements,
              onChange: function onChange(next) {
                mcSettings.patch({ ui: { achievements: next } })
              },
            })
          ),
          h(
            McRow,
            { name: mcT('ui.hud'), hint: mcT('ui.hudHint') },
            h(McToggle, {
              value: !ui.hudHidden,
              onChange: function onChange(next) {
                mcSettings.patch({ ui: { hudHidden: !next } })
              },
            })
          )
        ),
        h(
          McSection,
          { title: mcT('wall.title') },
          h(
            McRow,
            {
              name: mcT('wall.auto'),
              hint: mcT('wall.current') + ': ' + mcSceneName(wallpaper.sceneId),
            },
            h(
              'div',
              { className: 'mcu-row__control' },
              h(McToggle, {
                value: wallpaper.auto,
                onChange: function onChange(next) {
                  mcSettings.patch({ wallpaper: { auto: next } })
                  mcWallArmTimer()
                },
              }),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mcu-textbtn',
                  onClick: function onClick() {
                    mcSound('open')
                    props_openWallpaper()
                  },
                },
                mcT('wall.library')
              )
            )
          ),
          h(
            McRow,
            { name: mcT('wall.dim'), stack: true },
            h(McRange, {
              value: wallpaper.dim,
              min: 0,
              max: 0.35,
              step: 0.01,
              display: mcPercent(wallpaper.dim),
              onChange: function onChange(value) {
                mcSettings.patch({ wallpaper: { dim: value } })
                mcWallStyle()
              },
            })
          ),
          h(
            McRow,
            { name: mcT('wall.gain'), hint: mcT('wall.gainHint'), stack: true },
            h(McRange, {
              value: wallpaper.gain,
              min: 0.7,
              max: 1.6,
              step: 0.01,
              display: Math.round(wallpaper.gain * 100) + '%',
              onChange: function onChange(value) {
                mcSettings.patch({ wallpaper: { gain: value } })
                mcWallStyle()
              },
            })
          ),
          h(
            McRow,
            { name: mcT('wall.particles') },
            h(McToggle, {
              value: wallpaper.particles,
              onChange: function onChange(next) {
                mcSettings.patch({ wallpaper: { particles: next } })
              },
            })
          )
        ),
        h(
          McSection,
          { title: mcT('sound.title') },
          h(
            McRow,
            { name: mcT('sound.enable') },
            h(
              'div',
              { className: 'mcu-row__control' },
              h(McToggle, {
                value: sfx.enabled,
                onChange: function onChange(next) {
                  mcSettings.patch({ sfx: { enabled: next } })
                  if (next) mcSound('click')
                  mcAchievement(next ? 'soundOn' : 'soundOff')
                },
              }),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mcu-textbtn is-ghost',
                  onClick: function onClick() {
                    mcSound('unlock')
                    mcSound('click')
                  },
                },
                '试听'
              )
            )
          ),
          h(
            McRow,
            { name: mcT('sound.volume'), stack: true },
            h(McRange, {
              value: sfx.volume,
              min: 0,
              max: 1,
              step: 0.01,
              display: mcPercent(sfx.volume),
              onChange: function onChange(value) {
                mcSettings.patch({ sfx: { volume: value } })
                mcSyncAudio()
              },
            })
          )
        ),
        h(
          McSection,
          { title: mcT('bgm.title') },
          h(
            McRow,
            { name: mcT('bgm.enable') },
            h(McToggle, {
              value: bgm.enabled,
              onChange: function onChange(next) {
                mcSettings.patch({ bgm: { enabled: next } })
                mcSound('unlock')
                mcSyncAudio()
                mcAchievement(next ? 'bgmOn' : 'bgmOff')
              },
            })
          ),
          h(
            McRow,
            { name: mcT('bgm.track'), hint: mcT('bgm.trackHint'), stack: true },
            h(McBgmPicker, { tracks: bgmTracks, current: bgm.trackId, enabled: bgm.enabled })
          ),
          h(
            McRow,
            {
              name: mcT('bgm.mine'),
              hint: userMusic.error ? mcT('bgm.mineError') : mcT('bgm.mineHint'),
              stack: true,
            },
            h(McUserMusicLibrary, { library: userMusic })
          ),
          h(
            McRow,
            { name: mcT('bgm.volume'), stack: true },
            h(McRange, {
              value: bgm.volume,
              min: 0,
              max: 1,
              step: 0.01,
              display: mcPercent(bgm.volume),
              onChange: function onChange(value) {
                mcSettings.patch({ bgm: { volume: value } })
                mcSyncAudio()
              },
            })
          ),
          h(
            McRow,
            { name: mcT('bgm.next') },
            h(
              'button',
              {
                type: 'button',
                className: 'mcu-textbtn',
                onClick: function onClick() {
                  mcSound('click')
                  mcBgmNext()
                  mcSyncAudio()
                },
              },
              mcT('bgm.next'),
              h(McIcon, { name: 'next', size: 14 })
            )
          )
        ),
        h(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', gap: '8px' } },
          h(
            'button',
            {
              type: 'button',
              className: 'mcu-textbtn is-ghost',
              onClick: function onClick() {
                mcSound('error')
                mcSettings.reset()
                mcSyncAudio()
                mcWallArmTimer()
                mcApplyPalette()
              },
            },
            mcT('common.reset')
          ),
          h('span', { className: 'mcu-fine', style: { alignSelf: 'center' } }, mcHasAudio() ? 'WebAudio' : 'no audio')
        )
      )
    }

    /** Set by the HUD so the options sheet can open the wallpaper library. */
    let mcOpenWallpaperPicker = null

    function props_openWallpaper() {
      if (typeof mcOpenWallpaperPicker === 'function') mcOpenWallpaperPicker()
    }

    function McOptionsDialog(props) {
      return h(
        McDialog,
        { title: mcT('hud.options'), onClose: props.onClose },
        h(McOptionsContent, null),
        h(
          'div',
          { className: 'mcu-dialog__foot' },
          h(
            'button',
            {
              type: 'button',
              className: 'mcu-textbtn is-primary',
              onClick: function onClick() {
                mcSound('close')
                props.onClose()
              },
            },
            mcT('common.done')
          )
        )
      )
    }

    /* -------------------------------- HUD -------------------------------- */

    function McHud() {
      const settings = useMcSettings()
      const [open, setOpen] = React.useState(true)
      const [dialog, setDialog] = React.useState(null)

      React.useEffect(
        function rememberPickerHooks() {
          mcOpenWallpaperPicker = function openPicker() {
            setDialog('wallpaper')
          }
          return function cleanup() {
            mcOpenWallpaperPicker = null
          }
        },
        []
      )

      function closeDialog() {
        mcSound('close')
        setDialog(null)
      }

      /* The whole console can be hidden from its own toolbar; it comes back from
         `设置 → Minecraft 主题 → 显示控制台`. */
      if (settings.ui.hudHidden) return null

      const themeOn = settings.enabled
      const toolbar = h(
        'div',
        { className: 'mcu-hud-panel' },
        h(
          'button',
          {
            type: 'button',
            className: 'mcu-btn',
            'aria-pressed': themeOn ? 'true' : 'false',
            title: mcT('hud.toggle'),
            'aria-label': mcT('hud.toggle'),
            onClick: function onClick() {
              const next = !themeOn
              mcSettings.patch({ enabled: next })
              if (next) mcSound('levelUp')
              else mcSound('close')
              mcAchievement(next ? 'themeOn' : 'themeOff')
              mcSyncAudio()
            },
          },
          h(McIcon, { name: 'block', size: 18 })
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'mcu-btn',
            title: mcT('hud.wallpaper'),
            'aria-label': mcT('hud.wallpaper'),
            onClick: function onClick() {
              mcSound('open')
              setDialog('wallpaper')
            },
          },
          h(McIcon, { name: 'image', size: 18 })
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'mcu-btn',
            'aria-pressed': settings.sfx.enabled ? 'true' : 'false',
            title: mcT('hud.sound'),
            'aria-label': mcT('hud.sound'),
            onClick: function onClick() {
              const next = !settings.sfx.enabled
              mcSettings.patch({ sfx: { enabled: next } })
              if (next) mcSound('click')
              mcAchievement(next ? 'soundOn' : 'soundOff')
            },
          },
          h(McIcon, { name: 'sound', size: 18 })
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'mcu-btn',
            'aria-pressed': settings.bgm.enabled ? 'true' : 'false',
            title: mcT('hud.bgm'),
            'aria-label': mcT('hud.bgm'),
            onClick: function onClick() {
              const next = !settings.bgm.enabled
              mcSettings.patch({ bgm: { enabled: next } })
              mcSound('unlock')
              mcSyncAudio()
              mcAchievement(next ? 'bgmOn' : 'bgmOff')
            },
          },
          h(McIcon, { name: 'music', size: 18 })
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'mcu-btn',
            title: mcT('hud.nextTrack'),
            'aria-label': mcT('hud.nextTrack'),
            onClick: function onClick() {
              mcSound('click')
              mcBgmNext()
              mcSyncAudio()
            },
          },
          h(McIcon, { name: 'next', size: 18 })
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'mcu-btn',
            title: mcT('hud.hideConsole'),
            'aria-label': mcT('hud.hideConsole'),
            onClick: function onClick() {
              mcSound('close')
              mcSettings.patch({ ui: { hudHidden: true } })
              mcAchievement('hudHidden')
            },
          },
          h(McIcon, { name: 'eye', size: 18 })
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'mcu-btn',
            title: mcT('hud.options'),
            'aria-label': mcT('hud.options'),
            onClick: function onClick() {
              mcSound('open')
              setDialog('options')
            },
          },
          h(McIcon, { name: 'sliders', size: 18 })
        )
      )

      const toggle = h(
        'button',
        {
          type: 'button',
          className: 'mcu-btn',
          title: open ? mcT('hud.hide') : mcT('hud.show'),
          'aria-label': open ? mcT('hud.hide') : mcT('hud.show'),
          'aria-expanded': open ? 'true' : 'false',
          onClick: function onClick() {
            /* Expanding the console opens a chest; collapsing closes it. */
            mcSound(open ? 'close' : 'open')
            setOpen(!open)
          },
        },
        h(McIcon, { name: 'chevron', size: 16 })
      )

      return h(
        React.Fragment,
        null,
        h(
          'div',
          { className: 'mcu-hud', 'data-mc-ui': 'hud', 'data-mc-scheme': mcIsDark() ? 'dark' : 'light' },
          open ? toolbar : null,
          h('div', { className: 'mcu-hud-row' }, toggle)
        ),
        dialog === 'wallpaper' ? h(McWallpaperPicker, { onClose: closeDialog }) : null,
        dialog === 'options'
          ? h(McOptionsDialog, {
              onClose: function onClose() {
                mcSound('close')
                setDialog(null)
              },
            })
          : null
      )
    }

    /* ---------------------------- toast stack ---------------------------- */

    function McToastStack() {
      const items = useMcToasts()
      if (!items.length) return null
      return h(
        'div',
        { className: 'mcu-toast-stack', 'data-mc-ui': 'toast', 'aria-live': 'polite' },
        items.map(function item(entry) {
          return h(
            'div',
            { key: entry.id, className: 'mcu-toast', role: 'status' },
            h('span', { className: 'mcu-toast__icon', 'aria-hidden': 'true' }),
            h(
              'span',
              { className: 'mcu-toast__text' },
              h('span', { className: 'mcu-toast__title' }, entry.title),
              h('span', { className: 'mcu-toast__body' }, entry.body)
            )
          )
        })
      )
    }

    /* --------------------------- settings page --------------------------- */

    function McSettingsPage() {
      return h(
        'div',
        { 'data-mc-ui': 'settings', style: { padding: '4px 0' } },
        h(McOptionsContent, null)
      )
    }

/* ---- src/60-apply.js ---- */

    /* ------------------------------------------------------------------ *
     * 7. Plugin entry point
     * ------------------------------------------------------------------ */

    /** Non-localised fallback kept for keys the locale service has not bound yet. */
    const mcFallbackT = mcT

    /** Translator that prefers the locale service and falls back to the dictionary. */
    function mcTranslate(key) {
      try {
        const text = mcT(key)
        if (text) return text
      } catch (_error) {
        /* fall through */
      }
      return mcFallbackT(key)
    }

    /** Toggle the whole theme (also used by the keyboard shortcut). */
    function mcToggleTheme() {
      const next = !mcSettings.get().enabled
      mcSettings.patch({ enabled: next })
      if (next) mcSound('levelUp')
      else mcSound('close')
      mcAchievement(next ? 'themeOn' : 'themeOff')
      mcSyncAudio()
    }

    /**
     * Console handle: `window.MinecraftUI` in the devtools console so every
     * option is scriptable without opening the panels. Documented in README.
     */
    const mcConsoleApi = {
      plugin: 'dsh-minecraft-ui',
      options: function options() {
        return mcSettings.get()
      },
      set: function set(patch) {
        mcSettings.patch(patch)
        mcApplyPalette()
        mcWallStyle()
        mcSyncAudio()
        return mcSettings.get()
      },
      reset: function reset() {
        mcSettings.reset()
        mcApplyPalette()
        mcWallStyle()
        mcSyncAudio()
        return mcSettings.get()
      },
      listWallpapers: function listWallpapers() {
        return mcScenes().map(function row(scene) {
          return { id: scene.id, name: scene.name, kind: scene.kind }
        })
      },
      listUserWallpapers: function listUserWallpapers() {
        return mcUserWallpapers.items.map(function row(item) {
          return { id: item.id, name: item.name, width: item.width, height: item.height, bytes: item.bytes }
        })
      },
      deleteWallpaper: function deleteWallpaper(id) {
        mcUserRemove(String(id))
        return id
      },
      refreshUserWallpapers: function refreshUserWallpapers() {
        return mcUserRefresh()
      },
      setWallpaper: function setWallpaper(id) {
        mcWallSelect(String(id))
        return id
      },
      nextWallpaper: function nextWallpaper() {
        const next = mcWallNextScene(1)
        if (next) mcWallSelect(next)
        return next
      },
      toggleTheme: function toggleTheme() {
        mcToggleTheme()
        return mcSettings.get().enabled
      },
      audio: function audio() {
        return MC_AUDIO
      },
      listBgmTracks: function listBgmTracks() {
        return mcBgm.items.map(function track(entry) {
          return { id: entry.id, name: entry.name, source: entry.source || 'file' }
        })
      },
      loadBgmTracks: function loadBgmTracks() {
        return mcLoadBgmLibrary()
      },
      listUserMusic: function listUserMusic() {
        return typeof mcUserMusic === 'object' && mcUserMusic
          ? mcUserMusic.items.map(function row(item) {
              return { id: item.id, name: item.name, bytes: item.bytes, mime: item.mime, createdAt: item.createdAt }
            })
          : []
      },
      deleteUserMusic: function deleteUserMusic(id) {
        const target = String(id)
        if (typeof mcUserMusicRemove === 'function') mcUserMusicRemove(target)
        return target
      },
      refreshUserMusic: function refreshUserMusic() {
        if (typeof mcUserMusicRefresh !== 'function') return Promise.resolve([])
        return mcUserMusicRefresh().then(function onReload() {
          mcSyncUserMusic()
          return mcBgm.items.map(function row(entry) {
            return { id: entry.id, name: entry.name, source: entry.source || 'file' }
          })
        })
      },
      nextBgmTrack: function nextBgmTrack() {
        mcBgmNext()
        return mcSettings.get().bgm.trackId
      },
      setBgmTrack: function setBgmTrack(id) {
        mcSettings.patch({ bgm: { enabled: true, trackId: String(id) } })
        mcSyncAudio()
        return id
      },
      setHudDrop: function setHudDrop(px) {
        mcSettings.patch({ ui: { hudDrop: px } })
        return mcSettings.get().ui.hudDrop
      },
      showHud: function showHud(show) {
        mcSettings.patch({ ui: { hudHidden: show === false } })
        return !mcSettings.get().ui.hudHidden
      },
    }

    /**
     * Client entry point: inject the stylesheet, bind the locale, mount the
     * runtime, then claim the three slots the plugin paints into.
     * @param {any} ctx - the client plugin context.
     */
    function mcApply(ctx) {
      ctx.effect(function* mcLifecycle() {
        /* --- translations --------------------------------------------- */
        try {
          yield ctx.locale.register(MC_NS, { zh: MC_I18N.zh, en: MC_I18N.en })
          const bound = ctx.locale.bind(MC_NS)
          mcT = function mcBoundTranslate(key) {
            try {
              return bound(key)
            } catch (_error) {
              return mcFallbackT(key)
            }
          }
        } catch (_error) {
          console.warn('[minecraft-ui] locale service unavailable, using built-in dictionaries')
        }

        /* --- stylesheet ------------------------------------------------ */
        const style = document.createElement('style')
        style.setAttribute('data-plugin', 'dsh-minecraft-ui')
        style.textContent = MC_CSS
        document.head.appendChild(style)

        /* --- palette + runtime ----------------------------------------- */
        mcApplyPalette()
        mcRuntimeStart()

        /* --- bundled samples ------------------------------------------- */
        /* Decode the mp3 UI sounds ahead of the first click. This may create a
           suspended AudioContext, which is allowed without a gesture; the
           engine resumes it on the first real interaction. */
        if (typeof MC_AUDIO === 'object' && MC_AUDIO && typeof MC_AUDIO.preload === 'function') {
          Promise.resolve()
            .then(function preloadSamples() {
              return MC_AUDIO.preload()
            })
            .catch(function onError(error) {
              console.warn('[minecraft-ui] sample preload failed', error)
            })
        }

        /* --- scriptable console handle --------------------------------- */
        window.MinecraftUI = mcConsoleApi

        /* --- keyboard shortcut ----------------------------------------- */
        const onKeyDown = function onKeyDown(event) {
          if (!event.altKey) return
          if (!(event.ctrlKey || event.metaKey)) return
          if (String(event.key).toLowerCase() !== 'm') return
          event.preventDefault()
          mcToggleTheme()
        }
        document.addEventListener('keydown', onKeyDown, true)

        /* --- slots ------------------------------------------------------ */
        ctx.slots.inject('shell.overlay', function registerHud() {
          const unregisterHud = ctx.slots.register(
            { name: 'shell.overlay', id: 'minecraft-ui-hud', order: 60, label: function label() { return 'Minecraft' } },
            McHud
          )
          const unregisterToasts = ctx.slots.register(
            { name: 'shell.overlay', id: 'minecraft-ui-toast', order: 61, label: function label() { return 'Minecraft' } },
            McToastStack
          )
          return function unregisterOverlay() {
            unregisterHud()
            unregisterToasts()
          }
        })

        ctx.slots.inject('settings.section', function registerSettings() {
          const unregister = ctx.slots.register(
            {
              name: 'settings.section',
              id: 'minecraft-ui',
              order: 150,
              label: function label() {
                return mcTranslate('meta.title')
              },
              locale: MC_NS,
            },
            McSettingsPage
          )
          return function unregisterSection() {
            unregister()
          }
        })

        /* --- teardown --------------------------------------------------- */
        yield function mcTeardown() {
          document.removeEventListener('keydown', onKeyDown, true)
          if (window.MinecraftUI === mcConsoleApi) delete window.MinecraftUI
          mcRuntimeStop()
          mcStripPalette()
          mcToasts.clear()
          if (style.parentNode) style.parentNode.removeChild(style)
        }
      }, 'dsh-minecraft-ui client lifecycle')
    }

/* ---- src/99-tail.js ---- */

    return { name: 'minecraft-ui', inject: ['slots', 'locale'], apply: mcApply }
  }
})
