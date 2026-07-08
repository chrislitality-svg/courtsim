# 朝堂风云 — 多Agent历史场景推演引擎

## 项目代号：CourtSim（朝堂模拟器）

> **版本：V3** — 新增朝代元数据系统、职官架构自动生成、多元场景类型、前后端分离架构  
> **修订：V3.1（2026-04）** — 时间轴升级为 **「皇帝年号序列 + 关键事件锚点」** 双轨；增加 **多政权/并立形势说明（`polity_context`）**；API 与创建向导第 1 步已对齐实现。下文 YAML/流程图中 **粗体** 为相对 V3 初版有变更之处。  
> **修订：V3.2（2026-04）** — **模型设置合并**（LLM + Embedding 同页标签）；**史料库项目化**（`Project` + `KnowledgeCollection` + 场景 `projectId`）；**朝代样本**去掉北洋、新增五代十国；详见下文「〇、V3.2 用户诉求与实现说明」。  
> **修订：V3.3（2026-04）** — **全朝代横向时间轴一级页**；**向导强制时间锚点二选一**；**按发言逐条 RAG + dialogueMeta 论辩钩连**；**滑动窗口上下文 + 轮次 LLM 摘要**；**关系网络示意页**；**章回体总结 API/UI**；**主视角角色 + 玩家指令**；详见「〇.1、V3.3」。  
> **修订：V3.4（2026-04）** — 对齐 `CourtSim-深度需求与技术难点-完整版.md`（扩写稿 v1.0）：**轮次政治状态 JSON**、**RAG 戏剧化指引**、**章回体风格宪章**、**真实度三档与产品文档一致**、**时间轴首访引导**；详见「〇.2、V3.4」。

---

## 〇、V3.2 用户诉求与实现说明（技术路线）

### 用户诉求（本轮）

1. **前端**：首页不再单独放 Embedding 入口，将 Embedding 配置**纳入「模型设置」**同一页面（标签切换）。
2. **史料库**：对标 Agent 知识库习惯，支持**按分组（Collection）存放文档**；文档与**场景**通过既有 `ScenarioKnowledge` 关联，与**项目**通过 `Scenario.projectId` + `KnowledgeCollection.projectId` 形成同域归档。
3. **朝代数据**：**删除北洋政府**样本配置；**增加五代十国**样本（`wudai-shiguo.ts`，`id: wudai-shiguo`）。
4. **文档同步**：本规划文档需记录上述诉求、已做事项与**可执行技术路线**，便于后续迭代对齐。

### 工程已落实摘要（`courtsim` 仓库）


| 方向   | 内容                                                                                                                                                                                                                                                                                |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 模型设置 | `/settings/models` 内 **「LLM 端点                                                                                                                                                                                                                                                    |
| 数据模型 | 新增 `**Project`**、`**KnowledgeCollection`**；`KnowledgeSource.collectionId`；`Scenario.projectId`（删除项目时场景 `projectId` 置空）                                                                                                                                                            |
| API  | `GET/POST /api/project`、`PATCH/DELETE /api/project/[id]`；`GET/POST /api/knowledge/collection`、`PATCH/DELETE /api/knowledge/collection/[id]`；`PATCH /api/knowledge/[id]`（调整 `collectionId`）；`GET /api/knowledge` 支持 `?collectionId=`、`?projectId=` 并返回关联场景列表；上传表单支持 `collectionId` |
| 前端   | **史料库**两栏：左侧项目 + 分组 CRUD 与筛选，右侧文档列表、移动到分组、已关联场景链接；**创建向导第 6 步**可选 **所属项目**；首页 / 场景详情展示项目标签                                                                                                                                                                                        |
| 朝代   | 注册表：**秦、西汉、唐、北宋、五代十国、明、清**（北洋 `beiyang.ts` 已移除）                                                                                                                                                                                                                                   |


### 技术路线（给后续开发的约束说明）

1. **为何用 Project + Collection 两层**
  - **Project**：用户可见的「课题 / 产品线」边界，与**场景**强绑定（`Scenario.projectId`），首页与场景页可一眼识别归属。  
  - **KnowledgeCollection**：Agent 式 **知识库分组**，可多组同项目；`KnowledgeSource` 只挂 `collectionId`，避免文档与项目多对多爆炸；需要「按项目筛文档」时通过 `collection.projectId` 或 `GET /api/knowledge?projectId=` 推导。
2. **文档—场景连接**：仍用 `**ScenarioKnowledge` 多对多**（向导第 6 步勾选）；史料库列表从 `KnowledgeSource.scenarios` 反查展示链接，不在此重复建表。
3. **模型配置 UI**：Embedding 与 LLM **同路由**减少导航碎片；**REST 仍为** `/api/model/embedding/`*，与 `/api/model/endpoint/`* 分离，便于密钥与维度探测独立演进。
4. **朝代扩展**：新样本在 `src/data/dynasties/*.ts` 导出 `DynastyProfile` 并在 `index.ts` 注册；**覆盖范围**一节仍保留「民初/北洋」历史跨度描述，**可选朝代列表**以注册表为准。

---

## 〇.1、V3.3 大规模交互与叙事增强（技术路线摘要）

### 用户诉求（本轮）

1. **时间轴**：全朝代**横向滑动**一级页面 `/create/timeline`；**年号主线 / 关键事件**两轨道互斥，须选定一项后才可进入向导；大事补充**政变 / 改革 / 政治**等标签与更多名场面；各朝**专属场景**扩展（如明厂卫、清理藩院、宋中书草诏等）。
2. **推演 UI**：**每条发言**展示对应 **RAG 史料块**；对话须体现**反驳、赞同、攻讦**等与上文钩连，并强调**皇权裁判**身份（系统提示词约束 + `dialogueMeta` JSON）。
3. **上下文**：**滑动窗口**（`rules.context_window_rounds` / `context_max_chars`）+ **每轮结束 LLM 摘要**写入 `Round.summary`（`enable_round_summary`）。
4. **关系网**：`/scenario/[id]/network` 根据 `relationships` JSON（allies/rivals/edges）绘制 **SVG 示意**。
5. **章回体**：`POST /api/simulate/[id]/chapter-report` 生成叙事总结，存 `Simulation.chapterReport`。
6. **主视角**：向导第 3 步 **「设为主视角」**；`Scenario.protagonistCharacterId` + `protagonist.playableDirectives` 注入 Prompt。
7. **外部分析**：桌面 `**CourtSim-深度需求与技术难点-O4.6输入稿.md`** 列出难点、决策点、案例提纲，交由 Opus 4.6 扩写后回灌文档与验收标准。

### 工程实现要点


| 模块            | 说明                                                                               |
| ------------- | -------------------------------------------------------------------------------- |
| 时间轴           | `TimelineClient` + Zustand；首页「新建场景」链至 `/create/timeline`；向导第 1 步校验 `periodId`    |
| 论辩            | `prompt-builder` 增加论辩/皇权段落；`parseSpeechJson` → `Speech.dialogueMeta`             |
| RAG           | `simulation-runner` **按角色**检索，`Speech.sourceRefs` 存 `chunks[]` 与摘录               |
| 摘要            | 每轮结束后写 `Round.summary`；**V3.4** 起同步解析写入 `Round.politicalState`（政治状态 JSON），见「〇.2」 |
| 规则 JSON       | 默认含 `context_window_rounds`、`context_max_chars`、`enable_round_summary`           |
| 主视角           | 保存人物后 `PUT` 写入 `protagonistCharacterId`                                          |
| 大事 `category` | `HighlightEvent.category` 可选，供时间轴筛选                                              |


### Opus 4.6 工作流

1. 读取桌面 `**CourtSim-深度需求与技术难点-O4.6输入稿.md`** 骨架。
2. 扩写难点分析、方案对比、历史案例剧本与评测标准。
3. 将定稿链接或粘贴回版本库/本规划文档附录（由维护者合并）。

---

## 〇.2、V3.4 对齐《深度需求与技术难点（完整版）》（工程落地）

### 输入文档

- **主输入**：`CourtSim-深度需求与技术难点-完整版.md`（扩写稿 v1.0，2026-04），路径建议归档于 `F:\cursor项目\CourtSim\02-需求与输入\` 或与下载目录同步。
- **文档结构**：产品定位与三种模式、困难点深度分析、技术决策点（向量/SSE/摘要/关系图等）、历史案例库、名场面剧本纲要、**P0–P3 路线图**、评测方案与术语表。

### 本轮已在代码库落实的优化


| 方向                     | 说明                                                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **政治状态摘要（P0 部分）**      | 迁移新增 `Round.politicalState`（JSON 文本）：每轮结束后由摘要模型输出 **【摘要】+【政治状态JSON】**，解析后写入；字段含 `factionStances`、`emperorSignals`、`keyEvents`、`openQuestions`（与完整版 §2.2 建议一致）。`buildPriorContextForSimulation` 在滑动窗口**外**轮次优先注入结构化政治要点，再附短综述，利于控制上下文 token。 |
| **质量标记占位（P0 预留）**      | 迁移新增 `Simulation.qualityFlags`（JSON 文本，可选），供后续「幻觉后验检测」异步写入（完整版 §2.1 第三层）。                                                                                                                                                                   |
| **RAG 与戏剧冲突（§2.3）**    | `simulation-runner` 用户提示中将史料块改为「**角色内在知识储备**」，明确要求台词保持戏剧情境、避免奏疏/公文体照搬。                                                                                                                                                                      |
| **章回体风格宪章（§2.8 / P1）** | `chapter-report` API 系统提示增加**禁用网文腔、少用心理独白、套语使用说明**等，与完整版「风格宪章」对齐（实现为 prompt 约束，尚未单独建示例库）。                                                                                                                                                   |
| **三种使用模式命名（§1.2）**     | `getFidelityBlock`：`strict` ↔ 严格史实（Strict）；默认 `moderate` ↔ 史实框架内演绎（Deductive）；`fiction` ↔ 架空（Counterfactual）。与 `scenario.fidelity` 字段一一对应，无需新增 `simulationMode` 列即可统一叙事。                                                                    |
| **时间轴首访 UX（§3.5）**     | `/create/timeline` 增加可关闭的**欢迎卡片**（`sessionStorage` 记忆），降低首访认知负担。                                                                                                                                                                            |


### 相关代码与迁移

- `prisma/schema.prisma`：`Round.politicalState`、`Simulation.qualityFlags`
- `src/server/engine/political-state.ts`：解析与上下文格式化
- `src/server/engine/simulation-runner.ts`：轮次摘要 prompt、落库
- `src/server/engine/simulation-context.ts`：窗口外轮次注入逻辑
- `src/server/engine/fidelity.ts`：三档说明
- `src/app/api/simulate/[id]/chapter-report/route.ts`：章回体 prompt
- `src/app/scenario/[id]/simulate/SimulateClient.tsx`：轮次「政治状态」折叠展示
- `src/app/create/timeline/TimelineClient.tsx`：首访引导

### 完整版中仍待排期（与 P0–P3 对齐，未在本轮实现）


| 优先级 | 项                                     | 备注                  |
| --- | ------------------------------------- | ------------------- |
| P0  | 皇权介入触发 + 皇帝行为菜单 UI                    | 完整版 §2.4；需引擎条件 + 前端 |
| P0  | 主要名场面关系网**预置数据**                      | §2.7；数据包或种子         |
| P0  | `qualityFlags` **实际写入**               | 依赖轻量校验提示或规则         |
| P1  | 信息层级上下文（主视角信息裁切）                      | §2.9                |
| P1  | `dialogueMeta` JSON Schema / Tool Use | §3.4                |
| P2  | SSE 多实例：`SimulationEvent` + 轮询        | §3.3                |
| P2  | 向量存储迁移评估（pgvector / sqlite-vss）       | §3.1                |
| P2  | 关系图 Sigma.js / 力导向                    | §3.6                |
| P3  | 教育过滤、国际化、多人协作等                        | 第六节表                |


### 文档维护

- 完整版中的**案例库、剧本纲要、评测 Rubric** 作为产品与测试验收的扩展清单；本规划以**版本修订 + 上表**追踪实现状态，避免与代码脱节。

---

## 一、项目定位

> 一个跨越上古至清末民初的通用历史推演平台。用户选择朝代和时期，系统自动生成该时期的职官架构与人物配置；用户设定场景类型、议题和目的，AI驱动的角色群体在权力结构、身份约束和史料参照下进行多轮博弈对话。

### 覆盖范围

```
上古 → 夏 → 商 → 西周 → 东周(春秋/战国) → 秦 → 西汉 → 东汉 → 
三国 → 西晋 → 东晋/十六国 → 南北朝 → 隋 → 唐 → 五代十国 → 
北宋 → 南宋/金 → 元 → 明 → 清 → 清末新政 → 民初/北洋
```

---

## 二、核心新增：朝代元数据系统 (Dynasty Metadata)

这是支撑"跨朝代通用"的基础设施。每个朝代是一套完整的配置包。

### 2.1 朝代配置包结构

```yaml
# 以"明·天启"为例的完整朝代配置包

dynasty_profile:
  # === 基本信息 ===
  id: "ming"
  name: "明"
  period: "1368-1644"
  # sub_periods: 已弃用为唯一时间源；可留空，仅作兼容旧数据解析
  sub_periods: []
  # **V3.1** 时间主轴一：按皇帝年号细分（可含 notes 说明并立政权、易代等）
  era_segments:
    - id: "ming-nh-hongwu"
      name: "洪武"
      nianhao: "洪武"
      emperor: "太祖朱元璋"
      years: "1368-1398"
    - id: "ming-nh-jiajing"
      name: "嘉靖"
      nianhao: "嘉靖"
      emperor: "世宗朱厚熜"
      years: "1522-1566"
      notes: "大礼议等礼法—皇权冲突高发期"
    # … 其余年号略；实现中明/唐/清已铺主干年号；另含秦、西汉、北宋、五代十国等 Phase 5 样本包
  # **V3.1** 时间主轴二：关键事件 / 名场面（与年号轴 UI 二选一，存库 periodId 可为 evt:{id}）
  highlight_events:
    - id: "ming-ev-jingnan"
      name: "靖难之役"
      yearsLabel: "1399-1402"
      anchorYear: 1399
      description: "燕王朱棣夺位，非北宋靖康之变"
    - id: "ming-ev-tumu"
      name: "土木堡之变"
      yearsLabel: "1449"
      anchorYear: 1449
      description: "英宗亲征瓦剌兵败，京军受创"
    - id: "ming-ev-jiajing-daliyi"
      name: "嘉靖大礼议"
      yearsLabel: "1520 年代"
      anchorYear: 1524
      description: "世宗追尊生父与文官集团激烈冲突"
  # **V3.1** 中原正统叙事下的多政权/边地提示（写入 Prompt，提醒推演区分视角）
  polity_context: "明朝以朱明皇室为中原主线；同时存在蒙古诸部、卫所与后期满洲势力等并立消长…"
      
  # === 政治架构 ===
  government_structure:
    name: "内阁六部制"
    description: |
      明代废丞相，皇帝直管六部。
      内阁为皇帝秘书机构，票拟奏章。
      司礼监掌批红权，与内阁形成内外对峙。
      
    hierarchy:                       # 权力层级（从上到下）
      - level: 1
        name: "皇帝"
        positions:
          - title: "皇帝"
            count: 1
            power_type: "supreme"
            
      - level: 2
        name: "内廷"
        positions:
          - title: "司礼监掌印太监"
            count: 1
            power_type: "inner_court"
            description: "代皇帝批红，权重极大"
          - title: "司礼监秉笔太监"
            count: 1-4
            power_type: "inner_court"
          - title: "东厂提督太监"
            count: 1
            power_type: "intelligence"
          
      - level: 2
        name: "内阁"
        positions:
          - title: "内阁首辅"
            count: 1
            power_type: "outer_court_head"
            description: "票拟奏章，实际上的行政首脑"
          - title: "内阁次辅"
            count: 1
          - title: "内阁大学士"
            count: 2-5
            
      - level: 3
        name: "六部"
        positions:
          - title: "吏部尚书"
            count: 1
            description: "掌官员任免考核，号称'天官'"
          - title: "户部尚书"
            count: 1
            description: "掌财政税收"
          - title: "礼部尚书"
            count: 1
          - title: "兵部尚书"
            count: 1
          - title: "刑部尚书"
            count: 1
          - title: "工部尚书"
            count: 1
          # 每部下设侍郎(副职)
          - title: "各部侍郎"
            count: 12  # 左右侍郎各一
            
      - level: 3
        name: "都察院"
        positions:
          - title: "左都御史"
            count: 1
            description: "言官之首，风闻奏事"
          - title: "右都御史"
            count: 1
          - title: "各道监察御史"
            count: 13  # 十三道
            
      - level: 3
        name: "军事"
        positions:
          - title: "五军都督府都督"
            count: 5
          - title: "锦衣卫指挥使"
            count: 1
            
      - level: 4
        name: "地方"
        positions:
          - title: "巡抚"
          - title: "布政使"
          - title: "按察使"
          - title: "知府"
          - title: "知县"
            
  # === 制度规矩 ===
  rules_layer:
    institutional:
      - "废丞相后，内阁票拟+司礼监批红为决策流程"
      - "廷议由内阁主持，六部九卿参与"
      - "御史有风闻奏事之权"
      - "皇帝可留中不发"
      - "廷杖制度：皇帝可下令当庭杖责大臣"
      - "经筵制度：翰林院讲官定期给皇帝讲学"
    social_norms:
      - "士大夫以清名为重"
      - "同年、同乡、座师门生为政治纽带"
      - "科举出身决定政治地位"
      - "文官集团整体敌视宦官干政"
    etiquette:
      - "臣下对皇帝自称'臣'，太监自称'奴婢'"
      - "奏事须先称颂再切入正题"
      - "不可直呼大臣姓名，须用官职"
      
  # === 场景类型 ===
  available_scenes:
    - id: "grand_court"
      name: "大朝会（朝参）"
      location: "皇极殿/奉天殿"
      description: "正式朝会，文武百官齐聚，按品级站位"
      typical_attendees: ["皇帝", "内阁", "六部", "都察院", "五军都督府"]
      formality: "highest"
      speaking_rules: "hierarchical"
      
    - id: "cabinet_meeting"
      name: "内阁议事"
      location: "文渊阁"
      description: "内阁大学士议事，讨论票拟意见"
      typical_attendees: ["内阁首辅", "内阁次辅", "大学士"]
      formality: "high"
      speaking_rules: "free"
      
    - id: "jing_yan"
      name: "经筵讲学"
      location: "文华殿"
      description: "翰林讲官给皇帝讲学，臣子借讲学进谏"
      typical_attendees: ["皇帝", "经筵讲官", "侍讲学士", "内阁大学士"]
      formality: "high"
      speaking_rules: "called"
      
    - id: "private_audience"
      name: "召对（单独觐见）"
      location: "乾清宫/养心殿"
      description: "皇帝单独或小范围召见大臣"
      typical_attendees: ["皇帝", "被召见者1-3人", "随侍太监"]
      formality: "medium"
      speaking_rules: "free"
      
    - id: "ministry_hall"
      name: "部堂议事"
      location: "各部衙门大堂"
      description: "某部尚书主持本部事务讨论"
      typical_attendees: ["该部尚书", "左右侍郎", "各司郎中"]
      formality: "medium"
      speaking_rules: "hierarchical"
      
    - id: "censor_meeting"
      name: "都察院合议"
      location: "都察院"
      description: "御史们商议弹劾事宜"
      typical_attendees: ["左都御史", "各道御史"]
      formality: "medium"
      speaking_rules: "free"
      
    - id: "garden_gathering"
      name: "园林/私宅聚会"
      location: "私人园林/官邸"
      description: "非正式场合，大臣私下聚会议事"
      typical_attendees: ["自由组合"]
      formality: "low"
      speaking_rules: "free"
      
    - id: "local_yamen"
      name: "地方衙门"
      location: "知府衙门/知县衙门"
      description: "地方官员处理政务或接待上级"
      typical_attendees: ["知府/知县", "师爷", "属官", "来访者"]
      formality: "medium"
      speaking_rules: "hierarchical"
      
    - id: "military_tent"
      name: "军帐议事"
      location: "中军大帐"
      description: "战时将领议事"
      typical_attendees: ["主将", "副将", "参军", "各营将领"]
      formality: "high_military"
      speaking_rules: "hierarchical"

    - id: "custom"
      name: "自定义场景"
      description: "用户完全自定义的场景"
```

### 2.1.1 V3.1 时间锚点与多政权（设计要点）


| 维度                          | 说明                                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **年号轴 `era_segments`**      | 以「皇帝 + 主年号 + 起讫年」为粒度串联正统王朝；`notes` 可标注该段内的制度转折、易代、边患等。                                                                                                 |
| **关键事件 `highlight_events`** | 选取高辨识度史实节点（如明：靖难、土木堡、大礼议），供用户快速切入「名场面」推演；`periodId` 可存为 `evt:{事件id}`。                                                                                  |
| **互斥选择**                    | 创建向导第 1 步：年号与关键事件 **二选一**（另可选填公元年微调）；切换朝代清空时间选择。                                                                                                       |
| **多政权 `polity_context`**    | 唐（藩镇/吐蕃/武周）、清（关外—入关—晚清条约体系）、十六国南北朝等，在配置包中用文字提示 LLM 与玩家：中枢诏令 ≠ 边地实力派/邻国。                                                                                |
| **API**                     | `GET /api/dynasty/:id/periods` 返回 **年号列表**；`GET /api/dynasty/:id/highlights` 返回 **关键事件列表**；`GET /api/dynasty` 列表项含 `eraSegmentCount`、`highlightCount`。 |


### 2.2 不同朝代的架构差异示例

```yaml
# ─── 秦 ───
dynasty_profile:
  id: "qin"
  name: "秦"
  government_structure:
    name: "三公九卿制"
    hierarchy:
      - level: 1
        name: "皇帝"
        positions: [{ title: "皇帝" }]
      - level: 2
        name: "三公"
        positions:
          - { title: "丞相", description: "总理政务" }
          - { title: "太尉", description: "掌军事" }
          - { title: "御史大夫", description: "掌监察" }
      - level: 3
        name: "九卿"
        positions:
          - { title: "奉常", description: "掌宗庙礼仪" }
          - { title: "郎中令", description: "掌宫廷宿卫" }
          - { title: "卫尉" }
          - { title: "太仆" }
          - { title: "廷尉", description: "掌司法" }
          - { title: "典客" }
          - { title: "宗正" }
          - { title: "治粟内史", description: "掌财政" }
          - { title: "少府" }
  rules_layer:
    institutional:
      - "丞相总理政务，皇帝可独断"
      - "法家治国，以法为教，以吏为师"
      - "书同文，车同轨，统一度量衡"

# ─── 唐 ───
dynasty_profile:
  id: "tang"
  name: "唐"
  government_structure:
    name: "三省六部制"
    hierarchy:
      - level: 1
        name: "皇帝"
      - level: 2
        name: "三省"
        positions:
          - { title: "中书令", description: "中书省长官，掌草拟诏令" }
          - { title: "侍中", description: "门下省长官，掌审核封驳" }
          - { title: "尚书令/左右仆射", description: "尚书省长官，掌执行" }
      - level: 3
        name: "六部"
        positions:
          - { title: "吏部尚书" }
          - { title: "户部尚书" }
          - { title: "礼部尚书" }
          - { title: "兵部尚书" }
          - { title: "刑部尚书" }
          - { title: "工部尚书" }
      - level: 3
        name: "台谏"
        positions:
          - { title: "御史大夫", description: "御史台长官" }
          - { title: "谏议大夫" }

# ─── 宋 ───
dynasty_profile:
  id: "song"
  name: "宋"
  government_structure:
    name: "二府三司制"
    hierarchy:
      - level: 2
        name: "中书门下（政事堂）"
        positions:
          - { title: "同中书门下平章事", description: "宰相" }
          - { title: "参知政事", description: "副宰相" }
      - level: 2
        name: "枢密院"
        positions:
          - { title: "枢密使", description: "掌军政" }
      - level: 3
        name: "三司"
        positions:
          - { title: "三司使", description: "掌财政，号称'计相'" }

# ─── 清 ───
dynasty_profile:
  id: "qing"
  name: "清"
  government_structure:
    name: "内阁+军机处+六部"
    hierarchy:
      - level: 2
        name: "军机处"
        positions:
          - { title: "军机大臣", count: "3-6", description: "实际最高决策" }
          - { title: "军机章京" }
      - level: 2
        name: "内阁"
        positions:
          - { title: "大学士", description: "名义最高，实权已转军机处" }
      - level: 3
        name: "六部"
        description: "满汉双尚书制"
        positions:
          - { title: "各部满尚书", count: 6 }
          - { title: "各部汉尚书", count: 6 }
    special_rules:
      - "满汉复职制：每个重要职位设满、汉各一人"
      - "八旗制度影响军政"
      - "皇帝独揽大权，军机处只是承旨办事"

# ─── 五代十国（实现样本，非全表）───
dynasty_profile:
  id: "wudai-shiguo"
  name: "五代十国"
  polity_context: "中原五代与南方诸国并立，须区分汴洛中枢与某国宫廷视角…"
  government_structure:
    name: "五代中枢（藩镇化禁军）"
    hierarchy:
      - level: 1
        name: "君主"
        positions: [{ title: "皇帝" }]
      - level: 2
        name: "中书门下 / 枢密 / 三司"
        positions:
          - { title: "同平章事" }
          - { title: "枢密使" }
          - { title: "三司使" }
    special_rules:
      - "武人政治与骄兵难制"
      - "各国职名略同而实权各异"
```

### 2.3 AI 自动生成历史人员配置

当用户选择朝代和具体时期后，系统调用LLM自动填充真实历史人物：

```typescript
// 人员配置自动生成流程
interface PersonnelAutoGenerator {

  // 输入：朝代+具体年份+职官架构
  // 输出：每个职位上的真实历史人物
  
  async generatePersonnel(params: {
    dynastyId: string          // "ming"
    subPeriodId: string        // "ming-tianqi"
    year?: number              // 1623（可选，精确到年）
    structure: GovernmentStructure  // 该朝代的职官架构
    selectedScene: SceneType   // 场景类型（决定哪些人出场）
    fidelityMode: FidelityMode // 真实度（严格模式需精确）
    knowledgeSources?: string[] // 可用的史料集（RAG辅助）
  }): Promise<GeneratedPersonnel> {
    
    // 1. 构造Prompt，让LLM根据历史知识填充职位
    // 2. 如果有RAG史料，检索相关人事记录辅助
    // 3. 返回带有详细身份信息的人物列表
  }
}

// 生成结果示例
const generatedPersonnel = {
  era: "明·天启二年（1622）",
  note: "以下人物基于天启二年前后的史实配置",
  
  positions: [
    {
      position: "皇帝",
      character: {
        name: "朱由校",
        identity: {
          title: "天启帝",
          age: 17,
          background: "少年即位，好木工，不耐烦政事",
        },
        behavior: {
          personality: "聪慧但不务正业，对朝政兴趣不高",
          speech_style: { register: "imperial", tone: "随性中带威严" },
        },
        auto_generated: true,  // 标记为自动生成，用户可编辑
      }
    },
    {
      position: "内阁首辅",
      character: {
        name: "叶向高",
        identity: {
          title: "内阁首辅、太子太师",
          background: "万历十一年进士，福清人，东林党元老",
        },
        auto_generated: true,
      }
    },
    {
      position: "司礼监秉笔太监",
      character: {
        name: "魏忠贤",
        identity: {
          title: "司礼监秉笔太监",
          background: "河间肃宁人，万历年间入宫，与客氏勾结",
        },
        auto_generated: true,
      }
    },
    // ... 更多人物
  ]
}

// 关键设计：
// 1. 自动生成的人物标记为 auto_generated: true
// 2. 用户可以逐个编辑、删除或新增人物
// 3. 用户可以选择"只生成核心人物"或"生成完整阵容"
// 4. 严格模式下，LLM需引用史料确认人物在位时间
// 5. 架空模式下，可以跳过历史准确性，快速生成典型人物
```

### 2.4 自动生成的Prompt模板

```
你是一位中国历史专家。请根据以下信息，列出该时期相关职位上的真实历史人物。

朝代：{dynasty}
时期：{sub_period}
具体年份：{year}
职官架构：{government_structure}
场景类型：{scene_type}（决定哪些职位的人需要出场）

{如有RAG史料，附上检索到的人事记录}

请为每个需要出场的职位提供：
1. 姓名
2. 职位全称
3. 简要背景（出身、科举年份、籍贯、派系）
4. 性格特征
5. 与其他在场人物的关系

输出格式：JSON
注意：如果某个职位在该年份的任职者不确定，请标注"存疑"并给出最可能的人选。
```

---

## 三、多元场景系统 (Scene System)

场景不再是简单的一个"朝堂"，而是一套完整的场景类型库。

### 3.1 场景分类框架

```typescript
// 场景按两个维度分类：正式度(formality) × 规模(scale)

interface SceneType {
  id: string
  name: string
  category: SceneCategory
  formality: 'highest' | 'high' | 'medium' | 'low' | 'informal'
  scale: 'grand' | 'medium' | 'small' | 'private'
  location: string
  description: string
  
  // 该场景下的规则
  defaultSpeakingOrder: SpeakingOrder
  seatingArrangement?: string     // 座次/站位描述
  ritualRequirements?: string[]   // 礼仪要求
  
  // 该场景下可出场的角色范围
  attendeeFilter: {
    requiredPositions: string[]   // 必须在场的
    optionalPositions: string[]   // 可能在场的
    excludedPositions: string[]   // 不会在场的
  }
  
  // 场景特有的互动规则
  specialRules?: string[]
}

enum SceneCategory {
  COURT = 'court',              // 朝会类
  COUNCIL = 'council',          // 议事类
  AUDIENCE = 'audience',        // 觐见/召对类
  EDUCATION = 'education',      // 教育/经筵类
  OFFICE = 'office',            // 办公/衙门类
  MILITARY = 'military',        // 军事类
  SOCIAL = 'social',            // 社交/宴饮类
  LOCAL = 'local',              // 地方行政类
  CUSTOM = 'custom',            // 自定义
}
```

### 3.2 通用场景模板（跨朝代共用）

不同朝代共享的通用场景概念，但具体表现因朝代而异：

```yaml
universal_scenes:
  
  # ─── 朝会类 ───
  - id: "grand_court"
    name_template: "{朝代}大朝会"
    category: "court"
    formality: "highest"
    description_template: |
      最高级别的正式朝会，文武百官齐聚。
      {dynasty_specific_details}
    dynasty_variants:
      tang: { location: "含元殿/宣政殿", notes: "百官五品以上参加" }
      song: { location: "大庆殿/紫宸殿", notes: "文东武西站立" }
      ming: { location: "奉天殿/皇极殿", notes: "鸿胪寺引导，按品级站位" }
      qing: { location: "太和殿", notes: "满汉分列，三跪九叩" }

  - id: "routine_court"
    name_template: "{朝代}常朝"
    category: "court"
    formality: "high"
    description_template: |
      日常朝会，处理常规政务。
      {dynasty_specific_details}
    dynasty_variants:
      ming: { location: "皇极门（御门听政）", notes: "每日早朝" }
      qing: { location: "乾清门", notes: "御门听政" }

  # ─── 议事类 ───
  - id: "privy_council"
    name_template: "{朝代}核心议事"
    category: "council"
    formality: "high"
    dynasty_variants:
      tang: { name: "政事堂议事", location: "门下省政事堂" }
      song: { name: "都堂议事", location: "中书门下都堂" }
      ming: { name: "内阁议事", location: "文渊阁" }
      qing: { name: "军机处议事", location: "军机处（隆宗门内）" }
      wudai-shiguo: { name: "枢密军议", location: "汴洛或藩镇" }

  - id: "department_meeting"
    name_template: "部门议事"
    category: "office"
    formality: "medium"
    description: "某个部门内部的工作会议"

  # ─── 教育类 ───
  - id: "royal_lecture"
    name_template: "{朝代}经筵/讲学"
    category: "education"
    formality: "high"
    dynasty_variants:
      song: { name: "经筵", notes: "侍讲、侍读轮讲" }
      ming: { name: "经筵", location: "文华殿", notes: "春秋两季大经筵" }
      qing: { name: "经筵/日讲", location: "文华殿/弘德殿" }

  # ─── 觐见类 ───
  - id: "private_audience"
    name_template: "召对/觐见"
    category: "audience"
    formality: "medium"
    description: "皇帝/最高长官单独或小范围接见"
    
  # ─── 军事类 ───
  - id: "military_council"
    name_template: "军事会议"
    category: "military"
    formality: "high_military"
    dynasty_variants:
      tang: { name: "军帐议事" }
      song: { name: "枢密院议事 / 军帐" }
      ming: { name: "中军大帐 / 兵部议事" }
      
  # ─── 社交类 ───
  - id: "garden_gathering"
    name_template: "园林/私宅聚会"
    category: "social"
    formality: "low"
    description: "官员私下聚会，可密谋、可宴饮、可诗会"

  - id: "banquet"
    name_template: "宴会"
    category: "social"
    formality: "medium"
    dynasty_variants:
      tang: { name: "曲江宴/宫廷赐宴" }
      song: { name: "琼林宴" }
      ming: { name: "恩荣宴" }

  # ─── 地方类 ───
  - id: "local_yamen"
    name_template: "地方衙门"
    category: "local"
    formality: "medium"
    description: "知府/知县衙门处理政务"

  - id: "local_inspection"
    name_template: "巡视/巡按"
    category: "local"
    formality: "high"
    description: "上级官员巡查地方"
```

### 3.3 场景选择流程

```
用户操作流程：

① 选择朝代 → "明"
② 选择时期 → "天启（1621-1627）"
③ 精确到年（可选）→ "天启二年（1622）"
④ 选择场景类型 →
   系统展示该朝代可用的场景列表：
   ┌───────────────────────────────────────┐
   │  🏛️  朝会类                           │
   │  ├── 大朝会（皇极殿）                 │
   │  └── 常朝/御门听政（皇极门）          │
   │                                       │
   │  📋  议事类                           │
   │  ├── 内阁议事（文渊阁）               │
   │  ├── 部堂议事（各部衙门）             │
   │  └── 都察院合议                       │
   │                                       │
   │  📖  教育类                           │
   │  └── 经筵讲学（文华殿）               │
   │                                       │
   │  🚪  觐见类                           │
   │  └── 召对（乾清宫）                   │
   │                                       │
   │  🌿  社交/非正式                      │
   │  ├── 园林聚会                         │
   │  └── 宴会                             │
   │                                       │
   │  ⚔️  军事类                           │
   │  └── 中军大帐                         │
   │                                       │
   │  🏠  地方类                           │
   │  ├── 知府衙门                         │
   │  └── 巡按巡视                         │
   │                                       │
   │  ✏️  自定义场景                        │
   └───────────────────────────────────────┘

⑤ 系统自动生成出场人物 →
   根据"场景类型"过滤哪些职位应该在场
   调用LLM查询该年份的真实任职者
   生成人物列表供用户确认/编辑

⑥ 设置议题和目的
⑦ 选择真实度档位
⑧ 关联史料集
⑨ 开始推演
```

---

## 四、前后端架构分离

### 4.1 架构概览

```
┌─────────────────────────────────────────────────────┐
│                  前端 (Next.js)                       │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │                页面层                          │    │
│  │  首页 | 场景向导 | 推演观察 | 史料管理 | 设置 │    │
│  └──────────────┬───────────────────────────────┘    │
│                 │                                     │
│  ┌──────────────┴───────────────────────────────┐    │
│  │              状态管理 (Zustand)                │    │
│  │  ScenarioStore | SimStore | KnowledgeStore    │    │
│  └──────────────┬───────────────────────────────┘    │
│                 │ HTTP/SSE                            │
└─────────────────┼───────────────────────────────────┘
                  │
                  │  REST API + SSE
                  │
┌─────────────────┼───────────────────────────────────┐
│                 │    后端 (Node.js/Express 或         │
│                 │    Next.js API Routes 独立部署)     │
│  ┌──────────────┴───────────────────────────────┐    │
│  │              API 路由层                        │    │
│  │  /api/dynasty    → 朝代元数据                  │    │
│  │  /api/personnel  → 人员自动生成                │    │
│  │  /api/scenario   → 场景CRUD                    │    │
│  │  /api/character  → 角色CRUD                    │    │
│  │  /api/knowledge  → 史料管理+RAG                │    │
│  │  /api/simulate   → 推演控制+SSE流              │    │
│  │  /api/model      → 模型端点管理                │    │
│  └──────────────┬───────────────────────────────┘    │
│                 │                                     │
│  ┌──────────────┴───────────────────────────────┐    │
│  │              业务逻辑层                        │    │
│  │                                               │    │
│  │  ┌─────────────┐  ┌───────────────────────┐   │    │
│  │  │朝代元数据    │  │ 人员配置生成器         │   │    │
│  │  │管理器        │  │ (LLM + RAG)           │   │    │
│  │  └─────────────┘  └───────────────────────┘   │    │
│  │  ┌─────────────┐  ┌───────────────────────┐   │    │
│  │  │推演引擎      │  │ 史料知识库 (RAG)      │   │    │
│  │  │(核心循环)    │  │ 解析/分割/向量/检索   │   │    │
│  │  └─────────────┘  └───────────────────────┘   │    │
│  │  ┌─────────────┐  ┌───────────────────────┐   │    │
│  │  │上下文管理    │  │ 统一LLM调用层         │   │    │
│  │  │& 压缩器     │  │ (用户自配模型)         │   │    │
│  │  └─────────────┘  └───────────────────────┘   │    │
│  │  ┌─────────────┐  ┌───────────────────────┐   │    │
│  │  │真实度控制器  │  │ 规矩层管理器          │   │    │
│  │  └─────────────┘  └───────────────────────┘   │    │
│  └───────────────────────────────────────────────┘    │
│                 │                                     │
│  ┌──────────────┴───────────────────────────────┐    │
│  │              数据存储层                        │    │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────┐  │    │
│  │  │ SQLite   │  │ 向量存储  │  │ 文件存储   │  │    │
│  │  │ (Prisma) │  │(sqlite-vss│  │(上传的史料)│  │    │
│  │  │          │  │/ChromaDB) │  │            │  │    │
│  │  └──────────┘  └──────────┘  └────────────┘  │    │
│  └───────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### 4.2 后端 API 设计

```typescript
// ─── 朝代元数据 API ───
GET    /api/dynasty                    // 获取所有朝代列表（含 eraSegmentCount、highlightCount）
GET    /api/dynasty/:id                // 获取某朝代完整配置包（含 era_segments、highlight_events、polity_context）
GET    /api/dynasty/:id/periods        // **V3.1** 获取年号轴 era_segments（原「细分时期」）
GET    /api/dynasty/:id/highlights     // **V3.1** 获取关键事件 highlight_events
GET    /api/dynasty/:id/scenes         // 获取某朝代可用的场景类型
GET    /api/dynasty/:id/structure      // 获取某朝代的职官架构

// ─── 人员配置 API ───
POST   /api/personnel/generate         // AI自动生成历史人物
       // body: { dynastyId, periodId, year, sceneId, fidelityMode }
       // response: 生成的人物列表

// ─── 场景 API ───
POST   /api/scenario                   // 创建场景；body 可含 projectId?、knowledgeSourceIds?
GET    /api/scenario                   // 列出所有场景（含 projectId）
GET    /api/scenario/:id               // 获取场景详情
PUT    /api/scenario/:id               // 更新场景（含 projectId）
DELETE /api/scenario/:id               // 删除场景

// ─── 角色 API ───
POST   /api/scenario/:id/character     // 添加角色
PUT    /api/character/:id              // 编辑角色
DELETE /api/character/:id              // 删除角色
POST   /api/character/:id/from-preset  // 从预设创建角色

// ─── 项目与史料分组（V3.2）───
GET    /api/project                    // 列出项目（含场景数、分组数统计）
POST   /api/project                    // body: { name, description? }
PATCH  /api/project/:id
DELETE /api/project/:id                // 场景 projectId 置空（onDelete: SetNull）
GET    /api/knowledge/collection       // ?projectId= 可选；列出知识分组
POST   /api/knowledge/collection       // body: { name, description?, projectId? }
PATCH  /api/knowledge/collection/:id
DELETE /api/knowledge/collection/:id   // 分组内仍有文档则拒绝

// ─── 史料知识库 API（Phase 3 + V3.2）───
POST   /api/knowledge/upload           // multipart：+ collectionId?（归入分组）
POST   /api/knowledge/:id/process      // body: { embeddingEndpointId } 分块 + 调 Embedding 写入向量
GET    /api/knowledge                  // 列表；?processed=1 & ?collectionId= & ?projectId=；含 collection、linkedScenarios
GET    /api/knowledge/:id              // 详情 + 分块预览（content 截断）
PATCH  /api/knowledge/:id              // body: { collectionId } 调整分组
DELETE /api/knowledge/:id              // 级联删除分块
POST   /api/knowledge/search           // body: { query, embeddingEndpointId, topK?, sourceIds? }
       // 余弦相似度检索（SQLite 存 float32 向量；大规模可换 sqlite-vss / 外置向量库）

// ─── 推演 API ───
POST   /api/simulate/start             // 启动推演
POST   /api/simulate/:id/next-round    // 手动触发下一轮
POST   /api/simulate/:id/pause         // 暂停
POST   /api/simulate/:id/resume        // 恢复
GET    /api/simulate/:id/stream        // SSE流（实时推送）
GET    /api/simulate/:id               // 获取推演状态和历史
GET    /api/simulate/:id/export        // **导出推演 JSON**（全量 rounds + speeches）
POST   /api/simulate/:id/chapter-report // **V3.3** 章回体总结 → `Simulation.chapterReport`
// **V3.3 前端路由**：`/create/timeline`（时间轴）、`/scenario/:id/network`（关系示意）

// ─── 模型配置 API ───
POST   /api/model/endpoint             // 添加 LLM 端点
PUT    /api/model/endpoint/:id         // 编辑
DELETE /api/model/endpoint/:id         // 删除
POST   /api/model/endpoint/:id/test    // 测试连接
POST   /api/model/embedding            // 添加 Embedding 端点（OpenAI 兼容 /v1/embeddings）
GET    /api/model/embedding             // 列出
PUT    /api/model/embedding/:id         // 编辑
DELETE /api/model/embedding/:id         // 删除
POST   /api/model/embedding/:id/test    // 测试连接
// **V3.2 UI**：`/settings/models` 单页内标签切换 LLM / Embedding；`/settings/embedding` 重定向至 `?tab=embedding`
```

---

## 五、项目目录结构 (V3 · 前后端分离)

```
courtsim/
├── README.md
├── package.json
│
├── prisma/
│   └── schema.prisma
│
├── src/
│   │
│   ├── ===== 后端 =====
│   │
│   ├── server/
│   │   ├── api/                          # API路由处理
│   │   │   ├── dynasty.ts                # 朝代元数据API
│   │   │   ├── personnel.ts              # 人员自动生成API
│   │   │   ├── scenario.ts               # 场景CRUD
│   │   │   ├── character.ts              # 角色CRUD
│   │   │   ├── knowledge.ts              # 史料管理
│   │   │   ├── simulate.ts               # 推演控制
│   │   │   └── model.ts                  # 模型端点管理
│   │   │
│   │   ├── engine/                       # 推演引擎核心
│   │   │   ├── simulation.ts             # 推演主循环
│   │   │   ├── speaking-order.ts         # 发言权管理
│   │   │   ├── context-manager.ts        # 上下文管理
│   │   │   ├── compressor.ts             # 上下文压缩
│   │   │   ├── relationship.ts           # 关系追踪
│   │   │   ├── fidelity.ts               # 真实度控制器
│   │   │   └── round-summarizer.ts       # 轮次摘要
│   │   │
│   │   ├── dynasty/                      # 朝代元数据系统
│   │   │   ├── registry.ts               # 朝代注册表（加载所有配置）
│   │   │   ├── personnel-generator.ts    # AI人员配置生成器
│   │   │   └── scene-resolver.ts         # 场景类型解析器
│   │   │
│   │   ├── knowledge/                    # 知识库/RAG
│   │   │   ├── parser.ts                 # 文档解析器
│   │   │   ├── chunker.ts                # 文本分割器
│   │   │   ├── embedder.ts               # Embedding调用
│   │   │   ├── vector-store.ts           # 向量存储
│   │   │   └── retriever.ts              # 语义检索
│   │   │
│   │   ├── llm/                          # LLM调用层
│   │   │   ├── unified-client.ts         # 统一调用
│   │   │   ├── adapters/
│   │   │   │   ├── openai-format.ts
│   │   │   │   └── anthropic-format.ts
│   │   │   └── prompt-builder.ts         # Prompt构造器
│   │   │
│   │   └── utils/
│   │       ├── encryption.ts             # API Key加密
│   │       └── token-counter.ts          # Token计数
│   │
│   ├── data/                             # 朝代配置数据
│   │   ├── dynasties/                    # 各朝代配置包
│   │   │   ├── index.ts                  # 朝代总索引
│   │   │   ├── xia-shang-zhou.ts         # 上古三代
│   │   │   ├── qin.ts                    # 秦
│   │   │   ├── han.ts                    # 汉（西汉+东汉）
│   │   │   ├── three-kingdoms.ts         # 三国
│   │   │   ├── jin.ts                    # 晋（西晋+东晋）
│   │   │   ├── southern-northern.ts      # 南北朝
│   │   │   ├── sui.ts                    # 隋
│   │   │   ├── tang.ts                   # 唐
│   │   │   ├── five-dynasties.ts         # 五代十国
│   │   │   ├── song.ts                   # 宋（北宋+南宋）
│   │   │   ├── yuan.ts                   # 元
│   │   │   ├── ming.ts                   # 明
│   │   │   ├── qing.ts                   # 清
│   │   │   └── wudai-shiguo.ts           # 五代十国（样本）
│   │   │
│   │   ├── scenes/                       # 通用场景模板
│   │   │   ├── index.ts
│   │   │   ├── court.ts                  # 朝会类
│   │   │   ├── council.ts                # 议事类
│   │   │   ├── education.ts              # 教育类
│   │   │   ├── audience.ts               # 觐见类
│   │   │   ├── military.ts               # 军事类
│   │   │   ├── social.ts                 # 社交类
│   │   │   └── local.ts                  # 地方类
│   │   │
│   │   └── rules/                        # 规矩预设
│   │       ├── index.ts
│   │       ├── universal-human-nature.ts # 通用人性逻辑
│   │       ├── qin-rules.ts
│   │       ├── han-rules.ts
│   │       ├── tang-rules.ts
│   │       ├── song-rules.ts
│   │       ├── ming-rules.ts
│   │       ├── qing-rules.ts
│   │       └── wudai-shiguo-rules.ts     # 示例命名，可按朝代扩展
│   │
│   ├── ===== 前端 =====
│   │
│   ├── app/                              # Next.js App Router (前端页面)
│   │   ├── page.tsx                      # 首页：场景列表 + 快速开始
│   │   ├── layout.tsx
│   │   │
│   │   ├── create/                       # 场景创建向导（分步）
│   │   │   ├── page.tsx                  # 向导入口
│   │   │   ├── step-dynasty/             # 步骤1：选朝代+时期
│   │   │   ├── step-scene/               # 步骤2：选场景类型
│   │   │   ├── step-personnel/           # 步骤3：人物配置
│   │   │   ├── step-topic/               # 步骤4：议题+目的
│   │   │   ├── step-fidelity/            # 步骤5：真实度+规矩
│   │   │   └── step-knowledge/           # 步骤6：关联史料
│   │   │
│   │   ├── scenario/
│   │   │   └── [id]/
│   │   │       ├── page.tsx              # 场景详情
│   │   │       ├── edit/page.tsx         # 编辑场景
│   │   │       └── simulate/page.tsx     # 推演界面
│   │   │
│   │   ├── knowledge/                    # 史料管理
│   │   │   ├── page.tsx                  # 史料库总览
│   │   │   └── upload/page.tsx           # 上传+处理
│   │   │
│   │   ├── settings/                     # 设置
│   │   │   ├── models/page.tsx           # 模型端点配置
│   │   │   └── embedding/page.tsx        # V3.2：重定向 → models?tab=embedding
│   │   │
│   │   └── api/                          # Next.js API Routes (代理到后端)
│   │       └── [...]/route.ts            # 或直接作为后端
│   │
│   ├── components/
│   │   ├── create-wizard/                # 创建向导组件
│   │   │   ├── DynastySelector.tsx       # 朝代选择器（时间轴/列表）
│   │   │   ├── PeriodPicker.tsx          # 时期精选
│   │   │   ├── SceneSelector.tsx         # 场景类型选择
│   │   │   ├── PersonnelPanel.tsx        # 自动生成人物+编辑
│   │   │   ├── TopicEditor.tsx           # 议题设置
│   │   │   ├── FidelitySelector.tsx      # 真实度三档选择
│   │   │   └── KnowledgeLinker.tsx       # 关联史料
│   │   │
│   │   ├── character/
│   │   │   ├── CharacterCard.tsx
│   │   │   ├── CharacterEditor.tsx
│   │   │   └── RelationshipGraph.tsx     # 关系网络可视化
│   │   │
│   │   ├── knowledge/
│   │   │   ├── UploadPanel.tsx
│   │   │   ├── SourceList.tsx
│   │   │   ├── ChunkPreview.tsx
│   │   │   └── SourceCitation.tsx
│   │   │
│   │   ├── simulation/
│   │   │   ├── SimulationView.tsx        # 推演主界面
│   │   │   ├── SpeechBubble.tsx          # 发言气泡
│   │   │   ├── InnerMonologue.tsx        # 内心独白
│   │   │   ├── RoundSummary.tsx
│   │   │   ├── SourceReferences.tsx      # 史料出处
│   │   │   ├── SceneHeader.tsx           # 场景环境描述
│   │   │   └── SimulationControls.tsx
│   │   │
│   │   ├── settings/
│   │   │   ├── ModelEndpointForm.tsx
│   │   │   └── EmbeddingConfig.tsx
│   │   │
│   │   └── ui/                           # shadcn组件
│   │
│   ├── store/                            # 前端状态
│   │   ├── dynasty-store.ts
│   │   ├── scenario-store.ts
│   │   ├── simulation-store.ts
│   │   ├── knowledge-store.ts
│   │   └── model-store.ts
│   │
│   └── types/                            # 共享类型定义
│       ├── dynasty.ts
│       ├── scene.ts
│       ├── scenario.ts
│       ├── character.ts
│       ├── simulation.ts
│       ├── knowledge.ts
│       ├── fidelity.ts
│       └── llm.ts
│
└── docs/
    ├── architecture.md
    ├── dynasty-config-guide.md           # 如何添加新朝代配置
    ├── prompt-templates.md
    └── knowledge-base-guide.md
```

---

## 六、数据模型 (V3 · 更新)

```prisma
// prisma/schema.prisma

// === 模型配置（用户自管理）===

model ModelEndpoint {
  id              String   @id @default(cuid())
  name            String
  apiBaseUrl      String
  apiKeyEncrypted String
  modelName       String
  apiFormat       String   @default("openai")
  maxContextTokens Int?
  defaultTemperature Float?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model EmbeddingEndpoint {
  id              String   @id @default(cuid())
  name            String
  apiBaseUrl      String
  apiKeyEncrypted String
  modelName       String
  dimensions      Int?
  createdAt       DateTime @default(now())
}

// === 史料知识库 ===

model KnowledgeSource {
  id          String   @id @default(cuid())
  title       String
  author      String?
  type        String                // "正史"|"笔记"|"实录"|"奏疏"|"方志"|"规制"|"其他"
  dynasty     String?
  era         String?
  tags        Json                  // string[]
  fileName    String
  totalChunks Int      @default(0)
  chunks      KnowledgeChunk[]
  scenarios   ScenarioKnowledge[]
  createdAt   DateTime @default(now())
}

model KnowledgeChunk {
  id          String   @id @default(cuid())
  sourceId    String
  source      KnowledgeSource @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  content     String   @db.Text
  chunkIndex  Int
  embedding   Bytes?
  metadata    Json?
  createdAt   DateTime @default(now())
}

model ScenarioKnowledge {
  id          String   @id @default(cuid())
  scenarioId  String
  scenario    Scenario @relation(fields: [scenarioId], references: [id], onDelete: Cascade)
  sourceId    String
  source      KnowledgeSource @relation(fields: [sourceId], references: [id])
}

// === 场景与推演 ===

model Scenario {
  id                String   @id @default(cuid())
  name              String
  
  // 朝代与时期
  dynastyId         String              // "ming"
  periodId          String?             // "ming-tianqi"
  year              Int?                // 1622
  
  // 场景类型
  sceneType         String              // "grand_court" | "cabinet_meeting" | ...
  sceneLocation     String?             // 具体地点（可自定义覆盖）
  sceneDescription  String?  @db.Text   // 场景描述（可自定义覆盖）
  
  // 核心设定
  background        String   @db.Text
  topic             Json                // { title, context, type }
  protagonist       Json                // { name, role, objective, constraints, allies }
  rules             Json                // { speaking_order, max_rounds, ... }
  rulesLayer        Json?               // 规矩层（含朝代预设+用户自定义）
  fidelity          String   @default("moderate")
  
  // 模型分配
  agentModelId      String?
  summarizerModelId String?
  embeddingModelId  String?
  
  // 关联
  characters        Character[]
  simulations       Simulation[]
  knowledgeSources  ScenarioKnowledge[]
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model Character {
  id              String   @id @default(cuid())
  scenarioId      String
  scenario        Scenario @relation(fields: [scenarioId], references: [id], onDelete: Cascade)
  name            String
  identity        Json            // 身份档案
  behavior        Json            // 行为模式
  relationships   Json            // 关系网络
  autoGenerated   Boolean @default(false)  // 是否AI自动生成
  modelOverrideId String?
  speeches        Speech[]
  createdAt       DateTime @default(now())
}

model Simulation {
  id           String   @id @default(cuid())
  scenarioId   String
  scenario     Scenario @relation(fields: [scenarioId], references: [id])
  status       String   @default("pending")
  currentRound Int      @default(0)
  rounds       Round[]
  summary      String?  @db.Text
  totalTokens  Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Round {
  id           String     @id @default(cuid())
  simulationId String
  simulation   Simulation @relation(fields: [simulationId], references: [id], onDelete: Cascade)
  roundNumber  Int
  speeches     Speech[]
  summary      String?    @db.Text
  createdAt    DateTime   @default(now())
}

model Speech {
  id              String    @id @default(cuid())
  roundId         String
  round           Round     @relation(fields: [roundId], references: [id], onDelete: Cascade)
  characterId     String
  character       Character @relation(fields: [characterId], references: [id])
  innerMonologue  String    @db.Text
  publicSpeech    String    @db.Text
  strategyNote    String?   @db.Text
  sourceRefs      Json?             // 引用的史料出处
  tokensUsed      Int?
  createdAt       DateTime  @default(now())
}
```

---

## 七、前端创建向导流程

创建场景的用户体验设计为分步向导（6步）：

```
步骤1 → 步骤2 → 步骤3 → 步骤4 → 步骤5 → 步骤6 → 确认 → 开始推演

┌─ 步骤1：朝代与时间锚点（V3.1）────────────────────────┐
│  ① 选朝代：可用 /create/timeline 横向滑动；年号与大事二选一后方可继续 │
│  [ 多政权提示条：polity_context 只读展示 ]                │
│                                                       │
│  ② 轨道 A — 按皇帝年号（滚动网格，全量或主干年号）         │
│     洪武·太祖 | 建文·惠帝 | 永乐·成祖 | … | 崇祯·思宗    │
│                                                       │
│  ③ 轨道 B — 关键事件 / 名场面（与 A 二选一）              │
│     靖难之役 | 土木堡之变 | 嘉靖大礼议 | …               │
│     （选中后 periodId = 年号id 或 evt:{事件id}）          │
│                                                       │
│  ④ 精确公元年（可选）：[ 1622 ] 用于微调锚点              │
│  [ 清除时间选择 ]  [ 下一步 → ]                         │
└───────────────────────────────────────────────────────┘

┌─ 步骤2：选择场景类型 ─────────────────────────────────┐
│                                                       │
│  当前：明·天启                                         │
│  系统已加载该朝代可用场景：                              │
│                                                       │
│  🏛️ 朝会类                                            │
│  ┌────────────┐  ┌────────────┐                       │
│  │ ● 大朝会    │  │ ○ 常朝     │                       │
│  │   皇极殿    │  │   皇极门   │                       │
│  └────────────┘  └────────────┘                       │
│                                                       │
│  📋 议事类                                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐      │
│  │ ○ 内阁议事 │  │ ○ 部堂议事 │  │ ○ 都察院   │      │
│  └────────────┘  └────────────┘  └────────────┘      │
│                                                       │
│  📖 教育类      🚪 觐见类      🌿 社交               │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐      │
│  │ ○ 经筵     │  │ ○ 召对     │  │ ○ 园林聚会 │      │
│  └────────────┘  └────────────┘  └────────────┘      │
│                                                       │
│  ✏️ 自定义场景                                        │
│  ┌────────────┐                                       │
│  │ ○ 自定义   │                                       │
│  └────────────┘                                       │
│                                                       │
│  [ ← 上一步 ]  [ 下一步 → ]                            │
└───────────────────────────────────────────────────────┘

┌─ 步骤3：人物配置 ─────────────────────────────────────┐
│                                                       │
│  场景：明·天启二年·大朝会·皇极殿                        │
│                                                       │
│  [ 🤖 自动生成人物 ]  ← 点击后AI填充                    │
│                                                       │
│  ⏳ 正在查询天启二年的朝廷人员配置...                    │
│                                                       │
│  生成结果：                                            │
│  ┌──────────────────────────────────────────────┐     │
│  │ ⭐ 主角  朱由校（天启帝）          [编辑][删除]│     │
│  │ 👤 首辅  叶向高                    [编辑][删除]│     │
│  │ 👤 次辅  刘一燝                    [编辑][删除]│     │
│  │ 👤 吏部  张问达                    [编辑][删除]│     │
│  │ 👤 户部  汪应蛟                    [编辑][删除]│     │
│  │ 👤 兵部  王在晋                    [编辑][删除]│     │
│  │ 👤 御史  杨涟                      [编辑][删除]│     │
│  │ 👤 宦官  魏忠贤（司礼监）          [编辑][删除]│     │
│  │                                               │     │
│  │ [ + 添加更多人物 ]                             │     │
│  └──────────────────────────────────────────────┘     │
│                                                       │
│  [ ← 上一步 ]  [ 下一步 → ]                            │
└───────────────────────────────────────────────────────┘

┌─ 步骤4：设置议题与目的 ───────────────────────────────┐
│                                                       │
│  议题标题：                                            │
│  [ 是否恢复矿税以充军饷                          ]     │
│                                                       │
│  议题类型：                                            │
│  ● 历史议题    ○ 变体议题    ○ 现代议题                │
│                                                       │
│  议题背景：                                            │
│  [ 兵部请奏辽东军饷缺口二百万两，户部无银可拨。    ]    │
│  [ 万历年间曾开矿税，民怨沸腾后停止。如今旧事重提。]    │
│                                                       │
│  主角目的：                                            │
│  [ 借矿税议题试探朝臣派系，同时扶持魏忠贤制衡东林  ]    │
│                                                       │
│  主角约束：                                            │
│  [ + 不可直接下旨，须走廷议程序                    ]    │
│  [ + 需维护天子尊严                                ]    │
│                                                       │
│  [ ← 上一步 ]  [ 下一步 → ]                            │
└───────────────────────────────────────────────────────┘

┌─ 步骤5：真实度与规矩 ─────────────────────────────────┐
│                                                       │
│  推演真实度：                                          │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │🔴 严格史实│  │🟡 中等平衡│  │🟢 完全架空│            │
│  │ 依据史料  │  │ 参考史料  │  │ 自由发挥  │            │
│  │ 趋近史实  │  │ 允许推断  │  │ 目的驱动  │            │
│  └──────────┘  └──────────┘  └──────────┘            │
│       ● 选中                                          │
│                                                       │
│  规矩设置（所有档位均生效）：                            │
│  ✅ 使用 明代朝堂 预设规矩（已自动加载）                 │
│  ✅ 廷议须按品级发言                                   │
│  ✅ 御史可风闻奏事                                     │
│  ✅ 士大夫以清名为重                                   │
│  [ + 添加自定义规矩 ]                                  │
│                                                       │
│  [ ← 上一步 ]  [ 下一步 → ]                            │
└───────────────────────────────────────────────────────┘

┌─ 步骤6：关联史料 ─────────────────────────────────────┐
│                                                       │
│  已上传的史料库：                                      │
│  ☑ 明实录·熹宗实录                                    │
│  ☑ 酌中志（刘若愚）                                   │
│  ☑ 明史·食货志                                        │
│  ☐ 明史·杨涟传                                       │
│  ☐ 万历野获编                                         │
│                                                       │
│  [ 上传新史料... ]                                     │
│                                                       │
│  选择推演使用的模型：                                   │
│  角色对话：[ my-claude (Claude Sonnet) ▼ ]             │
│  摘要压缩：[ my-claude (Claude Sonnet) ▼ ]             │
│  Embedding：[ my-openai-embed ▼ ]                     │
│                                                       │
│  推演轮数：[ 10 ]                                      │
│                                                       │
│  [ ← 上一步 ]  [ ✅ 确认并开始推演 ]                    │
└───────────────────────────────────────────────────────┘
```

---

## 八、MVP 开发路线图 (V3 / V3.1 实现状态)

> 以下为 **工程实现进度**（截至 **V3.2** 文档修订），便于与代码仓库对齐；未勾选项仍为规划或仅部分实现。

### Phase 1：基础骨架 + 朝代系统 (第1-2周)

- 项目初始化 (Next.js App Router + TypeScript + Prisma + Tailwind；shadcn 可选未强制)
- 完整数据模型 (Prisma schema + SQLite；**V3.2** 含 `Project`、`KnowledgeCollection`)
- 朝代元数据：明、唐、清（主干年号）+ **秦、西汉、北宋、五代十国样本** + **V3.1 年号轴 / 关键事件 / polity_context**
- 场景类型：通用模板 + `scene-resolver` 与朝代场景合并
- 模型配置页（**同页 LLM + Embedding 标签** + 加密存储）
- 统一 LLM 调用层（OpenAI 兼容 + Anthropic Messages）

### Phase 2：人员生成 + 推演引擎 (第3-4周)

- AI 人员配置生成器 + `resolveTemporalContext` 时间语义
- 推演 Prompt Builder（规矩层 + 真实度 + 人设 + 跨轮摘要占位）
- 推演主循环（逐角色 JSON：独白/公开言/策略）
- 发言权：`hierarchical` / `free`
- **滑动窗口**（`context_window_rounds` / `context_max_chars`）+ **LLM 轮次摘要**（`Round.summary`，`enable_round_summary`）
- 真实度三档注入
- SSE（进程内事件总线；多实例需外置消息层）

### Phase 3：史料知识库 (第5周)

- 文档上传（txt/md）与本地/库内存储
- 文本分割器（段落 + 最大字数）
- Embedding（用户配置端点）+ **向量存 Prisma Bytes（float32）**
- 语义检索（余弦相似度）+ **人员生成 / 推演 Prompt 可选注入**
- 史料元数据 CRUD + 向导第 6 步多选关联 `ScenarioKnowledge`
- **V3.2** 史料 **项目 / 分组（Collection）**、列表筛选、PATCH 调整分组、上传可选 `collectionId`

### Phase 4：前端向导 + 推演界面 (第6-7周)

- 6 步创建向导 + Zustand；**第 1 步已按 V3.1 双轨时间锚点实现**；**第 6 步可选 projectId**
- 全朝代横向时间轴一级页 `/create/timeline`（向导内仍保留列表）
- 场景类型选择器
- 自动生成人物 + 列表删改（细粒度单卡编辑待增强）
- 推演观察页：**三栏布局**（角色 / 对话 / 轮次·SSE·导出）+ 独白折叠
- 推演页 **按发言展示 RAG 块**（`sourceRefs`）+ **论辩元数据**（`dialogueMeta`）
- 推演控制（开始 / 下一轮 / 暂停 / 恢复 + SSE 提示）

### Phase 5：补全朝代 + 打磨 (第8周+)

- 朝代配置：**秦、西汉、北宋、五代十国** 等样本已入库；**北洋样本已移除**（`src/data/dynasties/*.ts`，非全表谱系）
- 更多场景类型与关系网络可视化
- 推演总结报告（自动生成章回体/纪事本末）
- 推演 **JSON 导出** API + 推演页「导出推演 JSON」入口
- **章回体总结** `POST /api/simulate/:id/chapter-report` + UI
- [~] **关系网络可视化**（`/scenario/:id/network` SVG 示意；交互与自动抽边仍可增强）
- **主视角** `protagonistCharacterId` + 玩家指令 `playableDirectives`

---

---

## 九、给 Cursor Composer 的开发指引

### 第一步：项目初始化 + 数据模型

> "初始化 Next.js 14 项目（App Router + TypeScript + Tailwind + shadcn/ui）。
> 安装 Prisma (SQLite) + Zustand。
> 创建 prisma/schema.prisma，包含以下模型：
> ModelEndpoint, EmbeddingEndpoint, **Project**, **KnowledgeCollection**, KnowledgeSource（含 collectionId）, KnowledgeChunk, ScenarioKnowledge, Scenario（含 **projectId**）, Character, Simulation, Round, Speech。
> Scenario 需包含 dynastyId, periodId, year, sceneType, fidelity 字段。
> Character 需包含 autoGenerated 布尔字段。
> 运行 prisma migrate。"

### 第二步：朝代元数据 + 场景系统

> "在 src/data/dynasties/ 下创建朝代配置文件。
> 每个文件导出一个 DynastyProfile 对象，包含：基本信息、**era_segments、highlight_events、polity_context**、政治架构(hierarchy)、制度规矩(rules_layer)、可用场景(available_scenes)；`sub_periods` 仅兼容旧数据。
> 已实现：明、唐、清 + 样本秦(qin.ts)、西汉(han-west.ts)、北宋(song-north.ts)、**五代十国(wudai-shiguo.ts)**；**北洋已移除**；注册见 `dynasties/index.ts`。
> 在 src/data/scenes/ 下创建通用场景模板，包含朝代变体。
> 创建 src/server/dynasty/registry.ts 作为朝代注册表，加载所有配置。
> 创建 API: GET /api/dynasty, GET /api/dynasty/:id, GET /api/dynasty/:id/scenes, **GET .../periods（年号）, GET .../highlights（大事）**。"

### 第三步：模型配置 + LLM调用层

> "实现模型配置页面（settings/models）：**同一页内标签切换** LLM 端点与 Embedding 端点；`/settings/embedding` 可重定向到 `?tab=embedding`。
> 实现 UnifiedLLMClient（openai + anthropic）；**Embedding 调用 OpenAI 兼容 /v1/embeddings**。
> 连接测试功能；API Key 使用 crypto 加密存储。"

### 第四步：人员自动生成

> "实现 PersonnelAutoGenerator：
> 输入朝代+时期+年份+场景类型，调用LLM生成该时期的真实历史人物列表。
> Prompt要求LLM为每个职位返回：姓名、职位、背景、性格、关系。
> 返回结果标记 autoGenerated: true，用户可在前端编辑。
> API: POST /api/personnel/generate。"

### 第五步：推演引擎

> "实现 SimulationEngine 核心循环。
> 实现 PromptBuilder：组装 规矩层(最高优先级) + 真实度指令 + 人设 + 史料 + 上下文 + 任务。
> 实现发言权管理（hierarchical + free 两种模式）。
> 实现上下文滑动窗口 + LLM摘要压缩。
> 实现真实度控制器（三档参数注入）。
> 用 SSE 实时推送。"

### 第六步：前端创建向导

> "实现6步创建向导：
> 步骤1：**年号轴与关键事件二选一** + `polity_context` 提示 + 可选年份；`periodId` 可为 `evt:{id}`。
> 步骤2：场景类型选择器（根据已选朝代显示可用场景，带图标和描述）。
> 步骤3：人物配置面板（'自动生成'按钮 + 人物卡片列表 + 编辑/删除/新增）。
> 步骤4：议题设置（标题/类型/背景/主角目的/约束）。
> 步骤5：真实度三档选择 + 规矩预览与自定义。
> 步骤6：**可选所属项目（projectId）** + **多选已处理史料（ScenarioKnowledge）** + Embedding 端点用于检索 + 选择模型 + 推演参数。
> 使用 Zustand 在步骤间共享状态。"

### 第七步：推演观察界面

> "实现推演页面：
> 顶部：场景环境描述（朝代、地点、时间、在场人物）。
> 左侧：角色列表（头像/名字/职位/立场标签，当前发言者高亮）。
> 中央：对话流（公开发言用气泡，内心独白折叠显示，每条发言下标注引用的史料出处）。
> 右侧：轮次信息 + 关系变化提示。
> 底部：控制面板（开始/暂停/下一轮/结束/导出）。
> 使用 SSE 接收实时数据流。"

