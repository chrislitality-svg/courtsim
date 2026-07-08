# CourtSim · 美术风格与朝代主题

本文档描述 CourtSim 前端的**水墨取向界面规范**：纸色底、墨色字阶、按朝代切换的 accent 设色，以及与工程内 Claude 风格约束（少渐变、少重阴影）的对应关系。

**代码仓库**：`C:\Users\Administrator\Projects\courtsim`

---

## 1. 设计原则

1. **水墨感**：以「纸本 + 墨阶」为主视觉，辅以各朝代代表性的**平面设色**（非照片写实）。
2. **装饰**：远山等图形使用 **SVG 平涂剪影**，不使用渐变填充堆砌质感。
3. **与 Claude 设计系统**：桌面稿 `claude-design-system.md` 强调克制用渐变与阴影；本主题以 **CSS 变量平面色** 实现层次，避免卡片浮起式重阴影。
4. **字体**：正文 Noto Serif SC（`layout.tsx` 注入 `--font-cs-serif`）；标题/标识可用马善政等展示字体（`--font-cs-display`），以仓库当前 `layout.tsx` 为准。

---

## 2. 技术约定

| 项 | 说明 |
|----|------|
| 根包裹 | 页面使用 `DynastyShell`，在根节点设置 `data-dynasty` 与类名 `courtsim-dynasty-root`。 |
| 主题 id | 与 `src/lib/dynasty-theme.ts` 中 `DYNASTY_THEME_IDS` 一致；未知 id 回退 `default`。 |
| 设色 | 在 `src/styles/courtsim-dynasty.css` 内按 `[data-dynasty="…"]` 覆盖 CSS 变量。 |
| 远山 | `InkMountains` 组件，类名 `cs-ink-mountains`，颜色取自 `var(--cs-ink)` 并降低透明度。 |

### 2.1 核心 CSS 变量（默认根下均有定义）

- **底与面**：`--cs-paper`、`--cs-paper-elevated`
- **字阶**：`--cs-ink`、`--cs-ink-muted`、`--cs-ink-faint`
- **线框**：`--cs-border`、`--cs-border-strong`
- **强调**：`--cs-accent`、`--cs-accent-soft`、`--cs-on-accent`
- **语义**：`--cs-link`、`--cs-danger`、`--cs-success`、`--cs-warn`

### 2.2 常用工具类

- **容器**：`cs-surface`（纸本抬色块 + 细边框）
- **按钮**：`cs-btn-primary`、`cs-btn-secondary`
- **分隔**：`cs-rule-top`、`cs-rule-bottom`（双线）
- **导航**：`cs-nav`（配合链接色 `var(--cs-link)`）

Tailwind 中与主题混用时，优先使用 `text-[var(--cs-ink)]` 等形式，避免残留的 `zinc-*` / `violet-*` 固定色。

---

## 3. 朝代与展示名

| `data-dynasty` / 主题 id | 界面展示名（`dynastyThemeLabel`） |
|--------------------------|-----------------------------------|
| `default` | 水墨·通景 |
| `qin` | 秦·玄墨 |
| `han-west` | 西汉·朱漆 |
| `tang` | 唐·青绿 |
| `song-north` | 北宋·天青 |
| `wudai-shiguo` | 五代十国·裂变 |
| `ming` | 明·宫绛 |
| `qing` | 清·石青 |

具体色值以 `courtsim-dynasty.css` 各选择器内变量为准（迭代时只改 CSS 即可，无需改文案表）。

---

## 4. 相关源文件

| 路径 | 作用 |
|------|------|
| `src/styles/courtsim-dynasty.css` | 全局变量与各朝代覆盖 |
| `src/lib/dynasty-theme.ts` | id 归一化与中文展示名 |
| `src/components/courtsim/DynastyShell.tsx` | 根节点 `data-dynasty` |
| `src/components/courtsim/InkMountains.tsx` | 远山剪影 |
| `src/app/globals.css` | `@import` 朝代样式 |
| `src/app/layout.tsx` | 字体 |

---

## 5. 维护说明

- 新增朝代：在 `dynasties` 数据与 `DYNASTY_THEME_IDS` 中注册 id → 在 `courtsim-dynasty.css` 增加 `[data-dynasty="新id"] { … }` → 在 `LABELS` 中增加展示名。
- 新增页面：外层包 `DynastyShell`，`dynastyId` 有场景数据时传入，否则 `null` 使用默认水墨通景。

---

## 6. 相关：推演交互（编组 / 批注 / 收束）

推演页上的朝堂编组、场外批注、议题收束与实时过程说明，见同目录：

- **`CourtSim-推演编组场外批注与议题收束.md`**

---

*文档版本：与 2026-04-11 代码实现对齐；随前端迭代请同步更新第四节路径与第三节表项。*
