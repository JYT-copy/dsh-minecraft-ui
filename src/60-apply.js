
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
