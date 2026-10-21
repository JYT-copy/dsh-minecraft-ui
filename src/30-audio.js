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
