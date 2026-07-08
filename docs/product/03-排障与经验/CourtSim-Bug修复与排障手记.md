# CourtSim · Bug 修复与排障手记

> 用途：记录典型故障的现象、根因、排查步骤与整改经验，便于后续同类问题快速定位与预防。  
> 维护方式：按时间或按编号在文末「条目索引」追加新小节即可。

---

## 条目索引

| 编号 | 日期       | 标题 |
|------|------------|------|
| B001 | 2026-04-11 | localhost:3000「打不开」实为首页 500：Prisma Client 与 schema 不同步 |
| B002 | 2026-04-11 | 时间轴「进入向导」后仍停在第 1 步：`setDynasty` 误清空时间锚点 |
| B003 | 2026-04-11 | 「依史实建议编组」前端 `Unexpected end of JSON input`；编组出现两名同姓名 |

---

## B001 · localhost:3000「打不开」实为首页 500：Prisma Client 与 schema 不同步

### 现象

- 浏览器访问 `http://localhost:3000/` 无法正常显示（白屏、错误页或持续加载失败等「像连不上」的表现）。
- 本机 `netstat` 显示 **3000 端口仍在 LISTENING**（说明 HTTP 服务在，并非「端口没起来」）。

### 根因

- 首页（如 `src/app/page.tsx`）使用 Prisma 查询 `Scenario`，`select` 中包含 **`projectId`**、**`project`** 等字段。
- 磁盘上的 **`@prisma/client` 由旧版 `schema.prisma` 生成**，与当前 schema 不一致。
- 运行时抛出 **`PrismaClientValidationError`**，例如：`Unknown field 'projectId' for select statement on model 'Scenario'`。
- Next.js 服务端渲染该页失败 → **HTTP 500**，用户侧体感为「站点打不开」。

### 排查要点

1. **区分「端口无服务」与「有服务但返回错误」**  
   - 无服务：连接被拒绝、超时。  
   - 有服务：能连上但状态码 4xx/5xx（可用 `Invoke-WebRequest`、`curl` 看状态码）。

2. **看 Next 开发日志**  
   - 路径示例：`<项目>/.next/dev/logs/next-development.log`  
   - 搜索 `ERROR`、`PrismaClientValidationError`、`Unknown field`。

3. **对照 `prisma/schema.prisma` 与 `node_modules` 中的生成物**  
   - 若近期改过 schema、迁移过数据库，但未成功执行 `prisma generate`，易出现此类不一致。

### 整改步骤（Windows）

1. **停止占用 Prisma 引擎文件的进程**（通常是正在运行的 `next dev`）  
   - 否则执行 `npx prisma generate` 可能报：  
     `EPERM: operation not permitted, rename ... query_engine-windows.dll.node.tmp...`  
   - 可先 `taskkill /PID <pid> /F` 结束对应 Node/Next 进程，再生成客户端。

2. 在项目根目录执行：  
   `npx prisma generate`

3. 重新启动开发服务：  
   `npm run dev`

4. 再次访问首页，确认 **GET / 为 200**（或等价健康检查）。

### 预防与规范

- **修改 `schema.prisma` 或迁移之后**：在启动/继续 `next dev` 前，确保已成功执行 `prisma generate`（`npm run build` 里若包含 `prisma generate` 也可在发版前兜底）。
- **Windows 上**：若 `prisma generate` 报 EPERM，优先关闭所有使用该项目的 `next dev` / 测试进程，必要时关闭会锁定 `node_modules` 的 IDE/杀毒实时扫描后再试。
- **团队习惯**：在 PR/提交说明里注明「是否动过 Prisma」，提醒协作者本地 `generate` + 重启 dev。

### 相关文件（便于回溯）

- 应用首页查询：`src/app/page.tsx`（示例：`prisma.scenario.findMany` 的 `select`）
- Schema：`prisma/schema.prisma`（`Scenario` 上的 `projectId`、`project` 等）
- 生成客户端：`npx prisma generate` → `node_modules/@prisma/client`、`node_modules/.prisma/client`

---

## B002 · 时间轴「进入向导」后仍停在第 1 步：`setDynasty` 误清空时间锚点

### 现象

- 路径：首页 → 新建场景 → 横向时间轴 → 选朝代（如明）→ 轨道 A → 选年号（如建文）→ 点击「完成时间定位，进入向导」。
- 进入 `/create` 后仍显示 **「选择朝代与时间锚点」**（向导第 1 步），时间锚点像被清空，需重新选择；体感像死循环。

### 根因

- `TimelineClient.tsx` 的 `commit()` 在 `router.push("/create")` 前调用了 `s.setDynasty(dynId)`。
- `scenario-wizard-store` 里原 `setDynasty` **无论是否切换朝代**，都会执行 `periodId: null`、`timeKind: null`、`year: null`，清空已选时间锚点。
- 时间轴上朝代早已写入 store，再 `setDynasty` 同一代号等于 **重复设置同一朝代**，却把刚选好的年号/大事抹掉。
- `step` 默认仍为 `1`，故用户仍看到第 1 步。

### 整改

1. **`setDynasty`**：仅当 `dynastyId` **相对当前 state 发生变化**时才清空时间锚点；若与当前相同则 `return {}`（不覆盖 `periodId` 等）。
2. **`commit()`**：在跳转前增加 `s.setStep(2)`，使从时间轴「完成定位」后直接进入 **场景** 步，与时间轴已闭环的语义一致。

### 相关文件

- `src/store/scenario-wizard-store.ts` — `setDynasty`
- `src/app/create/timeline/TimelineClient.tsx` — `commit()`

### 预防

- 对「幂等」的 store 写入要区分：**切换业务维度**（换朝代）才级联清空依赖字段；**重复写入同一主键**不应破坏已填从属数据。
- 跨页跳转前检查是否有多余的 reset 调用。

---

## B003 · 「依史实建议编组」前端 `Unexpected end of JSON input`；编组出现两名同姓名

### 现象

1. 推演页点击「依史实建议编组」后，浏览器报错：**`Failed to execute 'json' on 'Response': Unexpected end of JSON input`**。  
2. 「朝班」列表中出现**两名同姓名**（如两个「魏忠贤」），用户困惑且可能影响发言顺序预期。

### 根因（1：JSON）

- `POST /api/scenario/[id]/formation/suggest` 内部调用大模型；若 **`chatCompletions` 抛错**或网关超时，路由若**未捕获异常**，Next 可能返回 **500 且 body 为空或非 JSON**。  
- 前端 **`await response.json()`** 在空 body 上会触发上述错误，错误信息对用户不友好。

### 根因（2：重名）

- 模型生成人物时可能输出**同名两条**数据库角色；或建议编组 JSON 中重复列出同姓名。  
- 原 `reconcileFormation` / 发言排序**仅按角色 id 去重**，不按**姓名**合并，导致界面上两人、推演中也可能同姓名发两轮。

### 整改

1. **服务端**：`suggest/route.ts` **整体 `try/catch`**；模型失败时仍 **`return NextResponse.json({ ok, formation, note })`**，保证有 JSON。  
2. **前端**：`FormationBoard` 使用 **`readApiJson`**：先 `text()`，非空再 `JSON.parse`，否则抛出**中文可读的**业务错误。  
3. **编组与引擎**：`court-formation.ts` 中 `reconcileFormation` 按**姓名**保留**先出现在角色表中的 id**；`orderCharactersByFormation` 按姓名跳过已发言，避免一轮重复。  
4. **向导**：`generatePersonnel` 成功后对列表再按**姓名去重**再写入 store。

### 排查要点

- Network 面板查看 suggest 请求的 **Status** 与 **Response 是否为空**。  
- 服务端日志是否有 **`OpenAI-compatible HTTP`** / **`Anthropic HTTP`** 等来自 `unified-client` 的异常。

### 预防

- 所有**可能失败**的 API Route：**禁止**让未捕获异常落到空响应；客户端对 **`r.json()`** 前先看 **`r.ok`** 与 **body 长度**（或统一封装 `readApiJson`）。  
- 人物展示与发言顺序若需「一人一号」：在**合并层**（编组 reconcile + 排序）对 **name** 做规范，并在**生成入口**去重。

### 相关文件

- `src/app/api/scenario/[id]/formation/suggest/route.ts`  
- `src/components/courtsim/FormationBoard.tsx`  
- `src/lib/court-formation.ts`  
- `src/app/create/page.tsx`（`generatePersonnel`）

---

## 模板 · 新增条目时请复制本节并改编号

### B00X · （一句话标题）

**日期**：YYYY-MM-DD  

**现象**：  

**根因**：  

**排查**：  

**整改**：  

**预防**：  

---

*文档路径：`F:\cursor项目\CourtSim\03-排障与经验\CourtSim-Bug修复与排障手记.md`*
