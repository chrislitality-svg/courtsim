<p align="center"><img src="docs/banner.svg" alt="courtsim banner" width="100%"></p>

# CourtSim · 明朝朝堂政治推演

> **站在明代大臣的位置上，处理一桩桩真实的朝堂难题。**
> An AI-driven simulation of Ming-dynasty court politics — take a stance on real historical dilemmas and watch the consequences play out.

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

CourtSim 把一个个明代朝堂议题（如**辽饷加派与太仓存银**、**封疆案与追赃名单**、**国本与册立时日**、**批红越权与部院体面**…）摆到你面前：你以朝臣身份表态、权衡，系统结合**史料知识库**用 LLM 做**推演**，给出各方反应、局势走向与场外批注，最后把议题**收束**成结果。

> ⚠️ **免责声明**：本项目为历史题材的思辨/推演工具，议题与推演内容基于公开史料与模型生成，仅供学习与娱乐，不代表严肃史学结论。

## ✨ 特性

- 🏛️ **真实议题库** — 以明代政治、财政、礼制等真实事件为蓝本的可推演议题
- 🧠 **AI 推演** — LLM 驱动的多方反应模拟 + 场外批注 + 议题收束
- 📚 **史料知识库** — 上传史料原文，向量化后为推演提供依据（RAG）
- 🔐 **自带 Key（BYO-LLM）** — API Key 由你自己填入，经 `ENCRYPTION_KEY` **加密后存本地**，不出机器
- 💾 **纯本地** — 数据存本地 SQLite（Prisma），单机即可跑

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
#   编辑 .env：
#   DATABASE_URL="file:./dev.db"
#   ENCRYPTION_KEY="<32+ 字符随机串，用于加密存储你的 LLM Key>"

# 3. 初始化数据库
npx prisma migrate dev

# 4. 启动
npm run dev
```

打开 http://localhost:3000，在设置里填入你的 LLM API Key（会加密存储），即可创建议题、导入史料、开始推演。

## 🧱 技术栈

Next.js 16 (App Router) · React 19 · Prisma + SQLite · 向量检索（史料嵌入）· BYO-LLM

## 📁 目录

- `src/app/` — 页面（`create` 议题创建 / `knowledge` 史料知识库 / 推演页 / 设置）
- `prisma/` — 数据模型与迁移
- `docs/product/` — 产品规划、需求、美术风格与排障手记

## 许可

[MIT](LICENSE)

<sub>💡 想给它配张封面/截图？把图片放进 `docs/` 再在标题下插 `![screenshot](docs/xxx.png)`。</sub>