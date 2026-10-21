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
