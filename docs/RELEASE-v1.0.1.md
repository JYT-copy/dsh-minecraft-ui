# dsh-minecraft-ui v1.0.1 — 发布说明

> 复制下面 `---` 之间的内容到 GitHub「Draft a new release」的正文即可（标题用 `v1.0.1 — 音效随包开源`）。

---

## 把 DSH Web 界面变成 Minecraft

方块化像素组件 + 可自建的照片壁纸库 + Minecraft 界面音效 + 可自建曲库的 BGM 播放器。
**不额外染色**，颜色全部采样自当前 DSH 主题（含亮/暗色切换），只把「表面」层透明度调低让壁纸透出来。

### 这个版本的重点

- **5 个 Minecraft 界面音效随包开源**：石切机「嗒」的点击声、开箱/关箱声、烟花成就声、木门出错声，
  装机即有声，不用自己找素材。约 60 KB，仍在 `LICENSE` 第三方声明里标明归属（Mojang 素材，不在 MIT 范围内）。
- **默认壁纸 `壁炉小屋`**：一张暗调、温暖的雪夜木屋，作为仓库里唯一随包的壁纸。
- **壁纸库**：内置 + 本地 IndexedDB 上传/删除，自动轮换、亮度、暗化、面板不透明度都可调。
- **BGM**：内置曲目目录（自己放文件即可识别）+ 界面内上传/删除，懒解码 + LRU 3 + 交叉淡入 + 自动接歌。
- **HUD 控制台**：右下角常驻折叠按钮，展开向上长 3 列方块按钮（主题 / 换壁纸 / 音效 / BGM / 下一首 / 隐藏 / 选项），
  可一键隐藏，从设置或 `MinecraftUI.showHud(true)` 找回；开关都播开箱/关箱声。
- **成就弹窗**：切主题、换壁纸、开音效、切曲、上传素材时右上角弹「成就达成」提示。
- **`Ctrl/⌘+Alt+M`** 一键关掉整个主题，回到原生 DSH 外观。

### 安装

```text
git clone https://github.com/JYT-copy/dsh-minecraft-ui.git
plugin_manager install_bundle  <克隆下来的目录绝对路径>
```

装完刷新网页（Ctrl + R），右下角出现方块控制台即成。
听不到声音时先随便点一下界面（浏览器要求先有用户手势才允许播放音频），再开「设置 → Minecraft 主题 → 音效」。

### 素材与版权（请先读）

这是一个**非官方粉丝主题**，与 Mojang Studios / Microsoft 无关。

| 内容 | 是否随包 | 说明 |
| --- | --- | --- |
| 代码 / 样式 / 宿主路由 | ✅ MIT | 自写代码，零第三方依赖、不联网 |
| `cozy-cabin.webp` 基础壁纸 | ✅ | 唯一随包壁纸 |
| `assets/sfx/*.mp3`（5 个音效） | ✅ | Mojang 素材，**不在 MIT 内**；删掉会自动退回合成音效 |
| C418 原声音乐 | ❌ | 需自行准备，音源文件不入库 |
| 其余 Minecraft 美术素材 | ❌ | 不入库 |

详见 [LICENSE](https://github.com/JYT-copy/dsh-minecraft-ui/blob/main/LICENSE) 末尾的第三方声明与
[docs/OPEN-SOURCE.md](https://github.com/JYT-copy/dsh-minecraft-ui/blob/main/docs/OPEN-SOURCE.md)。

### 本版验证

- 构建：`node build.mjs` → 10 个源片段 → `lib/client.js` 237,419 B
- 自检：`test/audio-selftest.cjs`、`test/user-library-test.cjs`、`test/runtime-smoke.cjs`、
  `test/css-parse.cjs`、`test/symbol-audit.cjs`、`test/i18n-audit.cjs` 全部 PASS
- npm 包：20 个文件 / 216 KB，`assets/` 下只有 5 个音效 mp3 + cozy-cabin 两个 webp + 三个 README
- 宿主路由：`/api/minecraft-ui/sounds/*.mp3` 200、`/wallpapers` 200、`/music` 200、不存在的音效 404
- 安装：插件 1.0.1 `applied`，`shell.overlay` 的 HUD/Toast 与 `settings.section` 的主题页均 active

### 已知限制

- 像素级视觉与听感需人眼人耳确认（自动校验覆盖构建、自检、路由、插槽注册）。
- 壁纸与上传的音乐存在浏览器 IndexedDB：换浏览器/清站点数据会丢失；插件目录里的文件不受影响。
- 目录里新放的 BGM/壁纸需刷新页面才出现（界面上传的立刻出现）。
- 未发生点击/按键前不会创建 AudioContext（浏览器策略，不是缺陷）。

---

## 变更记录

### v1.0.1

- 新增：5 个 Minecraft 界面音效随包发布（`assets/sfx/*.mp3`），并补齐 LICENSE / README / docs 的版权说明。
- 文档：仓库与 npm 包清单、素材替换流程、版权投诉处理流程同步更新。

### v1.0.0（首发）

- 方块化像素 UI（按钮 / 卡片 / 导航 / 弹窗 / 输入框），跟随亮暗主题，不染色。
- 照片壁纸库：自动轮换、亮度、暗化、面板不透明度、本地上传与删除。
- 音效引擎：采样播放 + 逐音效合成兜底，点击/开箱/关箱/成功/出错/升级。
- BGM 播放器：目录曲目 + 本地上传，懒解码、LRU 缓存、交叉淡入、自动接歌。
- HUD 控制台、成就弹窗、`Ctrl/⌘+Alt+M` 开关、设置页。
