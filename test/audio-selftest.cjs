'use strict';

/**
 * 30-audio.js 自检桩（Node 环境，无浏览器、无真实音频设备）。
 *
 * 用一个假的 AudioContext / AudioNode / AudioParam 在 Node 里运行音频引擎，检查：
 *  1. 语法与调用不抛异常；
 *  2. 未 unlock 时所有播放方法静默（不建节点、不连边）；
 *  3. unlock 后每个短音效都确实产生了节点（有采样时走采样）；
 *  4. connect / disconnect 计数平衡（短音效、BGM stop 后不残留、无泄漏定时器）；
 *  5. 播放中调音量、suspend/resume、页面隐藏/恢复都不崩且行为正确；
 *  6. 用户曲目（Blob）注入 / 合并列表 / 播完自动接歌（宿主 <-> 用户混排）；
 *  7. 五个采样全部 404（开源仓库无素材）时，每个音效都有合成兜底、绝不变哑，
 *     且每个音效的控制台提示最多一条。
 *
 * 运行：node minecraft-ui/tmp/audio-selftest.cjs
 */

const fs = require('fs');

const SRC = 'D:/HuaweiMoveData/Users/纪永泰/Desktop/DeepSeek work/minecraft-ui/src/30-audio.js';

/* ------------------------------------------------------------------ */
/* 计数与断言                                                          */
/* ------------------------------------------------------------------ */

const stats = { created: 0, connects: 0, disconnects: 0, disconnectCalls: 0, kindCounts: {}, createdNodes: [] };
const problems = [];
const consoleOutput = [];

function check(cond, msg) {
  if (!cond) problems.push(msg);
}
function snap() {
  return {
    created: stats.created,
    connects: stats.connects,
    disconnects: stats.disconnects,
    edges: stats.connects - stats.disconnects
  };
}
function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}
function kindDiff(kinds0, kinds1, kind) {
  return (kinds1[kind] || 0) - (kinds0[kind] || 0);
}
function warnCount(re) {
  return consoleOutput.filter(function (row) {
    return row[0] === 'warn' && re.test(String(row[1]));
  }).length;
}
function totalWarns() {
  return consoleOutput.filter(function (row) { return row[0] === 'warn'; }).length;
}
function totalErrors() {
  return consoleOutput.filter(function (row) { return row[0] === 'error'; }).length;
}

/* ------------------------------------------------------------------ */
/* 假 WebAudio 实现                                                    */
/* ------------------------------------------------------------------ */

class FakeParam {
  constructor(name, value) {
    this.name = name;
    this.value = value;
    this.events = 0;
  }
  _time(t) {
    if (typeof t !== 'number' || !isFinite(t) || t < 0) {
      throw new Error(this.name + ': 非法时间 ' + t);
    }
  }
  setValueAtTime(v, t) {
    this._time(t);
    if (typeof v !== 'number' || !isFinite(v)) throw new Error(this.name + ': 非法值 ' + v);
    this.value = v;
    this.events++;
    return this;
  }
  linearRampToValueAtTime(v, t) {
    this._time(t);
    if (typeof v !== 'number' || !isFinite(v)) throw new Error(this.name + ': 非法 ramp 值 ' + v);
    this.value = v;
    this.events++;
    return this;
  }
  exponentialRampToValueAtTime(v, t) {
    this._time(t);
    if (typeof v !== 'number' || !isFinite(v) || v <= 0) {
      throw new Error(this.name + ': exponential 目标必须 > 0，实际 ' + v);
    }
    this.value = v;
    this.events++;
    return this;
  }
  setTargetAtTime(v, t, c) {
    this._time(t);
    if (typeof v !== 'number' || !isFinite(v)) throw new Error(this.name + ': 非法 target 值');
    if (typeof c !== 'number' || !isFinite(c) || c < 0) throw new Error(this.name + ': 非法时间常数');
    this.value = v;
    this.events++;
    return this;
  }
  cancelScheduledValues(t) {
    this._time(t);
    this.events++;
    return this;
  }
}

class FakeBuffer {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this._data = [];
    for (let i = 0; i < channels; i++) this._data.push(new Float32Array(length));
  }
  getChannelData(ch) {
    if (!this._data[ch]) throw new Error('getChannelData: 非法声道 ' + ch);
    return this._data[ch];
  }
}

class FakeNode {
  constructor(ctx, kind) {
    this.ctx = ctx;
    this.kind = kind;
    this._edges = [];
    stats.created++;
    // 按节点类型计数：用于断言"有采样时只播采样 / 无采样时确有合成兜底"
    if (!stats.kindCounts[kind]) stats.kindCounts[kind] = 0;
    stats.kindCounts[kind]++;
    stats.createdNodes.push(this);
  }
  connect(dest) {
    if (!dest || typeof dest !== 'object') throw new Error(this.kind + '.connect: 非法目标');
    this._edges.push(dest);
    stats.connects++;
    return dest;
  }
  disconnect() {
    stats.disconnectCalls++;
    stats.disconnects += this._edges.length;
    this._edges.length = 0;
  }
}

class FakeSource extends FakeNode {
  constructor(ctx, kind) {
    super(ctx, kind);
    this._started = false;
    this._stopped = false;
  }
  start(when, offset) {
    if (this._started) throw new Error(this.kind + '.start 被调用两次');
    if (typeof when !== 'number' || !isFinite(when) || when < 0) {
      throw new Error(this.kind + '.start 非法 when=' + when);
    }
    if (offset !== undefined && (!isFinite(offset) || offset < 0)) {
      throw new Error(this.kind + '.start 非法 offset=' + offset);
    }
    this._started = true;
    this.startTime = when;
  }
  stop(when) {
    if (!this._started) throw new Error(this.kind + '.stop 在 start 之前调用');
    if (this._stopped) return;
    if (typeof when !== 'number' || !isFinite(when) || when < 0) {
      throw new Error(this.kind + '.stop 非法 when=' + when);
    }
    this._stopped = true;
    this.stopTime = when;
  }
}

class FakeGain extends FakeNode {
  constructor(ctx) { super(ctx, 'GainNode'); this.gain = new FakeParam('gain', 1); }
}
class FakeOscillator extends FakeSource {
  constructor(ctx) {
    super(ctx, 'OscillatorNode');
    this.type = 'sine';
    this.frequency = new FakeParam('frequency', 440);
    this.detune = new FakeParam('detune', 0);
  }
}
class FakeBiquad extends FakeNode {
  constructor(ctx) {
    super(ctx, 'BiquadFilterNode');
    this.type = 'lowpass';
    this.frequency = new FakeParam('frequency', 350);
    this.Q = new FakeParam('Q', 1);
    this.gain = new FakeParam('gain', 0);
  }
}
class FakeBufferSource extends FakeSource {
  constructor(ctx) {
    super(ctx, 'AudioBufferSourceNode');
    this.buffer = null;
    this.loop = false;
    this.loopStart = 0;
    this.loopEnd = 0;
    this.playbackRate = new FakeParam('playbackRate', 1);
  }
}
class FakeConvolver extends FakeNode {
  constructor(ctx) { super(ctx, 'ConvolverNode'); this.buffer = null; this.normalize = true; }
}
class FakeCompressor extends FakeNode {
  constructor(ctx) {
    super(ctx, 'DynamicsCompressorNode');
    this.threshold = new FakeParam('threshold', -24);
    this.knee = new FakeParam('knee', 30);
    this.ratio = new FakeParam('ratio', 12);
    this.attack = new FakeParam('attack', 0.003);
    this.release = new FakeParam('release', 0.25);
    this.reduction = 0;
  }
}
class FakeDelay extends FakeNode {
  constructor(ctx) { super(ctx, 'DelayNode'); this.delayTime = new FakeParam('delayTime', 0); }
}

/** 用户曲目用的假 Blob：只实现引擎真正用到的 size / arrayBuffer()。 */
class FakeBlob {
  constructor(name, size) {
    this.name = name;
    this.size = size;
    this.type = 'audio/mpeg';
  }
  arrayBuffer() {
    userBlobReads++;
    // 让 decodeAudioData 知道这是"用户曲目"（时长按音乐给），以及哪些名字模拟解码失败
    lastDecodeUrl = 'user-track:' + this.name;
    return Promise.resolve(new ArrayBuffer(8));
  }
}

const contexts = [];
const decodedUrls = new Map();   // buffer -> 解码时用的 url（区分宿主曲目 / 用户曲目 / 音效）
let decodeCalls = 0;
let musicDecodes = 0;
let lastDecodeUrl = '';
let userBlobReads = 0;
let failSamples = false;     // 模拟开源仓库：/sounds/*.mp3 全部 404
let musicListFetches = 0;
const MUSIC_TRACKS = [
  { file: 'C418 - Minecraft [mqms2].ogg', name: 'C418 - Minecraft', size: 2089690 },
  { file: 'C418 - Subwoofer Lullaby [mqms2].ogg', name: 'C418 - Subwoofer Lullaby', size: 2011000 },
  { file: 'C418 - Sweden [mqms2].ogg', name: 'C418 - Sweden', size: 1999000 }
];

class FakeAudioContext {
  constructor() {
    this.sampleRate = 48000;
    this.state = 'suspended';
    this._base = 0;
    this._runSince = Date.now();
    this.destination = new FakeNode(this, 'AudioDestinationNode');
    contexts.push(this);
  }
  // 关键：currentTime 只在 running 时推进，suspend 后冻结（与真实 AudioContext 行为一致）
  _advance() {
    if (this.state === 'running') {
      this._base += (Date.now() - this._runSince) / 1000;
      this._runSince = Date.now();
    }
  }
  get currentTime() {
    this._advance();
    return this._base;
  }
  createGain() { return new FakeGain(this); }
  createOscillator() { return new FakeOscillator(this); }
  createBiquadFilter() { return new FakeBiquad(this); }
  createBufferSource() { return new FakeBufferSource(this); }
  createConvolver() { return new FakeConvolver(this); }
  createDynamicsCompressor() { return new FakeCompressor(this); }
  createDelay() { return new FakeDelay(this); }
  createBuffer(channels, length, sampleRate) { return new FakeBuffer(channels, length, sampleRate); }
  // decodeAudioData：同时支持 callback 与 Promise 两种形态（引擎两种都接，幂等）
  // 音效采样给 0.4s；BGM 曲目（宿主 + 用户）给 12/14/16s —— 便于测试里区分 source 属于哪一类
  decodeAudioData(arrayBuffer, ok, fail) {
    decodeCalls++;
    if (lastDecodeUrl.indexOf('BAD') >= 0) {
      // 用户曲目解码失败：只返回一个 rejected Promise，让引擎的 .then(resolve, reject) 接住
      return Promise.reject(new Error('decodeAudioData 失败（测试桩）'));
    }
    const isMusic = /^\/api\/minecraft-ui\/music\//.test(lastDecodeUrl) ||
      lastDecodeUrl.indexOf('user-track:') === 0;
    let duration = 0.4;
    if (isMusic) {
      musicDecodes++;
      duration = 12 + (musicDecodes - 1) * 2;
    }
    const buf = new FakeBuffer(1, Math.floor(duration * this.sampleRate), this.sampleRate);
    decodedUrls.set(buf, lastDecodeUrl);
    const p = Promise.resolve(buf);
    if (typeof ok === 'function') p.then(ok, fail);
    return p;
  }
  resume() {
    if (this.state !== 'running') {
      this.state = 'running';
      this._runSince = Date.now();
    }
    return Promise.resolve();
  }
  suspend() {
    this._advance();
    this.state = 'suspended';
    return Promise.resolve();
  }
  close() { this._advance(); this.state = 'closed'; return Promise.resolve(); }
}

/* ------------------------------------------------------------------ */
/* 浏览器全局桩                                                        */
/* ------------------------------------------------------------------ */

const documentListeners = {};
global.document = {
  hidden: false,
  addEventListener: function (type, fn) {
    if (!documentListeners[type]) documentListeners[type] = [];
    documentListeners[type].push(fn);
  },
  removeEventListener: function (type, fn) {
    const arr = documentListeners[type] || [];
    const i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  }
};
function fireDocument(type) {
  const arr = (documentListeners[type] || []).slice();
  for (let i = 0; i < arr.length; i++) arr[i]();
}

global.window = { AudioContext: FakeAudioContext };
global.AudioContext = FakeAudioContext;

// fetch 桩：/music 返回曲目清单，/music/<file> 与 /sounds/<name>.mp3 返回音频字节
// failSamples=true 时 /sounds/* 一律 404，模拟"开源仓库不带任何版权素材"
const fetched = [];
global.fetch = function (url) {
  const u = String(url);
  fetched.push(u);
  if (u === '/api/minecraft-ui/music') {
    musicListFetches++;
    return Promise.resolve({
      ok: true,
      status: 200,
      json: function () { return Promise.resolve({ ok: true, tracks: MUSIC_TRACKS }); },
      arrayBuffer: function () { lastDecodeUrl = u; return Promise.resolve(new ArrayBuffer(8)); }
    });
  }
  if (failSamples && u.indexOf('/api/minecraft-ui/sounds/') === 0) {
    return Promise.resolve({
      ok: false,
      status: 404,
      json: function () { return Promise.resolve({}); },
      arrayBuffer: function () { return Promise.reject(new Error('404 无字节')); }
    });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: function () { return Promise.resolve({}); },
    arrayBuffer: function () { lastDecodeUrl = u; return Promise.resolve(new ArrayBuffer(8)); }
  });
};

const realConsoleError = console.error;
const realConsoleWarn = console.warn;
const realConsoleLog = console.log;
console.error = function () { consoleOutput.push(['error'].concat(Array.from(arguments))); };
console.warn = function () { consoleOutput.push(['warn'].concat(Array.from(arguments))); };

process.on('uncaughtException', function (err) {
  problems.push('未捕获异常: ' + (err && err.stack ? err.stack : err));
});
process.on('unhandledRejection', function (err) {
  problems.push('未处理的 Promise rejection: ' + (err && err.stack ? err.stack : err));
});

/* ------------------------------------------------------------------ */
/* 加载被测文件（每次调用 = 一个独立的引擎实例，模块状态互不干扰）      */
/* ------------------------------------------------------------------ */

const source = fs.readFileSync(SRC, 'utf8');

function loadEngine() {
  // 关键：包成 '"use strict"' 的内层函数体——与真实集成（00-head.js 的 factory 函数体）
  // 完全一致。这样任何隐式全局变量赋值 / 未声明标识符都会抛错，而不是被 sloppy 模式掩盖。
  const factory = new Function(
    'return (function () {\n"use strict";\n' + source +
    '\n;return { MC_AUDIO: MC_AUDIO, mcAudioSupported: mcAudioSupported };\n})();'
  );
  return factory();
}

// 当前正在播放的 BGM source（音乐 buffer 时长 >= 5s，已 start 且未 stop）
function activeMusicSources() {
  return stats.createdNodes.filter(function (n) {
    return n.kind === 'AudioBufferSourceNode' && !!n.buffer && n.buffer.duration >= 5 &&
      n._started && !n._stopped;
  });
}

/* ------------------------------------------------------------------ */
/* 测试主体                                                            */
/* ------------------------------------------------------------------ */

(async function main() {
  const perf = {};

  realConsoleLog('==== 30-audio.js 自检 ====');
  realConsoleLog('源文件: ' + SRC);

  /* ================= 引擎实例 1：正常素材（采样都在） ================= */
  const engine1 = loadEngine();
  const MC_AUDIO = engine1.MC_AUDIO;
  const mcAudioSupported = engine1.mcAudioSupported;

  /* ---- A. 支持检测 & 不支持时的 unlock ---- */
  check(mcAudioSupported() === true, 'mcAudioSupported() 在有 window.AudioContext 时应为 true');
  const savedCtor = global.window.AudioContext;
  delete global.window.AudioContext;
  check(mcAudioSupported() === false, 'mcAudioSupported() 在无 AudioContext 时应为 false');
  let unsupportedUnlock = true;
  try { unsupportedUnlock = MC_AUDIO.unlock(); } catch (e) {
    problems.push('无 AudioContext 时 unlock 抛错: ' + e.message);
  }
  check(unsupportedUnlock === false, '无 AudioContext 时 unlock 应返回 false');
  check(contexts.length === 0, '无 AudioContext 时 unlock 不应创建上下文');
  global.window.AudioContext = savedCtor;

  /* ---- P. preload：无手势时建 suspended 上下文 + 解码 5 个采样 ---- */
  realConsoleLog('');
  realConsoleLog('-- preload（无手势，允许 suspended 上下文）--');
  check(typeof MC_AUDIO.preload === 'function', 'MC_AUDIO.preload 应为函数');
  check(contexts.length === 0, 'preload 前不应存在 AudioContext，实际 ' + contexts.length);
  const preloadP1 = MC_AUDIO.preload();
  const preloadP2 = MC_AUDIO.preload();
  check(preloadP1 && typeof preloadP1.then === 'function', 'preload() 应返回 Promise');
  check(preloadP1 === preloadP2, '并发 preload() 应共享同一个 Promise');
  let preloadOk = true;
  try { await preloadP1; } catch (e) {
    preloadOk = false;
    problems.push('preload() 不应 reject: ' + e.message);
  }
  check(preloadOk, 'preload() 应 resolve');
  check(contexts.length === 1, 'preload 应只创建一个 AudioContext，实际 ' + contexts.length);
  const preCtx = contexts[0];
  check(preCtx.state !== 'running',
    'preload 后上下文应保持非 running（不得自动 resume），实际 ' + preCtx.state);
  check(MC_AUDIO.isReady() === false, 'preload 后（尚未 unlock）isReady() 应为 false');
  check(fetched.length === 5, 'preload 应 fetch 5 个采样，实际 ' + fetched.length);
  ['ui-stonecutter-select_recipe-1', 'block-chest-open-1', 'block-chest-close-1',
    'block-wooden_door-open-1', 'entity-firework_rocket-launch-1'].forEach(function (n) {
    const u = '/api/minecraft-ui/sounds/' + n + '.mp3';
    check(fetched.indexOf(u) >= 0, 'preload 应请求 ' + u + '，实际请求：' + fetched.join(', '));
  });
  check(decodeCalls === 5, 'preload 应解码 5 个采样，实际 ' + decodeCalls);
  const preloadP3 = MC_AUDIO.preload();
  check(preloadP3 === preloadP1, '重复 preload() 应返回同一个 Promise');
  await preloadP3;
  check(decodeCalls === 5, 'preload 幂等：第二次不应重复解码，实际 ' + decodeCalls + ' 次');
  realConsoleLog('  preload: 通过（fetch ' + fetched.length + ' 个，decode ' + decodeCalls +
    ' 次，上下文 ' + preCtx.state + '，无输出）');

  /* ---- B. 未 unlock：所有方法静默 ---- */
  const beforeUnlock = snap();
  check(MC_AUDIO.isReady() === false, '未 unlock 时 isReady() 应为 false');
  check(MC_AUDIO.isBgmPlaying() === false, '未 unlock 时 isBgmPlaying() 应为 false');

  const fetchedBeforeSilent = fetched.length;
  ['click', 'hover', 'toggle', 'success', 'error', 'open', 'close', 'levelUp',
    'startBgm', 'stopBgm', 'playBgmTrack', 'nextBgmTrack'].forEach(function (name) {
    try { MC_AUDIO[name](); } catch (e) {
      problems.push('未 unlock 时调用 ' + name + '() 抛错: ' + e.message);
    }
  });
  const afterUnlockSilent = snap();
  check(afterUnlockSilent.created === beforeUnlock.created, '未 unlock 却创建了音频节点');
  check(afterUnlockSilent.connects === beforeUnlock.connects, '未 unlock 却建立了音频连接');
  check(fetched.length === fetchedBeforeSilent, '未 unlock 时不应请求 BGM 数据（实际新增 ' +
    (fetched.length - fetchedBeforeSilent) + ' 个请求）');

  // 未 unlock 时的音量设置只记录、不抛错
  try {
    MC_AUDIO.setMasterVolume(0.4);
    MC_AUDIO.setSfxVolume(0.35);
    MC_AUDIO.setBgmVolume(0.15);
  } catch (e) {
    problems.push('未 unlock 时设置音量抛错: ' + e.message);
  }
  let vols = MC_AUDIO.getVolumes();
  check(vols.master === 0.4 && vols.sfx === 0.35 && vols.bgm === 0.15 &&
    Object.keys(vols).length === 3, '未 unlock 时音量未正确记录: ' + JSON.stringify(vols));

  // 非法值：夹紧 / 忽略
  MC_AUDIO.setMasterVolume(-3);
  check(MC_AUDIO.getVolumes().master === 0, 'setMasterVolume(-3) 应夹紧为 0');
  MC_AUDIO.setMasterVolume(9);
  check(MC_AUDIO.getVolumes().master === 1, 'setMasterVolume(9) 应夹紧为 1');
  MC_AUDIO.setMasterVolume('not-a-number');
  check(MC_AUDIO.getVolumes().master === 1, '非法音量值应被忽略');

  // 恢复默认音量供后续测试
  MC_AUDIO.setMasterVolume(0.75);
  MC_AUDIO.setSfxVolume(0.6);
  MC_AUDIO.setBgmVolume(0.22);

  realConsoleLog('未 unlock 静默检查: 通过（新增节点 ' +
    (afterUnlockSilent.created - beforeUnlock.created) + '，新增连接 ' +
    (afterUnlockSilent.connects - beforeUnlock.connects) + '）');

  /* ---- C. unlock ---- */
  let unlocked = false;
  try { unlocked = MC_AUDIO.unlock(); } catch (e) {
    problems.push('unlock 抛错: ' + e.message);
  }
  check(unlocked === true, 'unlock() 应返回 true');
  check(contexts.length === 1, 'unlock() 应只创建一个 AudioContext，实际 ' + contexts.length);
  check(MC_AUDIO.isReady() === true, 'unlock 后 isReady() 应为 true');
  const ctx = contexts[0];
  check(ctx.state === 'running', 'unlock 后 AudioContext.state 应为 running，实际 ' + ctx.state);
  const again = MC_AUDIO.unlock();
  check(again === true && contexts.length === 1, 'unlock() 应幂等（不重复创建上下文）');
  check((documentListeners.visibilitychange || []).length === 1,
    'unlock 后应挂载一个 visibilitychange 监听');

  const baseline = snap();
  check(baseline.created > 0, 'unlock 后应建立音频图节点（实际 ' + baseline.created + '）');
  check(baseline.edges > 0, 'unlock 后应建立音频图连接（实际 ' + baseline.edges + '）');
  realConsoleLog('unlock: 通过（AudioContext 1 个，音频图节点 ' + baseline.created +
    '，常驻连接 ' + baseline.edges + ' 条）');

  /* ---- D. 逐个短音效（有采样时走采样） ---- */
  realConsoleLog('');
  realConsoleLog('-- 短音效节点统计（采样可用）--');
  const sfxNames = ['click', 'hover', 'toggle', 'success', 'error', 'open', 'close', 'levelUp'];
  // 采样化后的精确节点/连接数（src + gain；error 多一个 lowpass；hover 仍是合成 noise burst）
  const expectedSfx = {
    click: [2, 2], hover: [3, 3], toggle: [2, 2], success: [2, 2],
    error: [3, 3], open: [2, 2], close: [2, 2], levelUp: [2, 2]
  };
  for (let i = 0; i < sfxNames.length; i++) {
    const name = sfxNames[i];
    const s0 = snap();
    const kinds0 = Object.assign({}, stats.kindCounts);
    const nodeIdx0 = stats.createdNodes.length;
    try { MC_AUDIO[name](); } catch (e) {
      problems.push(name + '() 在 unlock 后抛错: ' + e.message);
    }
    const s1 = snap();
    const kinds1 = Object.assign({}, stats.kindCounts);
    const srcAdded = kindDiff(kinds0, kinds1, 'AudioBufferSourceNode');
    const oscAdded = kindDiff(kinds0, kinds1, 'OscillatorNode');
    perf[name] = {
      nodes: s1.created - s0.created,
      edges: s1.connects - s0.connects,
      srcs: srcAdded,
      oscs: oscAdded,
      afterDisconnects: 0
    };
    check(perf[name].nodes > 0, name + '() 没有产生任何音频节点');
    check(perf[name].edges > 0, name + '() 没有建立任何音频连接');
    check(perf[name].nodes === expectedSfx[name][0] && perf[name].edges === expectedSfx[name][1],
      name + '() 应为 ' + expectedSfx[name][0] + ' 节点/' + expectedSfx[name][1] +
      ' 连接，实际 ' + perf[name].nodes + '/' + perf[name].edges);
    if (name === 'hover') {
      // hover 仍是合成的噪声 tick：允许 1 个 BufferSource（加载的是自造噪声 buffer），但绝不能是采样
      const hoverSources = stats.createdNodes.slice(nodeIdx0).filter(function (n) {
        return n.kind === 'AudioBufferSourceNode';
      });
      const usedSamples = hoverSources.filter(function (n) {
        return n.buffer && n.buffer.duration === 0.4;
      });
      check(srcAdded === 1, 'hover() 应由 1 个噪声 BufferSource 合成，实际 ' + srcAdded);
      check(usedSamples.length === 0, 'hover() 不应播放真实采样，实际播放了 ' + usedSamples.length + ' 个');
      check(oscAdded === 0, 'hover() 不应产生振荡器，实际 ' + oscAdded);
    } else {
      check(srcAdded === 1, name + '() 应播放 1 个采样（1 个 AudioBufferSourceNode），实际 ' + srcAdded);
      check(oscAdded === 0, name + '() 不应再产生合成振荡器节点，实际 ' + oscAdded);
    }
    await sleep(2200);
    const s2 = snap();
    perf[name].afterDisconnects = s2.disconnectCalls - s1.disconnectCalls;
    check(s2.edges === baseline.edges,
      name + '() 结束后连接未回收：残留 ' + (s2.edges - baseline.edges) + ' 条');
    realConsoleLog('  ' + name.padEnd(8) +
      ' 节点 +' + String(perf[name].nodes).padStart(2) +
      '  连接 +' + String(perf[name].edges).padStart(2) +
      '  采样 ' + perf[name].srcs + '  振荡器 ' + perf[name].oscs +
      '  回收后残留 ' + (s2.edges - baseline.edges) + ' 条');
  }

  /* ---- D2. toggle 开/关交替 & hover 限流 ---- */
  const tg0 = snap();
  MC_AUDIO.toggle();                 // D 里已调用过一次（= 开/chest-open），这次应轮到"关"（chest-close）
  const tg1 = snap();
  const toggleOff = { nodes: tg1.created - tg0.created, edges: tg1.connects - tg0.connects };
  check(toggleOff.nodes > 0, 'toggle()（关）没有产生任何音频节点');
  check(toggleOff.nodes === 2 && toggleOff.edges === 2,
    'toggle()（关，chest-close）= 1 个采样 = 2 节点/2 连接，实际 ' + toggleOff.nodes + '/' + toggleOff.edges);
  await sleep(1600);
  check(snap().edges === baseline.edges, 'toggle()（关）结束后连接未回收');
  realConsoleLog('  toggle(关) 节点 +' + toggleOff.nodes + '  连接 +' + toggleOff.edges +
    '  回收后残留 ' + (snap().edges - baseline.edges) + ' 条（开/关都是 1 个采样 = 2+2）');

  const hv0 = snap();
  MC_AUDIO.hover();
  const hv1 = snap();
  MC_AUDIO.hover();                  // 45ms 限流窗口内第二次，应被忽略
  const hv2 = snap();
  check(hv1.created - hv0.created > 0, 'hover() 没有产生任何音频节点');
  check(hv2.created === hv1.created && hv2.connects === hv1.connects,
    'hover() 45ms 限流失效：窗口内连续两次仍产生节点');
  realConsoleLog('  hover 限流: 通过（45ms 内连续两次只响一次）');
  // 等 hover 那个 4ms tick 的声部自然回收，避免把它的 3 条连接算进后面的 BGM 对照
  await sleep(700);

  /* ---- D3. 旧合成点击音 / 变体 API 已移除；采样音效只播采样 ---- */
  realConsoleLog('');
  realConsoleLog('-- 采样映射 / 旧变体 API 移除 --');
  check(MC_AUDIO.clickVariants === undefined, 'MC_AUDIO.clickVariants 应已删除');
  check(MC_AUDIO.setClickVariant === undefined, 'MC_AUDIO.setClickVariant 应已删除');
  check(MC_AUDIO.getClickVariant === undefined, 'MC_AUDIO.getClickVariant 应已删除');
  check(MC_AUDIO.previewClickVariant === undefined, 'MC_AUDIO.previewClickVariant 应已删除');

  // click 必须只播一个采样（1 个 BufferSource、0 个振荡器、2 节点/2 连接）
  const ck0 = snap();
  const ckc0 = Object.assign({}, stats.kindCounts);
  MC_AUDIO.click();
  const ck1 = snap();
  const ckc1 = Object.assign({}, stats.kindCounts);
  const clickSrc = kindDiff(ckc0, ckc1, 'AudioBufferSourceNode');
  const clickOsc = kindDiff(ckc0, ckc1, 'OscillatorNode');
  check(clickSrc === 1, 'click() 应只产生 1 个 AudioBufferSourceNode（采样），实际 ' + clickSrc);
  check(clickOsc === 0, 'click() 不应再产生合成振荡器节点，实际 ' + clickOsc);
  check(ck1.created - ck0.created === 2 && ck1.connects - ck0.connects === 2,
    'click() 应为 2 节点/2 连接（src + gain），实际 ' + (ck1.created - ck0.created) + '/' + (ck1.connects - ck0.connects));
  realConsoleLog('  click: 采样 ' + clickSrc + '  振荡器 ' + clickOsc + '  节点 +' + (ck1.created - ck0.created) + '  连接 +' + (ck1.connects - ck0.connects));
  await sleep(900);
  check(snap().edges === baseline.edges, 'click() 结束后连接未回收');

  // 其余采样化音效同样只播采样，不再产生合成节点
  const sampledNames = ['open', 'close', 'success', 'levelUp', 'error', 'toggle'];
  perf.sampled = {};
  for (let si = 0; si < sampledNames.length; si++) {
    const sname = sampledNames[si];
    const q0 = snap();
    const qkc0 = Object.assign({}, stats.kindCounts);
    try { MC_AUDIO[sname](); } catch (e) {
      problems.push(sname + '() 抛错: ' + e.message);
    }
    const q1 = snap();
    const qkc1 = Object.assign({}, stats.kindCounts);
    const qSrc = kindDiff(qkc0, qkc1, 'AudioBufferSourceNode');
    const qOsc = kindDiff(qkc0, qkc1, 'OscillatorNode');
    perf.sampled[sname] = { nodes: q1.created - q0.created, edges: q1.connects - q0.connects, srcs: qSrc, oscs: qOsc };
    check(qSrc === 1, sname + '() 应播放 1 个采样（1 个 BufferSource），实际 ' + qSrc);
    check(qOsc === 0, sname + '() 不应再产生合成振荡器节点，实际 ' + qOsc);
    await sleep(900);
    check(snap().edges === baseline.edges, sname + '() 结束后连接未回收');
    realConsoleLog('  ' + sname.padEnd(8) + ' 采样 ' + qSrc + '  振荡器 ' + qOsc +
      '  节点 +' + perf.sampled[sname].nodes + '  连接 +' + perf.sampled[sname].edges);
  }

  /* ---- E. BGM（宿主曲目采样） ---- */
  realConsoleLog('');
  realConsoleLog('-- BGM（宿主曲目采样）--');
  check(MC_AUDIO.getBgmTracks().length === 0, 'loadBgmTracks() 之前 getBgmTracks() 应为 []');
  const loadP1 = MC_AUDIO.loadBgmTracks();
  const loadP2 = MC_AUDIO.loadBgmTracks();
  check(loadP1 && typeof loadP1.then === 'function', 'loadBgmTracks() 应返回 Promise');
  check(loadP1 === loadP2, '并发 loadBgmTracks() 应共享同一个 Promise');
  let tracks = [];
  try { tracks = await loadP1; } catch (e) {
    problems.push('loadBgmTracks() 不应 reject: ' + e.message);
  }
  check(Array.isArray(tracks) && tracks.length === 3,
    'loadBgmTracks() 应解析出 3 首，实际 ' + (tracks && tracks.length));
  check(musicListFetches === 1, '清单只应 fetch 一次，实际 ' + musicListFetches);
  check(tracks[0].id === 'C418 - Minecraft [mqms2].ogg',
    '曲目应按 file 排序，第一首实际 ' + (tracks[0] && tracks[0].id));
  check(tracks[0].name === 'C418 - Minecraft',
    'name 应用宿主给的展示名，实际 ' + (tracks[0] && tracks[0].name));
  check(typeof tracks[0].size === 'number' && tracks[0].size > 0, 'loadBgmTracks() 应带 size');
  check(tracks[0].source === 'file', 'loadBgmTracks() 解析出的宿主曲目 source 应为 file');
  await MC_AUDIO.loadBgmTracks();
  check(musicListFetches === 1, '重复 loadBgmTracks() 不应重复 fetch 清单，实际 ' + musicListFetches + ' 次');
  const syncTracks = MC_AUDIO.getBgmTracks();
  check(syncTracks.length === 3 && Object.keys(syncTracks[0]).length === 4 &&
    typeof syncTracks[0].id === 'string' && typeof syncTracks[0].name === 'string' &&
    typeof syncTracks[0].size === 'number' && syncTracks[0].source === 'file',
    'getBgmTracks() 应同步返回 3 个 {id,name,size,source} 条目，实际 ' + JSON.stringify(syncTracks[0]));

  // playBgmTrack()（不传 id => 当前/第一首）：只解码 1 首、只建 1 个 source
  const bgm0 = snap();
  const m0 = musicDecodes;
  const bgmOk = await MC_AUDIO.playBgmTrack();
  const bgm1 = snap();
  perf.bgm = { nodes: bgm1.created - bgm0.created, edges: bgm1.connects - bgm0.connects };
  check(bgmOk === true, 'playBgmTrack() 应返回 true');
  check(musicDecodes - m0 === 1, 'playBgmTrack() 应只解码 1 首，实际 ' + (musicDecodes - m0));
  check(perf.bgm.nodes === 2 && perf.bgm.edges === 2,
    'playBgmTrack() 应为 2 节点/2 连接（src + gain），实际 ' + perf.bgm.nodes + '/' + perf.bgm.edges);
  check(MC_AUDIO.isBgmPlaying() === true, 'playBgmTrack() 后 isBgmPlaying() 应为 true');
  // 播放中改音量：实时生效且不中断
  MC_AUDIO.setBgmVolume(0.12);
  await sleep(150);
  MC_AUDIO.setBgmVolume(0.3);
  await sleep(150);
  check(MC_AUDIO.isBgmPlaying() === true, '播放中改 BGM 音量后应仍在播放');
  // 同一首再播：命中解码缓存
  await MC_AUDIO.playBgmTrack();
  check(musicDecodes - m0 === 1, '重复播放同一首应命中解码缓存，实际又解码 ' + (musicDecodes - m0 - 1) + ' 首');
  await sleep(1300);   // 等交叉淡出结束
  check(snap().edges === baseline.edges + 2,
    '同曲重播交叉淡出后应只剩 1 个 source，实际残留 ' + (snap().edges - baseline.edges) + ' 条');

  // 自然播完：手动触发当前曲目的 onended，应自动接下一首
  let live = activeMusicSources();
  check(live.length === 1, '自然播完前应恰好 1 个 BGM source 在播，实际 ' + live.length);
  const nextId = 'C418 - Subwoofer Lullaby [mqms2].ogg';
  const nextUrl = '/api/minecraft-ui/music/' + encodeURIComponent(nextId);
  live[0].onended();
  await sleep(600);
  check(MC_AUDIO.isBgmPlaying() === true, '单曲播完后应自动接下一首并继续播放');
  check(fetched.indexOf(nextUrl) >= 0, '单曲播完后应请求下一首 ' + nextUrl);
  live = activeMusicSources();
  check(live.length === 1, '自动接歌后应仍有 1 个 source 在播，实际 ' + live.length);
  check(MC_AUDIO.getBgmTracks()[1].id === nextId, '自动接的应是列表下一首 ' + nextId);

  // nextBgmTrack()：交叉淡入淡出
  const n0 = snap();
  const nextOk = await MC_AUDIO.nextBgmTrack();
  const n1 = snap();
  check(nextOk === true, 'nextBgmTrack() 应返回 true');
  check(n1.edges - n0.edges === 2,
    '交叉淡入应立即新增 1 个 source（+2 连接），实际 +' + (n1.edges - n0.edges));
  check(snap().edges === baseline.edges + 4,
    '交叉淡入期间应同时存在两个 source（baseline+4），实际 ' + (snap().edges - baseline.edges));
  await sleep(1300);
  check(snap().edges === baseline.edges + 2,
    '1.3s 后交叉淡出应只剩一个 source，实际 ' + (snap().edges - baseline.edges));

  MC_AUDIO.stopBgm();
  check(MC_AUDIO.isBgmPlaying() === false, 'stopBgm 后 isBgmPlaying() 应为 false');
  await sleep(900);
  check(snap().edges === baseline.edges,
    'stopBgm 后应无残留连接，实际残留 ' + (snap().edges - baseline.edges) + ' 条');
  realConsoleLog('  BGM: 清单 3 首（仅 fetch 清单 ' + musicListFetches + ' 次，解码 ' + musicDecodes +
    ' 首）；playBgmTrack 节点 +' + perf.bgm.nodes + '/连接 +' + perf.bgm.edges +
    '；交叉淡出、自动接歌、stopBgm 回收均正常');

  /* ---- E2. 用户曲目（Blob）+ 合并列表 + 混排自动接歌 ---- */
  realConsoleLog('');
  realConsoleLog('-- 用户曲目 / 合并列表 --');
  check(MC_AUDIO.setUserTracks === undefined ? false : true, 'MC_AUDIO.setUserTracks 应存在');
  check(MC_AUDIO.dropUserTrack === undefined ? false : true, 'MC_AUDIO.dropUserTrack 应存在');
  const userBlob1 = new FakeBlob('测试', 4096);
  check(MC_AUDIO.setUserTracks([{ id: 'user-music-1', name: '测试', blob: userBlob1 }]) === true,
    'setUserTracks() 应返回 true');
  let merged = MC_AUDIO.getBgmTracks();
  check(merged.length === 4, '合并列表应为 3 宿主 + 1 用户 = 4，实际 ' + merged.length);
  check(merged[0].source === 'file' && merged[1].source === 'file' && merged[2].source === 'file',
    '合并列表前 3 项应是宿主曲目（source: file）');
  check(merged[3].source === 'user', '合并列表末项应是用户曲目（source: user），实际 ' + merged[3].source);
  check(merged[3].id === 'user-music-1' && merged[3].name === '测试' && merged[3].size === 4096,
    '用户曲目条目字段不对: ' + JSON.stringify(merged[3]));
  check(Object.keys(merged[3]).length === 4, '用户曲目条目应恰好 4 个字段');
  // 非法输入：不抛错，且当作空表（清空用户曲目）
  let badSetOk = true;
  try { MC_AUDIO.setUserTracks('not-an-array'); } catch (e) {
    badSetOk = false;
    problems.push('setUserTracks(非数组) 抛错: ' + e.message);
  }
  check(badSetOk && MC_AUDIO.getBgmTracks().length === 3,
    'setUserTracks(非数组) 应按空表处理（只剩 3 首宿主曲目）');
  MC_AUDIO.setUserTracks([{ id: 'user-music-1', name: '测试', blob: userBlob1 }]);

  // playBgmTrack(用户曲目)：必须走 blob.arrayBuffer() -> decodeAudioData，且不请求宿主路由
  const u0 = snap();
  const ub0 = userBlobReads;
  const uf0 = fetched.length;
  const um0 = musicDecodes;
  const unc0 = stats.createdNodes.length;
  const uok = await MC_AUDIO.playBgmTrack('user-music-1');
  const u1 = snap();
  const uNewFetches = fetched.slice(uf0);
  const uBufSources = stats.createdNodes.slice(unc0).filter(function (n) {
    return n.kind === 'AudioBufferSourceNode';
  });
  check(uok === true, 'playBgmTrack(用户曲目) 应返回 true');
  check(userBlobReads - ub0 === 1, '用户曲目应走 blob.arrayBuffer()，实际读取 ' + (userBlobReads - ub0) + ' 次');
  check(uNewFetches.every(function (u) { return u.indexOf('/api/minecraft-ui/music') !== 0; }),
    '用户曲目不应请求宿主音频路由，实际: ' + uNewFetches.join(', '));
  check(musicDecodes - um0 === 1, '用户曲目应解码 1 次，实际 ' + (musicDecodes - um0));
  check(uBufSources.length === 1, '播放用户曲目应产生 1 个 BufferSource，实际 ' + uBufSources.length);
  check(uBufSources[0] && uBufSources[0].buffer && uBufSources[0].buffer.duration >= 5,
    '用户曲目 BufferSource 应持有解码后的音乐 buffer（时长 >= 5s）');
  check(u1.created - u0.created === 2 && u1.connects - u0.connects === 2,
    'BGM 用户曲目仍是 src + gain = 2 节点/2 连接，实际 ' +
    (u1.created - u0.created) + '/' + (u1.connects - u0.connects));
  check(MC_AUDIO.isBgmPlaying() === true, '播放用户曲目后 isBgmPlaying() 应为 true');
  realConsoleLog('  用户曲目: blob 读取 ' + (userBlobReads - ub0) + ' 次，解码 ' +
    (musicDecodes - um0) + ' 次，节点 +' + (u1.created - u0.created) + '，无宿主路由请求');

  // 用户曲目是合并列表末项：播完 onended 应回到宿主首曲（可能是缓存命中，也可能是重新解码）
  let ulive = activeMusicSources();
  check(ulive.length === 1, '用户曲目播放时应恰好 1 个 source，实际 ' + ulive.length);
  ulive[0].onended();
  await sleep(1300);   // 等交叉淡出结束
  let afterWrap = activeMusicSources();
  check(MC_AUDIO.isBgmPlaying() === true, '用户曲目播完应自动接下一首并继续播放');
  check(afterWrap.length === 1, '用户曲目播完接歌后应恰好 1 个 source，实际 ' + afterWrap.length);
  check(afterWrap[0] && String(decodedUrls.get(afterWrap[0].buffer)).indexOf('/api/minecraft-ui/music/') === 0,
    '用户曲目（列表末项）播完应接回宿主曲目，实际 buffer 来源 ' +
    (afterWrap[0] && decodedUrls.get(afterWrap[0].buffer)));

  // 反向：宿主末曲播完 onended 应接到用户曲目（混排，用户曲目命中解码缓存）
  const lastHostId = 'C418 - Sweden [mqms2].ogg';
  const lastOk = await MC_AUDIO.playBgmTrack(lastHostId);
  check(lastOk === true, 'playBgmTrack(宿主末曲) 应返回 true');
  await sleep(1300);   // 等交叉淡出结束，只剩 1 个 source
  let hlive = activeMusicSources();
  check(hlive.length === 1, '播放宿主末曲时应恰好 1 个 source，实际 ' + hlive.length);
  hlive[0].onended();
  await sleep(1300);
  const backLive = activeMusicSources();
  check(MC_AUDIO.isBgmPlaying() === true, '宿主末曲播完应仍在播放（用户曲目）');
  check(backLive.length === 1, '宿主末曲播完接歌后应恰好 1 个 source，实际 ' + backLive.length);
  check(backLive[0] && String(decodedUrls.get(backLive[0].buffer)).indexOf('user-track:') === 0,
    '宿主末曲播完应接到合并列表里的用户曲目，实际 buffer 来源 ' +
    (backLive[0] && decodedUrls.get(backLive[0].buffer)));
  realConsoleLog('  混排接歌: 用户末项 -> 宿主首曲 / 宿主末项 -> 用户曲目 均正常');

  // 解码失败：不抛给调用方、只 warn 一次、保持当前曲目继续播放
  const badBlob = new FakeBlob('BAD-track', 8192);
  MC_AUDIO.setUserTracks([{ id: 'user-music-bad', name: '坏文件', blob: badBlob }]);
  const badBefore = snap();
  let badOk = true;
  try { badOk = await MC_AUDIO.playBgmTrack('user-music-bad'); } catch (e) {
    problems.push('用户曲目解码失败时 playBgmTrack 不应抛错: ' + e.message);
  }
  check(badOk === false, '用户曲目解码失败时 playBgmTrack 应返回 false，实际 ' + badOk);
  check(snap().created === badBefore.created, '解码失败不应新建播放节点（保持当前曲目）');
  check(MC_AUDIO.isBgmPlaying() === true, '解码失败后当前曲目应继续播放');
  try { await MC_AUDIO.playBgmTrack('user-music-bad'); } catch (e) {
    problems.push('重复播放坏曲目不应抛错: ' + e.message);
  }
  check(warnCount(/BGM 加载失败/) === 1,
    '同一首坏曲目应只 warn 一次，实际 ' + warnCount(/BGM 加载失败/) + ' 次');
  realConsoleLog('  解码失败: 返回 false、保持当前曲目、warn ' + warnCount(/BGM 加载失败/) + ' 条');

  MC_AUDIO.stopBgm();
  await sleep(900);
  check(snap().edges === baseline.edges, '停止 BGM 后连接应回到 baseline，实际残留 ' +
    (snap().edges - baseline.edges) + ' 条');

  // 覆盖式写入：被删除的用户曲目要清掉；传空数组 = 清空
  check(MC_AUDIO.setUserTracks([]) === true, 'setUserTracks([]) 应返回 true');
  check(MC_AUDIO.getBgmTracks().length === 3 &&
    MC_AUDIO.getBgmTracks().filter(function (t) { return t.source === 'user'; }).length === 0,
    'setUserTracks([]) 应清空用户曲目，只剩 3 首宿主曲目');
  MC_AUDIO.setUserTracks([
    { id: 'user-music-1', name: '测试', blob: userBlob1 },
    { id: 'user-music-2', name: '第二首', blob: new FakeBlob('第二首', 1024) }
  ]);
  check(MC_AUDIO.getBgmTracks().length === 5, '两首用户曲目时应共 5 首');
  check(MC_AUDIO.dropUserTrack('user-music-1') === true, 'dropUserTrack(存在的 id) 应返回 true');
  check(MC_AUDIO.getBgmTracks().filter(function (t) { return t.source === 'user'; }).length === 1 &&
    MC_AUDIO.getBgmTracks()[3].id === 'user-music-2',
    'dropUserTrack 后应只剩 user-music-2');
  check(MC_AUDIO.dropUserTrack('不存在的 id') === false,
    'dropUserTrack(不存在的 id) 应返回 false');
  check(MC_AUDIO.dropUserTrack() === false, 'dropUserTrack() 无参应返回 false');
  MC_AUDIO.setUserTracks([]);
  check(MC_AUDIO.getBgmTracks().length === 3, '清空后应只剩 3 首宿主曲目');
  realConsoleLog('  覆盖 / 清空 / dropUserTrack: 均正常（合并列表回到 3 首宿主曲目）');

  // 环境音 API 已整体删除；getVolumes() 只剩 3 组
  ['startAmbient', 'stopAmbient', 'isAmbientPlaying', 'setAmbientVolume'].forEach(function (k) {
    check(MC_AUDIO[k] === undefined, k + ' 应已删除');
  });
  const vols3 = MC_AUDIO.getVolumes();
  check(Object.keys(vols3).length === 3 && 'master' in vols3 && 'sfx' in vols3 && 'bgm' in vols3,
    'getVolumes() 应只返回 master/sfx/bgm，实际 ' + JSON.stringify(vols3));

  /* ---- G. suspend / resume ---- */
  realConsoleLog('');
  realConsoleLog('-- suspend / resume --');
  let srOk = true;
  try {
    MC_AUDIO.suspend();
    MC_AUDIO.suspend();
    MC_AUDIO.resume();
    MC_AUDIO.resume();
  } catch (e) {
    srOk = false;
    problems.push('suspend()/resume() 抛错: ' + e.message);
  }
  check(srOk, 'suspend/resume 应可用且幂等');
  check(ctx.state === 'running', 'resume() 后上下文应回到 running，实际 ' + ctx.state);

  /* ---- H. 页面隐藏 / 恢复（BGM 为单 source，不涉及调度器） ---- */
  realConsoleLog('');
  realConsoleLog('-- 页面可见性 --');
  const hStart = snap();
  await MC_AUDIO.startBgm();       // 继续当前曲目（缓冲已缓存）
  await sleep(400);
  check(MC_AUDIO.isBgmPlaying() === true, '可见性测试：BGM 应已开始');
  const hPlay = snap();
  perf.bgmHidden = { nodes: hPlay.created - hStart.created };
  check(hPlay.edges === baseline.edges + 2,
    '可见性测试：BGM 应恰好 1 个 source（baseline+2），实际 ' + (hPlay.edges - baseline.edges));
  document.hidden = true;
  fireDocument('visibilitychange');
  await sleep(150);
  check(ctx.state === 'suspended', '页面隐藏后 AudioContext 应 suspend，实际 ' + ctx.state);
  const h0 = snap();
  await sleep(900);
  check(snap().created === h0.created, '页面隐藏期间不应创建新节点');
  document.hidden = false;
  fireDocument('visibilitychange');
  await sleep(300);
  check(ctx.state === 'running', '页面恢复后 AudioContext 应 resume，实际 ' + ctx.state);
  check(MC_AUDIO.isBgmPlaying() === true, '页面恢复后 BGM 应继续当前曲目');
  MC_AUDIO.stopBgm();
  await sleep(900);
  check(snap().edges === baseline.edges,
    '可见性测试后仍有 ' + (snap().edges - baseline.edges) + ' 条连接未断开');
  realConsoleLog('  隐藏: suspend 且不产节点；恢复: resume 并继续当前曲目；stop 后残留 ' +
    (snap().edges - baseline.edges) + ' 条');

  /* ---- I. 重复 stop 不应抛错 / 不应重复回收 ---- */
  const rep0 = snap();
  MC_AUDIO.stopBgm();
  await sleep(900);
  const rep1 = snap();
  check(rep1.created === rep0.created, '重复 stop 不应新建节点');
  check(rep1.edges === rep0.edges, '重复 stop 不应改变连接数');

  /* ---- J. 引擎 1 总账 ---- */
  realConsoleLog('');
  realConsoleLog('-- 引擎 1 连接平衡总账 --');
  const final1 = snap();
  check(final1.edges === baseline.edges,
    '引擎 1 最终连接账不平：当前 ' + final1.edges + '，常驻应为 ' + baseline.edges);
  check(totalErrors() === 0, '引擎 1 不应写 console.error，实际 ' + totalErrors() + ' 条');
  // 引擎 1 唯一允许的 warn：用户曲目解码失败那一条（每首最多一次）
  check(totalWarns() === 1, '引擎 1 应只有 1 条 warn（坏曲目解码失败），实际 ' + totalWarns());
  realConsoleLog('  connect 总次数 ' + stats.connects + '，disconnect 释放边数 ' + stats.disconnects +
    '，常驻 ' + final1.edges + '，warn ' + totalWarns() + '，error ' + totalErrors());

  /* ================= 引擎实例 2：开源仓库形态（5 个采样全部 404） ================= */
  realConsoleLog('');
  realConsoleLog('-- 无素材仓库：5 个采样全部 404，必须全部走合成兜底 --');
  failSamples = true;
  const engine2 = loadEngine();
  const A2 = engine2.MC_AUDIO;

  // 未 unlock 前调用 setUserTracks / getBgmTracks 必须安全
  let preUnlockOk = true;
  try {
    check(A2.setUserTracks([{ id: 'user-music-1', name: '测试', blob: new FakeBlob('测试', 4096) }]) === true,
      'setUserTracks 在 unlock 前应可调用并返回 true');
    const pre = A2.getBgmTracks();
    check(pre.length === 1 && pre[0].source === 'user',
      '宿主清单未加载时合并列表应只有用户曲目，实际 ' + JSON.stringify(pre));
  } catch (e) {
    preUnlockOk = false;
    problems.push('unlock 前调用 setUserTracks / getBgmTracks 抛错: ' + e.message);
  }
  check(preUnlockOk, 'setUserTracks / getBgmTracks 在 unlock 前应安全');

  const d0 = decodeCalls;
  await A2.preload();
  check(contexts.length === 2, '第二个引擎应只新增 1 个 AudioContext，实际共 ' + contexts.length);
  const ctx2 = contexts[1];
  check(ctx2.state !== 'running', '第二个引擎 preload 后不应 running，实际 ' + ctx2.state);
  check(decodeCalls === d0, '采样 404 时不应调用 decodeAudioData，实际新增 ' + (decodeCalls - d0));
  check(A2.unlock() === true, '第二个引擎 unlock 应成功');
  check((documentListeners.visibilitychange || []).length === 2,
    '每个引擎各持有自己的 visibilitychange 处理器，实际 ' +
    (documentListeners.visibilitychange || []).length);
  const baseline2 = snap();

  const fallbackNames = ['click', 'open', 'close', 'toggle', 'success', 'error', 'levelUp'];
  const required = ['click', 'open', 'close', 'toggle', 'success', 'error'];
  perf.fallback = {};
  for (let fi = 0; fi < fallbackNames.length; fi++) {
    const fname = fallbackNames[fi];
    const b0 = snap();
    const fkc0 = Object.assign({}, stats.kindCounts);
    try {
      A2[fname]();       // 第一次：触发兜底 + 一条 warn
      A2[fname]();       // 第二次：不应再 warn（每音效最多一条）
    } catch (e) {
      problems.push(fname + '()（采样 404）抛错: ' + e.message);
    }
    const b1 = snap();
    const fkc1 = Object.assign({}, stats.kindCounts);
    const oscs = kindDiff(fkc0, fkc1, 'OscillatorNode');
    const srcs = kindDiff(fkc0, fkc1, 'AudioBufferSourceNode');
    perf.fallback[fname] = { nodes: b1.created - b0.created, edges: b1.connects - b0.connects, oscs: oscs, srcs: srcs };
    check(perf.fallback[fname].nodes > 0, fname + '（采样 404）绝不应变哑：应产生合成节点');
    check(perf.fallback[fname].edges > 0, fname + '（采样 404）应建立音频连接');
    check(perf.fallback[fname].oscs > 0, fname + '（采样 404）兜底应含振荡器');
    if (required.indexOf(fname) >= 0) {
      const w = warnCount(new RegExp('已改用合成音：' + fname + '$'));
      check(w === 1, fname + '（采样 404）应只 warn 1 次，实际 ' + w + ' 次');
    }
    realConsoleLog('  ' + fname.padEnd(8) + ' 节点 +' + String(perf.fallback[fname].nodes).padStart(2) +
      '  连接 +' + String(perf.fallback[fname].edges).padStart(2) +
      '  振荡器 ' + oscs + '  warn ' +
      warnCount(new RegExp('已改用合成音：' + fname + '$')));
  }
  // hover 不受采样影响，仍是合成 tick
  const hb0 = snap();
  const hkc0 = Object.assign({}, stats.kindCounts);
  A2.hover();
  const hkc1 = Object.assign({}, stats.kindCounts);
  const hb1 = snap();
  check(hb1.created - hb0.created > 0, 'hover()（无素材）仍应有合成 tick');
  check(kindDiff(hkc0, hkc1, 'AudioBufferSourceNode') === 1 &&
    kindDiff(hkc0, hkc1, 'OscillatorNode') === 0,
    'hover() 应是 1 个噪声 BufferSource、0 个振荡器');
  await sleep(1200);
  check(snap().edges === baseline2.edges,
    '404 兜底声部应全部回收，残留 ' + (snap().edges - baseline2.edges) + ' 条');
  const fallbackWarns = warnCount(/已改用合成音：/);
  check(fallbackWarns === 7,
    '7 个走兜底的音效应各 warn 1 条（共 7 条），实际 ' + fallbackWarns);
  realConsoleLog('  404 兜底: ' + fallbackNames.join('/') + ' 均产生节点；warn ' +
    fallbackWarns + ' 条（每音效 1 条）');

  /* ---- 引擎 2：用户曲目在"宿主清单不可用"时也能播（纯用户曲目列表） ---- */
  const u2ok = await A2.playBgmTrack('user-music-1');
  check(u2ok === true, '无宿主曲目时也应能播放合并列表里的用户曲目');
  await sleep(1200);
  if (A2.isBgmPlaying()) {
    A2.stopBgm();
    await sleep(900);
  }
  check(snap().edges === baseline2.edges, '引擎 2 停止 BGM 后连接应回到 baseline2');

  /* ---- K. 总账（两个引擎合计） ---- */
  realConsoleLog('');
  realConsoleLog('-- 连接平衡总账 --');
  const finalSnap = snap();
  realConsoleLog('  connect 总次数: ' + stats.connects + '，disconnect 释放边数: ' +
    stats.disconnects + '，常驻音频图连接: ' + finalSnap.edges);
  check(stats.connects - stats.disconnects === finalSnap.edges,
    'connect / disconnect 账不平：connect ' + stats.connects + ' - disconnect ' + stats.disconnects +
    ' = ' + (stats.connects - stats.disconnects) + '，实际常驻 ' + finalSnap.edges);
  check(finalSnap.edges === baseline2.edges,
    '最终连接账不平：当前 ' + finalSnap.edges + '，两个引擎的常驻应为 ' + baseline2.edges);
  console.error = realConsoleError;
  console.warn = realConsoleWarn;
  check(totalErrors() === 0, '引擎向 console.error 写了 ' + totalErrors() + ' 条（应为 0）');
  check(totalWarns() === 8,
    '控制台 warn 应恰好 8 条（1 条坏曲目解码失败 + 7 条合成兜底），实际 ' + totalWarns());

  await sleep(1200);
  const timers = process.getActiveResourcesInfo
    ? process.getActiveResourcesInfo().filter(function (r) { return r === 'Timeout'; }).length
    : -1;
  realConsoleLog('  收尾后仍挂着的 Timeout 定时器: ' + timers + '（应为 0）');
  check(timers === 0, '收尾后仍有 ' + timers + ' 个 Timeout 定时器未清理');

  /* ---- 汇总 ---- */
  realConsoleLog('');
  realConsoleLog('-- 关键数字 --');
  realConsoleLog('  connect ' + stats.connects + ' / disconnect ' + stats.disconnects +
    ' / resident ' + finalSnap.edges + ' / timers ' + timers + ' / console ' +
    totalWarns() + ' warn + ' + totalErrors() + ' error');
  realConsoleLog('');
  if (problems.length === 0) {
    realConsoleLog('==== 结果：全部通过 (PASS) ====');
  } else {
    realConsoleLog('==== 结果：' + problems.length + ' 个问题 ====');
    for (let i = 0; i < problems.length; i++) realConsoleLog('  [' + (i + 1) + '] ' + problems[i]);
  }
  process.exit(problems.length === 0 ? 0 : 1);
})().catch(function (err) {
  console.error('自检脚本本身出错: ', err);
  process.exit(2);
});
