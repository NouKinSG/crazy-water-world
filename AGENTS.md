# AGENTS.md — 给 AI 编程助手的说明

先读 README.md 了解玩法和目录，再读这份。

## 架构要点

- **单文件交付**：`build.py` 把 `vendor/three.min.js` 和 `src/js/*.js`（按文件名排序拼接）塞进 `src/index.template.html` 的两个占位符 `/*__THREE__*/`、`/*__GAME__*/`，输出 `dist/index.html`。改完源码一定要重新 `python3 build.py`。
- **共享全局作用域**：4 个 JS 文件拼成**同一个** `<script>`，彼此直接引用顶层的 `const` / `let` / `function`，没有 import/export。新文件按 `05-xxx.js` 命名就会自动拼进去。注意顶层 `const` 的暂时性死区：在后面文件里定义的 `const`，不能在前面文件的**顶层立即执行代码**里用（放在函数里、运行时再调用没问题）。
- **Three.js 是 r149 UMD 版**（全局 `THREE`），不是 ES module。用 `outputEncoding` 默认值、`MeshStandardMaterial` + `flatShading` 的低多边形风格。
- **不要引入 npm 依赖或外部 CDN**，保持双击就能离线玩。

## 关键数据和函数（在哪找）

| 东西 | 位置 | 说明 |
|---|---|---|
| `DEFS` / `ORDER` | 01-core | 所有可建造的建筑：名字、图标、造价、解锁等级、描述。加建筑先在这加 |
| `TIERS` | 01-core | 5 个庇护所等级：所需格数和材料 |
| `BUILDERS[type](v)` | 01-core | 每种建筑的 3D 模型。`v` 是 0–999 的造型种子，用它决定样式/颜色/高度，保证读档后外观不变 |
| `makeDebris` / `makeShark` / `makeFeiqiang` / `makeMount` | 01-core | 漂浮物、鲨鱼、肥强、坐骑模型 |
| `G` | 02-gameplay `newState()` | 一局的全部可存档状态：天数、资源、淡水食物生命、等级、天气等 |
| `tiles` | 02-gameplay | `Map<"x,z", tile>`，tile = `{x,z,hp,g,floor,b}`，`b` 是建筑 `{type,v,free,...}` |
| `recount()` / `counts` | 02-gameplay | 统计各建筑数量、木筏中心和半径；改了格子或建筑后要调用 |
| `placeBuilding` / `tryPlace` / `tryDemolish` | 02-gameplay | 放置、玩家建造、拆除 |
| `gameUpdate(dt)` | 02-gameplay | 每帧玩法逻辑（昼夜、生存、刷物资、鲨鱼、炮台、坐骑…） |
| `updateBuildings(dt)` | 02-gameplay | 炮台索敌开火、收集网、阿水自动甩钩。新炮台类建筑在这加逻辑 |
| `renderHUD()` | 03-ui | 界面刷新（用签名字符串避免每帧重建 DOM） |
| `clickAt(p)` | 03-ui | 点击世界坐标后的分发：建造 / 拆除 / 扎鲨鱼 / 修木板 / 甩钩 / 出海 |
| `updateCamera` / `cam` | 03-ui | 镜头：`cam.theta` 水平角、`cam.zoom` 缩放、仰角写死 `el`。做自由视角从这改 |
| `save()` / `loadGame()` | 03-ui | localStorage 键 `crazy-water-world-save-v1`。格子存成 `[x,z,hp,type,v,free]`；加新字段要兼容旧存档 |
| `step(dt)` | 03-ui | 主循环每帧；开场剧情期间走 `updateIntro` 分支 |
| `playIntro` / `CS_SUBS` | 04-story | 开场剧情的时间轴和字幕 |
| `qsay` / `qsayKey` | 04-story | 肥强头顶台词（带冷却） |
| `BOSS_ORDER` / `BOSS_INFO` / `BOSS_AI` | 05-boss | 每 5 天一个 Boss（`spawnBossForDay`），带 `kind` 的走专属行为，没有 `kind` 的深海巨兽沿用鲨鱼逻辑；奖励在 `bossDefeated` |

## 约定

- 界面文字、台词、注释都用中文；广告梗台词集中在 `DAY_TIPS`、`MEME`、`IDLE_LOW/HIGH`、`BUILD_SAY` 等常量里。
- 手机适配：JS 用 `IS_TOUCH` 判断触屏；CSS 在模板末尾的 `@media (max-width: 760px), (max-height: 520px)` 里。新加界面元素记得在这里补小屏样式。
- 视觉：全局只有一个强调色 `--accent`（金黄 #FFC53D），HUD 是深色毛玻璃面板。

## 测试

```bash
python3 tools/smoke_test.py
```

它把一段脚本注入打包后的页面，用无头 Chrome 自动跑：开局、坐骑出海、铺满升满级、造各种建筑、打深海巨兽、拆除、存档读档、开场剧情，最后检查 `window.onerror` 有没有报错。页面上的 `window.__G` 暴露了测试用的句柄（`newGame`、`tryPlace`、`setSel`、`upgrade`、`onClickWorld`、`spawnShark`…）。加了新玩法，顺手在 `TEST_SCRIPT` 里补一段。
