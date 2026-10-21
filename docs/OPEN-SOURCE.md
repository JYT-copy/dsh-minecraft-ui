# 开源发布指南（dsh-minecraft-ui）

这份文档回答三件事：**哪些东西能发、哪些不能发**，**怎么在本地把仓库准备好并推到 GitHub**，
以及**开源之后别人怎么装上、怎么自己补音乐和音效**。

---

## 1. 先把版权边界划清楚

插件本身（JS/CSS/宿主路由/构建脚本）是自写代码，用 MIT 发布没问题。
问题全在**素材**上。这个仓库里现在有三种素材，处理方式各不相同：

| 素材 | 位置 | 权利情况 | 仓库里怎么办 |
| --- | --- | --- | --- |
| 代码（`src/`、`index.js`、`build.mjs`） | 仓库根 | 你自己的代码 | ✅ MIT 发布 |
| 基础壁纸 `cozy-cabin.webp` | `assets/wallpapers/` | 你提供的图，允许开源 | ✅ 随仓库发布（仅此一张） |
| 其余 13 张壁纸 | `assets/wallpapers/` | 来源不明 / 非你所有 | ❌ **不提交**，已被 `.gitignore` 忽略 |
| 11 首 C418 原声 | `assets/music/` | C418 / Mojang，受版权保护 | ❌ **不提交** |
| 5 个游戏音效 | `assets/sfx/` | Mojang 素材，但**你决定随包开源** | ✅ 随仓库与 npm 包发布（约 60 KB） |
| 界面截图 | — | 可能含你的私人会话内容 | ❌ 一般不发；发就裁剪、脱敏 |

> 关于音效：这 5 个 mp3 是 Mojang 的游戏素材，严格说不属于 MIT 许可范围，但它们是这个
> 粉丝主题「听起来像原版」的关键，你已经确认可以随包发布，所以现在它们被提交进仓库、
> 也会被打进 npm 包（总计约 60 KB）。**代价是别人 fork 时要自己判断能不能保留**——
> 所以 `LICENSE` 末尾和 `assets/sfx/README.md` 都写明了：它们是 Mojang 财产、
> 不在 MIT 之内、删掉后插件会自动退回合成音（不会坏）。
> 如果哪天想回到保守立场，把 `.gitignore` 里注释掉的那两行恢复即可。

> 音乐与其余壁纸仍然保持排除：C418 原声和第三方壁纸是明确的完整作品，
> 随包分发风险远高于 60 KB 的短音效。

关于 `lib/client.js`（构建产物）：它是你自己代码打包的结果，可以提交，好处是别人 clone 之后
不用装依赖、不用构建就能直接安装插件。

---

## 2. 仓库已经替你准备好的东西

这些文件是本轮新增的，提交前可以直接用：

| 文件 | 作用 |
| --- | --- |
| `LICENSE` | MIT 正文 + 一段「第三方声明」：明确 5 个音效是 Mojang 财产、不在 MIT 之内，音乐/额外壁纸不随包 |
| `.gitignore` | 精确忽略：C418 音乐、除基础壁纸外的所有 webp、`manifest.local.json`、`_src/`、`tmp/`、`node_modules/`（音效**不再**忽略，并在注释里写明怎么恢复） |
| `package.json` → `files` | npm 打包白名单：代码 + 基础壁纸 + `assets/sfx/*.mp3` + 三个 `assets/*/README.md`，**音乐和额外壁纸即使本机有也不会被打进去** |
| `assets/wallpapers/README.md` | 告诉使用者怎么自己加壁纸、manifest 怎么写 |
| `assets/music/README.md` | 告诉使用者为什么目录是空的、音乐放哪、命名规则 |
| `assets/sfx/README.md` | 5 个音效的用途/大小/版权说明，缺失时的合成兜底对照表 |

`assets/wallpapers/manifest.json`（公开清单）只登记了 `cozy-cabin` 一条；
你本机的 13 张写在 `manifest.local.json` 里，该文件已被 gitignore。

---

## 3. 本地仓库状态（已经初始化好了）

`git init` + 第一个提交已经完成，`v1.0.0` 标签也已打好。当前仓库：

- **37 个文件**被跟踪，`.git` 目录仅 0.3 MB；
- `assets/` 下只有 6 个文件：`cozy-cabin.webp`、`cozy-cabin.thumb.webp`、`manifest.json`、三个 README；
- 音乐（18.5 MB）、音效、其余 13 张壁纸、`manifest.local.json`、`tmp/` **都不在仓库里**。

想自己复核一遍（应该没有输出、或者只剩无意义的空行）：

```powershell
# ① 暂存区/仓库里绝对不能出现这些路径
git ls-files | Select-String -Pattern 'assets/(music|sfx)/.+\.(mp3|ogg|oga|m4a|wav|flac)$|manifest\.local\.json|_src/|^tmp/'

# ② 仓库里到底有哪些素材：应该只有上面那 6 个
git ls-files assets

# ③ 体积
git ls-files -z | Measure-Object -Character   # 或直接看仓库大小
```

`.gitattributes` 已把换行统一成 LF，并声明 `*.webp/*.png/*.ogg/*.mp3` 为二进制，
所以以后在 Windows 上提交也不会出现「整文件都变了」的 diff。

如果之后你想重来一遍（比如想改成别的首个提交信息）：

```powershell
Remove-Item -Recurse -Force .git
git init
git add -A
git commit -m "feat: dsh-minecraft-ui 1.0.0 — Minecraft 主题界面插件"
git branch -M main
git tag v1.0.0
```

> 注意：`.gitignore` 对**已经跟踪**的文件无效。如果哪天误把音乐 `git add` 进去过，
> 必须 `git rm --cached <路径>` 才移得出来。

---

## 4. 推到 GitHub

1. 打开 <https://github.com/new>，仓库名建议 `dsh-minecraft-ui`；
   **不要**勾选 “Add a README / .gitignore / license”，本地已经有了。
2. 关联并推送：

```powershell
git remote add origin https://github.com/<你的用户名>/dsh-minecraft-ui.git
git branch -M main
git push -u origin main --follow-tags
```

3. 在仓库右侧 About 里填一句英文简介、加 topics：`dsh`、`dsh-plugin`、`minecraft`、`theme`、`pixel-ui`。
4. 建议在仓库描述或 README 顶部保留这句声明：
   *Unofficial fan theme. Not affiliated with Mojang or Microsoft. Includes a few Minecraft sound
   samples for UI feedback, under a third-party notice (not MIT).*

---

## 5. 别人怎么装

对方先拿到仓库（clone 或下载 zip），然后用 DSH 的插件安装机制装上：

```text
# DSH 的插件安装工具（GUI 插件面板 / agent 的 plugin_manager 工具同理）
plugin_manager install_bundle  <仓库在本机的绝对路径>
```

`install_bundle` 会做两件事：把包加进 profile 的依赖，并把包名写进 `dsh.profile.bundles`。
（不要手动改 profile 的 `package.json` / `cordis.patch.yml`，也不要在 profile 里跑 pnpm——
这是 DSH 自己管理的部分。）

装完 **刷新网页（Ctrl + R）**，右下角出现方块控制台即成。
若听不到声音：先随便点一下界面（浏览器要求先有用户手势才能播音频），再开「设置 → Minecraft 主题 → 音效」。

---

## 6. 开源之后：使用者自己补素材

| 想补什么 | 怎么做 | 是否需要重新构建 |
| --- | --- | --- |
| 壁纸 | 界面里「上传壁纸」，或把 `<slug>.webp` 放进 `assets/wallpapers/` 并写 `manifest.json` | 放文件夹需要 Ctrl+R；界面上传不用 |
| BGM | 界面里「设置 → 背景音乐 → 上传音乐」，或把音频放进 `assets/music/` | 放文件夹需要 Ctrl+R；界面上传不用 |
| 音效 | **已经自带 5 个**；想换音色就覆盖同名 mp3（文件名见该目录 README），想关掉就删掉文件 | 需要 Ctrl+R |

三处都**不需要**重新 build，也不需要重新安装插件：宿主端是按目录实时读取的。
删掉 `assets/sfx/*.mp3` 也不会坏——每个音效都有合成兜底。

---

## 7. 可选：发到 npm

```powershell
npm login
npm publish --dry-run     # 先看清单：应有代码 + cozy-cabin 两个 webp + assets/sfx/*.mp3 + 三个 README
npm publish
```

`files` 白名单已经写好，`--dry-run` 的输出里 `assets/` 下应该只有
`cozy-cabin*.webp`、`assets/sfx/*.mp3`（5 个）和三个 `assets/*/README.md`；
**不应该**出现任何 `assets/music/` 音频，也不应出现第 3 张壁纸。
别人装 npm 包的方式同理：`plugin_manager install_bundle dsh-minecraft-ui`。

---

## 8. 维护流程（以后每改一版）

```powershell
node build.mjs                       # 重新生成 lib/client.js
node test\audio-selftest.cjs         # 音频引擎自检（如改了 30-audio.js）
node test\user-library-test.cjs      # IndexedDB 壁纸/音乐库自检
node test\runtime-smoke.cjs          # 选项存储自检
node test\css-parse.cjs              # MC_CSS 解析检查
node test\i18n-audit.cjs             # 中英文字典键覆盖检查
node test\symbol-audit.cjs           # 模板字符串里没有反引号等硬伤
git add -A; git commit -m "fix: ..."; git tag v1.0.x; git push --follow-tags
```

> `MC_CSS` 是一整段模板字符串，**里面不能出现反引号**，否则构建会以
> `Invalid left-hand side expression in postfix operation` 报错——这是踩过的坑。

---

## 9. 万一收到版权投诉

1. 不要争辩，先处理投诉指向的内容：删掉对应的素材文件并提交，README/Release 里说明已移除；
2. 检查 Issue/PR 里有没有人贴了素材文件或直链，删掉；
3. **如果投诉的是那 5 个音效**：删除 `assets/sfx/*.mp3`（保留 README），
   从 `package.json` 的 `files` 里去掉 `assets/sfx/*.mp3`，并在 README 的第三方声明里改成
   「本项目不含任何 Minecraft 素材，用户需自备」。插件会自动退回合成音，功能不受影响；
4. 如果是 `cozy-cabin.webp` 这张基础壁纸被投诉，把它从仓库删除，并在 `manifest.json` 里清空
   `photos`，插件会自动进入「无壁纸」状态（仍然可用，只是没有背景图）；
5. 顺手在 `.gitignore` 里恢复 `assets/sfx/*` 那两行，避免以后又误提交。
