
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
