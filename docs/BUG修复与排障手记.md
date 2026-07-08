# CourtSim · Bug 修复与排障手记

> 记录 2026-04 前后推演/编组相关问题的现象、根因、修复与经验，便于回归与新人上手。  
> 相关代码辅助模块见文末「实现索引」。

---

## 经验总览（优先阅读）

1. **Prisma schema 与运行时 Client 必须一致**  
   改过 `schema.prisma` 或拉过含迁移的分支后，应在**停止 `next dev`（及占用 `node_modules\.prisma` 的进程）**后执行 `npx prisma generate`。Windows 上若报 `EPERM` / 无法 rename `query_engine-windows.dll.node`，多为 dev 或杀毒锁定，先关进程再生成。

2. **`Unknown argument` / `Unknown field … for select` 的本质**  
   报错出现在**构造 Prisma 查询时**，说明当前加载的 `@prisma/client` **不认识**该字段（旧 Client、Turbopack 缓存、未 generate 等）。与数据库是否已有列无关：列存在仍会在 Client 校验阶段失败。

3. **缓解策略：对「新列」用 `$queryRaw` / `$executeRaw`**  
   在无法立即保证 Client 刷新的环境下，对易触发校验的字段可集中用带引号的 SQLite 标识符读写（如 `"Scenario"."courtFormation"`），再在应用层合并进 API 响应。长期仍应以 **generate + 删 `.next` 重编** 为主。

4. **API 永远不要「空 body + 5xx」**  
   `fetch().json()` 在空响应上会 `Unexpected end of JSON input`。Route 应用 `try/catch` 统一 `NextResponse.json({ error })`；前端用 **先 `text()` 再 `JSON.parse`**（如 `readApiJson`），并给出中文说明。

5. **长耗时 POST（整轮推演）与前端同步**  
   SSE 触发的 `refresh` 若失败且被吞掉，主栏时间线会一直旧数据。应对：失败写入过程区/错误条；「刚生成」预览**不要**错误依赖 `sim.status === "running"`（本地状态可能滞后）。

6. **产品语义写进界面**  
   「下一轮」在 `currentRound === 0` 时即**第 1 轮**；幕僚「自动起草」≠ 全场百官对话。应用文案与层级（主流程绿钮 vs 可选收束）区分清楚，减少「只有两个按钮」的误解。

7. **重启开发服务**  
   排障时释放端口（如 3000）后重启 `npm run dev`，避免旧进程占库文件或端口。

---

## Bug 条目

### B101 · `courtFormation` — Unknown argument / Unknown field

- **现象**：建议编组、`scenario.update`、`simulation.findUnique` 的 `scenario.select` 等报 `Unknown argument courtFormation` 或 select 不认识该字段。
- **根因**：运行时 Prisma Client 与 schema 不同步；显式 `select`/`update` 含新字段即触发校验。
- **修复**：`src/lib/scenario-court-formation-sql.ts` 用 `$queryRaw`/`$executeRaw` 读写 `"Scenario"."courtFormation"`；`simulate` GET、`next-round` 响应从 Prisma `select` 中移除该字段，查询后合并进 JSON；编组 API、runner 中读编组改为走 SQL 辅助函数。
- **经验**：见上文总览 2、3。

### B102 · `Speech.userDirective` — Unknown field for select

- **现象**：`next-round` / `GET simulate` 等在 `Speech` 上 `select: { userDirective: true }` 报错。
- **根因**：同 B101，Client 无该字段。
- **修复**：`src/lib/speech-user-directive-sql.ts`：批量 `SELECT id, "userDirective"` 合并进响应；查找/清空批注、PATCH 批注走 raw；runner 内 `findFirst`/`update` 改为 raw。
- **经验**：嵌套 `include` 里任何新 scalar 都可能踩坑；批量合并比逐条 raw 更省往返。

### B103 · `Simulation.closeTopicNextRound` — Unknown field for select

- **现象**：`simulation-runner` 中 `findUnique({ select: { closeTopicNextRound } })` 报错。
- **根因**：同 B101；该列随 `Simulation` 表重建迁移加入。
- **修复**：`src/lib/simulation-close-topic-sql.ts` 读写 `"Simulation"."closeTopicNextRound"`；`request-close-topic` 仅 `findUnique({ id })` 判存后用 raw 更新。
- **经验**：布尔列在 SQLite 中可能以 `0/1` 返回，读取时做宽松判断（见 `rowToBool`）。

### B104 · 空响应与 `Unexpected end of JSON input`

- **现象**：点「下一轮」或部分 API 失败时前端抛 `Failed to execute 'json' on 'Response'`。
- **根因**：服务端 500 或未返回 JSON body；客户端直接 `response.json()`。
- **修复**：`src/lib/read-api-json.ts`；`next-round` `POST` 整体 `try/catch` 返回 `{ ok: false, error }`；`SimulateClient`、`FormationBoard` 等统一 `readApiJson`。
- **经验**：见总览 4。

### B105 ·「生成话术」无内容、过程不透明

- **现象**：幕僚接口成功但正文为空；用户感知黑箱。
- **根因**：模型返回空串仍 `200`；前端无上下文说明。
- **修复**：`playable-assist` 对 `trim()` 为空返回 `502` + 明确 `error`；成功返回 `trace`（主视角、最近一轮条数、送入模型摘录等）；前端展示摘要条与实时过程文案。
- **经验**：辅助类接口应对「空输出」显式失败或说明原因。

### B106 · 主栏看不到各角色台词

- **现象**：生成过程中中间时间线空白，误以为未产出。
- **根因**：`liveSpeechPreview` 错误依赖 `sim?.status === "running"`，而 `refresh` 未及时更新；SSE 里 `refresh` 失败被 `catch` 吞掉。
- **修复**：预览不再绑定 `running`；`refreshFromStream` 失败写入过程区与 `setError`；空轮次提示、进行中说明文案；`sp.character?.name` 兜底。
- **经验**：见总览 5。

### B107 · 流程误解：第一轮在哪、幕僚 vs 全场

- **现象**：仅感知「下一轮」与底部「收束」，不知第一次即第 1 轮全场依次发言。
- **根因**：文案未区分 `currentRound === 0` 与后续轮次；幕僚区未强调「仅主视角参考」。
- **修复**：绿钮动态文案（「开始第 1 轮…」/「下一轮：第 N 轮…」）、全场说明卡片、幕僚区与收束区层级与样式（收束为可选次要按钮）。
- **经验**：见总览 6。

---

## 实现索引（代码锚点）

| 主题 | 文件 |
|------|------|
| 编组 JSON 列 raw | `src/lib/scenario-court-formation-sql.ts` |
| 发言批注 raw | `src/lib/speech-user-directive-sql.ts` |
| 收束议题标记 raw | `src/lib/simulation-close-topic-sql.ts` |
| 安全解析 API JSON | `src/lib/read-api-json.ts` |
| 推演引擎 | `src/server/engine/simulation-runner.ts` |
| 推演页 UI | `src/app/scenario/[id]/simulate/SimulateClient.tsx` |

---

## 建议排障顺序（遇到类似报错时）

1. 看服务端日志是否 `PrismaClientValidationError` + `Unknown field` / `Unknown argument`。  
2. 停 `next dev` → `npx prisma generate` → 可选删 `.next` 再 `npm run dev`。  
3. 若短期仍无法刷新 Client，确认对应字段是否已用 raw 辅助读写、API 是否仍对该字段做 Prisma `select`/`data`。  
4. 前端是否仍对可能空 body 使用 `readApiJson`。  
5. 数据库是否已应用迁移（列不存在时 raw SQL 会在 DB 层报错）：`npx prisma migrate deploy`。

---

*文档版本：与仓库内上述实现同步维护；新增 Bug 请按 B1xx 递增编号追加。*
