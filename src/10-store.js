
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
