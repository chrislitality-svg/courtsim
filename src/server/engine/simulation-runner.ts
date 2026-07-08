import type { Character } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { simulationBusPublish } from "@/lib/simulation-bus";
import { decryptSecret } from "@/lib/crypto";
import { getDynastyById } from "@/server/dynasty/registry";
import { chatCompletions } from "@/server/llm/unified-client";
import { buildSimulationSystemPrompt } from "./prompt-builder";
import { buildPriorContextForSimulation } from "./simulation-context";
import type { SpeakingOrderMode } from "./speaking-order";
import {
  orderCharactersByFormation,
  parseCourtFormation,
  reconcileFormation,
} from "@/lib/court-formation";
import { getScenarioCourtFormationJson } from "@/lib/scenario-court-formation-sql";
import {
  clearSpeechUserDirectiveSql,
  findLatestSpeechWithUserDirective,
} from "@/lib/speech-user-directive-sql";
import {
  getCloseTopicNextRoundSql,
  setCloseTopicNextRoundSql,
} from "@/lib/simulation-close-topic-sql";
import {
  formatRagBlock,
  searchKnowledgeChunks,
} from "@/server/knowledge/retriever";
import { parseRoundSummarizerOutput } from "./political-state";

function safeParseRules(s: string): {
  speaking_order: SpeakingOrderMode;
  max_rounds: number;
  context_window_rounds: number;
  context_max_chars: number;
  enable_round_summary: boolean;
} {
  try {
    const o = JSON.parse(s) as Record<string, unknown>;
    const so = o.speaking_order === "free" ? "free" : "hierarchical";
    const mr =
      typeof o.max_rounds === "number" && o.max_rounds > 0
        ? Math.min(50, o.max_rounds)
        : 10;
    const cwr =
      typeof o.context_window_rounds === "number" && o.context_window_rounds > 0
        ? Math.min(20, o.context_window_rounds)
        : 2;
    const cmc =
      typeof o.context_max_chars === "number" && o.context_max_chars > 0
        ? Math.min(80000, o.context_max_chars)
        : 14000;
    const ers = o.enable_round_summary !== false;
    return {
      speaking_order: so,
      max_rounds: mr,
      context_window_rounds: cwr,
      context_max_chars: cmc,
      enable_round_summary: ers,
    };
  } catch {
    return {
      speaking_order: "hierarchical",
      max_rounds: 10,
      context_window_rounds: 2,
      context_max_chars: 14000,
      enable_round_summary: true,
    };
  }
}

function parseSpeechJson(raw: string): {
  innerMonologue: string;
  publicSpeech: string;
  strategyNote: string | null;
  dialogueMeta: string | null;
} {
  const m = raw.match(/\{[\s\S]*\}/);
  try {
    const j = JSON.parse(m ? m[0] : raw) as Record<string, unknown>;
    let dialogueMeta: string | null = null;
    if (j.dialogueMeta != null && typeof j.dialogueMeta === "object") {
      dialogueMeta = JSON.stringify(j.dialogueMeta);
    } else if (typeof j.dialogueMeta === "string" && j.dialogueMeta.trim()) {
      dialogueMeta = j.dialogueMeta;
    }
    return {
      innerMonologue: String(j.innerMonologue ?? ""),
      publicSpeech: String(
        j.publicSpeech ?? j.speech ?? j.utterance ?? "",
      ),
      strategyNote:
        j.strategyNote != null && j.strategyNote !== ""
          ? String(j.strategyNote)
          : null,
      dialogueMeta,
    };
  } catch {
    return {
      innerMonologue: "（解析失败）",
      publicSpeech: raw.slice(0, 4000),
      strategyNote: null,
      dialogueMeta: null,
    };
  }
}

function safeIdentity(c: Character): Record<string, unknown> {
  try {
    return JSON.parse(c.identity) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function safeBehavior(c: Character): Record<string, unknown> {
  try {
    return JSON.parse(c.behavior) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const inflight = new Map<string, Promise<void>>();

export function runNextRoundLocked(simulationId: string): Promise<void> {
  const existing = inflight.get(simulationId);
  if (existing) return existing;
  const p = runSimulationRound(simulationId)
    .catch(async (e) => {
      const msg = e instanceof Error ? e.message : String(e);
      simulationBusPublish(simulationId, { type: "error", message: msg });
      await prisma.simulation.updateMany({
        where: { id: simulationId, status: "running" },
        data: { status: "idle" },
      });
    })
    .finally(() => {
      inflight.delete(simulationId);
    });
  inflight.set(simulationId, p);
  return p;
}

export async function runSimulationRound(simulationId: string): Promise<void> {
  const sim = await prisma.simulation.findUnique({
    where: { id: simulationId },
    include: {
      scenario: { include: { characters: true } },
    },
  });
  if (!sim) throw new Error("推演不存在");
  if (sim.status === "paused") throw new Error("已暂停，请先恢复");
  if (sim.status === "completed") throw new Error("推演已结束");
  if (sim.status === "running") throw new Error("上一轮仍在执行");

  const scenario = sim.scenario;
  const {
    speaking_order,
    max_rounds,
    context_window_rounds,
    context_max_chars,
    enable_round_summary,
  } = safeParseRules(scenario.rules);

  if (sim.currentRound >= max_rounds) {
    await prisma.simulation.update({
      where: { id: simulationId },
      data: { status: "completed" },
    });
    simulationBusPublish(simulationId, {
      type: "completed",
      currentRound: sim.currentRound,
    });
    return;
  }

  if (!scenario.characters.length) {
    throw new Error("场景中没有任何角色，无法推演");
  }

  if (!scenario.agentModelId) {
    throw new Error("请先在场景上配置 agentModelId（模型端点）");
  }

  const endpoint = await prisma.modelEndpoint.findUnique({
    where: { id: scenario.agentModelId },
  });
  if (!endpoint) throw new Error("模型端点不存在");

  const apiKey = decryptSecret(endpoint.apiKeyEncrypted);
  const llmOpts = {
    apiBaseUrl: endpoint.apiBaseUrl,
    apiKey,
    modelName: endpoint.modelName,
    apiFormat: endpoint.apiFormat as "openai" | "anthropic",
    temperature: endpoint.defaultTemperature ?? 0.75,
    maxTokens: 2048,
  };

  const dynasty = getDynastyById(scenario.dynastyId) ?? null;
  const systemBase = buildSimulationSystemPrompt(
    scenario,
    scenario.characters,
    dynasty,
    { protagonistCharacterId: scenario.protagonistCharacterId },
  );

  const nextRoundNum = sim.currentRound + 1;
  const maxContextChars = Math.min(
    context_max_chars,
    Math.min(24000, (endpoint.maxContextTokens ?? 8000) * 3),
  );

  const closeTopicThisRound = await getCloseTopicNextRoundSql(simulationId);
  if (closeTopicThisRound) {
    await setCloseTopicNextRoundSql(simulationId, false);
  }

  const formationStored = await getScenarioCourtFormationJson(scenario.id);
  const formationRaw = parseCourtFormation(formationStored);
  const formation = reconcileFormation(
    scenario.characters,
    formationRaw,
    speaking_order,
  );
  const ordered = orderCharactersByFormation(
    scenario.characters,
    formation,
    speaking_order,
    nextRoundNum,
  );

  if (ordered.length === 0) {
    simulationBusPublish(simulationId, {
      type: "error",
      message: "没有在场角色可发言：请在「朝堂编组」中至少安排一人入场。",
    });
    throw new Error("没有在场角色可发言");
  }

  await prisma.simulation.update({
    where: { id: simulationId },
    data: { status: "running" },
  });
  simulationBusPublish(simulationId, { type: "status", status: "running" });

  const round = await prisma.round.create({
    data: {
      simulationId,
      roundNumber: nextRoundNum,
    },
  });

  simulationBusPublish(simulationId, {
    type: "round_start",
    roundNumber: nextRoundNum,
    roundId: round.id,
  });

  simulationBusPublish(simulationId, {
    type: "round_roster",
    roundNumber: nextRoundNum,
    characterIds: ordered.map((c) => c.id),
    characterNames: ordered.map((c) => c.name),
  });

  let transcriptThisRound = "";
  let tokenEst = 0;
  const prior = await buildPriorContextForSimulation(
    simulationId,
    nextRoundNum,
    maxContextChars,
    context_window_rounds,
  );

  const knLinks = await prisma.scenarioKnowledge.findMany({
    where: { scenarioId: scenario.id },
    select: { sourceId: true },
  });
  const knowledgeSourceIds = knLinks.map((k) => k.sourceId);

  for (let i = 0; i < ordered.length; i++) {
    const char = ordered[i]!;
    const identity = safeIdentity(char);
    const behavior = safeBehavior(char);

    simulationBusPublish(simulationId, {
      type: "speech_progress",
      phase: "generating",
      roundNumber: nextRoundNum,
      characterId: char.id,
      characterName: char.name,
      index: i + 1,
      total: ordered.length,
    });

    const directiveRow = await findLatestSpeechWithUserDirective(
      char.id,
      simulationId,
    );
    const userDir = directiveRow?.userDirective?.trim();

    let retrievalBlock = "";
    let sourceRefsJson: string | null = null;
    if (scenario.embeddingModelId && knowledgeSourceIds.length > 0) {
      try {
        let topicTitle = "";
        let topicContext = "";
        try {
          const t = JSON.parse(scenario.topic) as Record<string, unknown>;
          topicTitle = String(t.title ?? "");
          topicContext = String(t.context ?? "");
        } catch {
          /* ignore */
        }
        const q = [
          char.name,
          String(identity.position ?? ""),
          topicTitle,
          topicContext,
          transcriptThisRound.slice(-1400),
          prior.slice(-1000),
          scenario.background.slice(0, 500),
        ]
          .join("\n")
          .slice(0, 2800);
        const hits = await searchKnowledgeChunks({
          query: q,
          embeddingEndpointId: scenario.embeddingModelId,
          sourceIds: knowledgeSourceIds,
          topK: 4,
        });
        retrievalBlock = formatRagBlock(hits);
        if (hits.length) {
          sourceRefsJson = JSON.stringify({
            chunks: hits.map((h) => ({
              sourceId: h.sourceId,
              sourceTitle: h.sourceTitle,
              chunkIndex: h.chunkIndex,
              score: h.score,
              excerpt: h.content.slice(0, 500),
            })),
          });
        }
      } catch {
        retrievalBlock = "";
      }
    }

    const userPrompt = [
      `【本轮发言轮次】现在请你只扮演：${char.name}。`,
      `身份档案（JSON）：${JSON.stringify(identity)}`,
      Object.keys(behavior).length
        ? `言行与性格（JSON）：${JSON.stringify(behavior)}`
        : "",
      "",
      ...(closeTopicThisRound
        ? [
            "【监国/圣意】本轮为**议题收束轮**：须收口当前争点，各自给出明确态度、条件或拟议结果；勿再横生新枝节。",
            "",
          ]
        : []),
      ...(userDir
        ? [
            "## 天语/场外批注（你必须服从其意图组织公开发言）",
            userDir,
            "",
          ]
        : []),
      "## 本场景前文（跨轮，含摘要与近轮全文）",
      prior,
      "",
      "## 本轮已发言（按时间顺序，你必须与之钩连）",
      transcriptThisRound || "（你是本轮首位发言者，可开议立论）",
      "",
      ...(retrievalBlock
        ? [
            "## 角色内在知识储备（史料摘录）",
            "以下为该人物在史料或档案中的立场与事实锚点，用于约束你的发言方向；**公开场合台词**须符合当场戏剧情境，有对白张力，避免照搬奏疏、公文或史评体。",
            retrievalBlock,
            "",
          ]
        : []),
      "请严格只输出 JSON 对象（innerMonologue, publicSpeech, strategyNote, dialogueMeta）。",
    ]
      .filter(Boolean)
      .join("\n");

    const raw = await chatCompletions(llmOpts, [
      { role: "system", content: systemBase },
      { role: "user", content: userPrompt },
    ]);
    tokenEst += Math.ceil(raw.length / 4);

    const parsed = parseSpeechJson(raw);
    transcriptThisRound += `\n【${char.name}】${parsed.publicSpeech}\n`;

    const speech = await prisma.speech.create({
      data: {
        roundId: round.id,
        characterId: char.id,
        innerMonologue: parsed.innerMonologue || "（无）",
        publicSpeech: parsed.publicSpeech || "（无言）",
        strategyNote: parsed.strategyNote,
        sourceRefs: sourceRefsJson,
        dialogueMeta: parsed.dialogueMeta,
      },
    });

    if (directiveRow?.id) {
      await clearSpeechUserDirectiveSql(directiveRow.id);
    }

    simulationBusPublish(simulationId, {
      type: "speech",
      roundNumber: nextRoundNum,
      speech: {
        id: speech.id,
        characterId: char.id,
        characterName: char.name,
        innerMonologue: speech.innerMonologue,
        publicSpeech: speech.publicSpeech,
        strategyNote: speech.strategyNote,
        dialogueMeta: speech.dialogueMeta,
      },
    });
  }

  if (enable_round_summary && transcriptThisRound.trim()) {
    const summarizerId =
      scenario.summarizerModelId ?? scenario.agentModelId ?? null;
    if (summarizerId) {
      try {
        const sumEp = await prisma.modelEndpoint.findUnique({
          where: { id: summarizerId },
        });
        if (sumEp) {
          const sk = decryptSecret(sumEp.apiKeyEncrypted);
          const sumRaw = await chatCompletions(
            {
              apiBaseUrl: sumEp.apiBaseUrl,
              apiKey: sk,
              modelName: sumEp.modelName,
              apiFormat: sumEp.apiFormat as "openai" | "anthropic",
              temperature: 0.35,
              maxTokens: 900,
            },
            [
              {
                role: "user",
                content: [
                  `你是朝堂机要秘书。根据下列「第 ${nextRoundNum} 轮」对话记录，严格按两段输出（不要其它说明）：`,
                  "",
                  "【摘要】",
                  "中文 180 字以内：主要争点、各方公开立场、君主是否表态、未决悬念。",
                  "",
                  "【政治状态JSON】",
                  "紧接下一行起，仅输出一个合法 JSON 对象（不要 Markdown 代码围栏），结构为：",
                  '{"factionStances":{"派系或阵营名":"支持|反对|观望|未知或简述"},"emperorSignals":["…"],"keyEvents":["…"],"openQuestions":["…"]}',
                  "无信息时 factionStances 用 {}，数组用 []。",
                  "",
                  "【对话记录】",
                  transcriptThisRound,
                ].join("\n"),
              },
            ],
          );
          const { summary, politicalStateJson } =
            parseRoundSummarizerOutput(sumRaw);
          await prisma.round.update({
            where: { id: round.id },
            data: {
              summary: summary.slice(0, 2500),
              politicalState: politicalStateJson,
            },
          });
        }
      } catch {
        /* 摘要失败不阻断 */
      }
    }
  }

  const done = nextRoundNum >= max_rounds;
  await prisma.simulation.update({
    where: { id: simulationId },
    data: {
      currentRound: nextRoundNum,
      status: done ? "completed" : "idle",
      totalTokens: { increment: tokenEst },
    },
  });

  simulationBusPublish(simulationId, {
    type: "round_done",
    roundNumber: nextRoundNum,
    status: done ? "completed" : "idle",
  });
}
