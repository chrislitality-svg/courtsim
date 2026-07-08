# CourtSim · 推演编组、场外批注与议题收束

本文说明**推演页**上的交互逻辑与后端约定：朝堂编组（人物库/站队）、实时过程可见性、用户对单条发言的「场外批注」、以及「下轮全体收束议题」。与界面设色无关，为便于与《美术风格与朝代主题》一并查阅，暂归档于 `05-美术风格/`；若日后单独设立「功能说明」目录，可将本文整体迁移。

**代码仓库**：`C:\Users\Administrator\Projects\courtsim`

---

## 1. 朝堂编组

### 1.1 用户能做什么

- 在**推演页**顶部「**朝堂编组**」区域：
  - 将角色方块在 **「未入场人物库」** 与各 **编组列** 之间**拖动**，表示谁在场、谁本轮不发言。
  - 在同一列内用 **↑ / ↓** 调整顺序；该顺序即引擎认定的**本轮发言先后**（在品级/轮转规则与编组合并逻辑之下，见代码）。
  - **保存编组**：持久化到场景。
  - **依史实建议编组**：调用场景已配置的对话模型，根据背景与人物表生成编组与「未入场」建议（名称须与人物全名对齐，否则会被过滤）。

### 1.2 数据形态（`CourtFormation`）

存于 `Scenario.courtFormation`（JSON 字符串），类型定义与归一化见 `src/lib/court-formation.ts`：

| 字段 | 含义 |
|------|------|
| `groups` | 编组列表：`{ id, name }`，列标题可改。 |
| `groupMembers` | 每组内角色 id 数组，顺序即发言顺序。 |
| `absentIds` | 未入场角色 id；**不会**在本轮获得发言调用。 |

服务端在每次推演前会做 **reconcile**：与当前场景角色表对齐（新增角色进默认组、删掉的角色剔除），避免脏数据。

### 1.3 API

| 方法 | 路径 | 作用 |
|------|------|------|
| GET | `/api/scenario/[id]/formation` | 返回与角色对齐后的编组 JSON。 |
| PUT | `/api/scenario/[id]/formation` | Body：`{ formation: CourtFormation }`，保存。 |
| POST | `/api/scenario/[id]/formation/suggest` | 模型建议编组并写库。 |

### 1.4 引擎行为

- `src/server/engine/simulation-runner.ts` 中按编组与 `absentIds` 得到有序在场列表；若**无人可发言**，本轮不会建轮次，并通过 SSE 报错提示用户调整编组。

### 1.5 前端组件

- `src/components/courtsim/FormationBoard.tsx`：拖拽、保存、建议编组入口。

---

## 2. 实时过程（拒绝「黑箱」）

### 2.1 目标

用户在点击「下一轮」后，无需干等：能看到**当前生成到第几位**、**本轮发言顺序**，以及每位完成后**内心与台词的摘要**（完整内容仍在正文区刷新后的卡片中）。

### 2.2 SSE 事件（节选）

由 `simulationBusPublish` 推送，客户端在 `SimulateClient` 中解析（右侧「**实时过程**」与时间线文案）：

| `type` | 说明 |
|--------|------|
| `speech_progress` | `characterName`、`index`、`total`、`roundNumber`：正在为该角色请求生成。 |
| `round_roster` | `characterNames[]`：本轮发言顺序（中文名）。 |
| `speech` | 含 `innerMonologue`、`publicSpeech` 等，用于侧栏摘要与中间「刚完成」预览。 |
| `round_done` / `completed` / `error` | 轮次结束、推演结束或错误。 |

---

## 3. 场外批注（用户对单条发言的指令）

### 3.1 功能

- 每一轮中、每条角色发言卡片下方可填写 **「场外批注」**，保存后写入该条 `Speech.userDirective`。
- **下一轮**当该角色再次开口时，引擎把批注注入用户提示（「天语/场外批注」段），**生成完成后清空**该条上的 `userDirective`，避免同一条指令重复生效。

### 3.2 API

| 方法 | 路径 | Body |
|------|------|------|
| PATCH | `/api/speech/[id]/directive` | `{ directive: string \| null }`（空串视为清除） |

### 3.3 注意

- 批注绑定在**某一条历史发言记录**上，而不是角色永久属性；若需长期人设约束，应通过场景/人物档案等其它字段设计（见规划文档）。

---

## 4. 下轮全体收束当前议题

### 4.1 功能

- 推演页底部按钮：**「下轮全体收束当前议题并给出结果」**。
- 将 `Simulation.closeTopicNextRound` 置为 `true`；**下一轮**开始时引擎为每位在场角色注入「收束轮」说明（收口争点、明确态度或决议、勿再横生枝节），该轮执行前会把标记**清回 false**（只影响一轮）。

### 4.2 API

| 方法 | 路径 |
|------|------|
| POST | `/api/simulate/[id]/request-close-topic` |

---

## 5. 场景中文展示（避免英文 id 外露）

- 列表与页眉等处使用 `humanSceneLabel(dynastyId, sceneType)`（`src/lib/scene-display.ts`），将 `grand_court` 等模板 id 转为如「秦 · 大朝会」等可读文案。
- 系统提示中场景行亦已改为中文描述，减少模型在台词中复述英文 id 的概率。

---

## 6. 数据库字段摘要

| 模型 | 字段 | 用途 |
|------|------|------|
| Scenario | `courtFormation` | JSON 编组。 |
| Simulation | `closeTopicNextRound` | 下一轮是否全体收束议题。 |
| Speech | `userDirective` | 场外批注，下次该角色发言消耗。 |

迁移名（示例）：`court_formation_directives`（以仓库 `prisma/migrations` 为准）。

---

## 7. 与「去掉 AI 标识」相关的产品说明

- 界面不再用「AI」角标标注自动生成的人物；自动补全人物与「建议编组」仍依赖场景配置的**模型端点**，在「模型设置」中维护即可。

---

*文档版本：2026-04-11，与当前仓库实现一致；接口路径或字段若有变更，请同步改本文第六节、第三节表格。*
