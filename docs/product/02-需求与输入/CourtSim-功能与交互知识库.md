# CourtSim · 功能与交互知识库

> 用途：把已实现能力、数据字段、接口与界面位置**集中成可查条目**，便于产品、测试与二次开发对齐，不等同于路线图规划（规划见 `01-规划/`）。  
> **代码仓库**：`C:\Users\Administrator\Projects\courtsim`  
> **更新**：2026-04-11 起随迭代在文末「修订记录」追加。

---

## 1. 推演页总览

| 区域 | 作用 |
|------|------|
| **黏顶操作条** | 「开始新推演」创建会话；「下一轮」生成整轮台词；暂停 / 恢复 / 结束本会话。 |
| **朝堂编组** | 拖动人卡：编组列 = 在场 + 列内发言顺序；未入场库 = 本轮不发言；保存 / 依史实建议编组。 |
| **人物档案（左栏）** | 官职、名号、姓名、背景等**中文可读展示**（非裸 JSON）。 |
| **主栏时间线** | 各轮「朝堂对话实录」、轮次摘要、单条发言的场外批注、RAG 折叠等。 |
| **穿越者幕僚** | 仅当场景已设 **主视角人物** 且本会话已开始时：局势建议、自动起草台词（见 §6）。 |
| **实时过程（右栏）** | SSE 摘录：进度、发言顺序、内心/台词摘要。 |
| **页底** | 「下轮全体收束当前议题并给出结果」。 |

更细的编组 / 批注 / 收束与 SSE 类型说明，见 `05-美术风格/CourtSim-推演编组场外批注与议题收束.md`。

---

## 2. 新建场景向导（要点）

| 步骤 | 内容 |
|------|------|
| 人物 | **官职、姓名、背景**均可编辑；自动生成后按**姓名去重**；可设**主视角（穿越附体）**。 |
| 议题 | **快速选题**预设多条；议题类型含历史 / 变体 / 古今对照 / 党争 / 边患 / 改制 / 储位等。 |

---

## 3. 数据模型（与推演相关）

| 模型/字段 | 说明 |
|-----------|------|
| `Scenario.courtFormation` | JSON：`CourtFormation`（`groups`、`groupMembers`、`absentIds`）。 |
| `Scenario.protagonistCharacterId` | 主视角角色 id；用于提示词与幕僚接口。 |
| `Simulation.closeTopicNextRound` | 下一轮注入「收束议题」说明，执行一轮后清除。 |
| `Speech.userDirective` | 用户批注；该角色**下次**发言前注入提示，用毕清空。 |

---

## 4. HTTP 接口速查

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/PUT | `/api/scenario/[id]/formation` | 读/写编组 JSON。 |
| POST | `/api/scenario/[id]/formation/suggest` | 模型建议编组（失败时仍返回 JSON，可能带 `note`）。 |
| PATCH | `/api/speech/[id]/directive` | `{ directive }` 场外批注。 |
| POST | `/api/simulate/[id]/request-close-topic` | 标记下轮收束议题。 |
| POST | `/api/simulate/[id]/playable-assist` | `{ mode: "situation" \| "draft_line" }` 主视角幕僚文本。 |

---

## 5. 提示词与叙事约束（摘要）

- **价值中立**：不以文人史观定性忠奸；各角色以**私利与派系**驱动话术（见 `prompt-builder`）。
- **主视角**：按「穿越附体」描写；他人台词须对主视角有可感知反应（详见仓库内系统提示拼装）。

---

## 6. 主视角幕僚与全自动推演的边界（当前实现）

- **已实现**：任意时刻可请求「局势建议」「自动起草当众台词」文本，供玩家参考或改写。  
- **未实现（若要做需改 runner）**：轮到主视角时**暂停引擎**、仅采用玩家确认后的台词再入库——属于后续需求。

---

## 7. 关键源文件索引

| 路径 | 说明 |
|------|------|
| `src/lib/court-formation.ts` | 编组类型、reconcile、按编组排序、**同名去重**。 |
| `src/lib/character-identity-display.ts` | 身份 JSON → 中文展示。 |
| `src/lib/scene-display.ts` | `humanSceneLabel`，避免界面出现 `grand_court` 等英文 id。 |
| `src/components/courtsim/FormationBoard.tsx` | 编组 UI、安全解析 API 响应。 |
| `src/app/scenario/[id]/simulate/SimulateClient.tsx` | 推演页主逻辑、黏顶按钮、幕僚区、SSE。 |
| `src/server/engine/simulation-runner.ts` | 轮次执行、编组过滤、批注注入、收束轮、SSE 推送。 |
| `src/store/scenario-wizard-store.ts` | `updateCharacter` 等向导状态。 |

---

## 修订记录

| 日期 | 摘要 |
|------|------|
| 2026-04-11 | 初版：推演页结构、向导、字段、接口、幕僚边界、源码索引。 |

---

*文档路径：`F:\cursor项目\CourtSim\02-需求与输入\CourtSim-功能与交互知识库.md`*
