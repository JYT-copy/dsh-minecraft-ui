# v1.1.0 — 个人素材目录：升级不再吃掉你的壁纸和 BGM

> 一句话：把 npm 包换成「只带模板与音效」，你自己的壁纸/音乐放进安装目录之外的
> `~/.dsh/minecraft-ui/assets/`，以后升级不再丢。

## 为什么有这个版本

1.0.1 装成 npm 包之后，有人（就是我）发现：原本在 `assets/wallpapers`、`assets/music`
里的私人壁纸和 C418 音乐全没了。原因是 npm 安装是**整包替换**，而开源包按版权只能带
1 张示例壁纸 + 5 个短音效；往 `node_modules/dsh-minecraft-theme/assets/` 里补文件，
下一次 `install_bundle` 就会连目录一起换掉。

所以宿主端从这一版开始，除了读包内 `assets/`，还会读一个**个人素材目录**：

```text
~/.dsh/minecraft-ui/assets/          # 可用环境变量 MC_UI_ASSETS_DIR 改位置
├── wallpapers/   # <slug>.webp、<slug>.thumb.webp、manifest.local.json
├── sfx/          # 与包内同名的 .mp3 会覆盖包内音效
└── music/        # ogg / oga / mp3 / m4a / wav / flac
```

规则：

- 个人目录优先级高于包内目录，**同名文件以个人为准**；
- 壁纸清单 = 包内 `manifest.json` + 个人 `manifest.local.json` + 两个目录里真实存在的文件，同 slug 合并；
- `sfx/` 放同名 mp3 就能换音色，删掉包内的则退回合成音；
- 目录不存在、子目录为空都不报错，自动回退到包内素材；
- 宿主启动日志会打印实际生效的目录：`[dsh-minecraft-theme] personal assets directory: …`。

界面里「上传壁纸 / 上传音乐」仍然可用（存浏览器 IndexedDB，跨插件升级也保留），
区别是：文件系统里的素材能跟着用户走，IndexedDB 只跟着这个浏览器。

## 顺带修掉的

- **`assets/wallpapers/manifest.json` 补进 npm `files`**。之前漏了它，npm 安装后默认壁纸
  显示成 `Cozy Cabin`（由 slug 拼的名字）而不是 `壁炉小屋`。

## 验证

- `node build.mjs` → 10 个源片段，`lib/client.js` 232.0 KiB。
- `node test/asset-dirs.cjs`（新增）→ **16 PASS / 0 FAIL**：合并清单、个人字节优先、
  同名音效覆盖、404/405、目录缺失回退。
- 其余六项自检全绿：`audio-selftest`（321/307 节点配平、8 warn 0 error）、
  `user-library-test`、`runtime-smoke`、`css-parse`（0 warning）、`symbol-audit`、`i18n-audit`。
- 端到端：从 registry 装回 `1.1.0`（包内无音乐、无额外壁纸）后，把个人素材放进
  `~/.dsh/minecraft-ui/assets/`，`/api/minecraft-ui/wallpapers` → **14 张**（含 `壁炉小屋`）、
  `/api/minecraft-ui/music` → **12 首**、音效 200、未知壁纸 404。

## 从 1.0.1 升级

```powershell
plugin_manager remove_bundle dsh-minecraft-theme
plugin_manager install_bundle  dsh-minecraft-theme@1.1.0
# 然后把自己的素材复制到下面两个目录（目录不存在就自己建）：
#   %USERPROFILE%\.dsh\minecraft-ui\assets\wallpapers
#   %USERPROFILE%\.dsh\minecraft-ui\assets\music
# 完事 Ctrl+R 刷新页面
```
