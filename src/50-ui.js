
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
