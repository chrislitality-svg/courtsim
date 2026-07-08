import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { chatCompletions } from "@/server/llm/unified-client";

export const maxDuration = 300;

function buildTranscript(sim: {
  scenario: { name: string; dynastyId: string; background: string };
  rounds: {
    roundNumber: number;
    speeches: { character: { name: string }; publicSpeech: string }[];
  }[];
}): string {
  const head = `场景：${sim.scenario.name}（${sim.scenario.dynastyId}）\n背景：${sim.scenario.background}\n\n`;
  const body = sim.rounds
    .map((r) => {
      const lines = r.speeches
        .map((s) => `【${s.character.name}】${s.publicSpeech}`)
        .join("\n");
      return `第 ${r.roundNumber} 轮\n${lines}`;
    })
    .join("\n\n");
  return head + body;
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const sim = await prisma.simulation.findUnique({
    where: { id },
    include: {
      scenario: {
        select: {
          name: true,
          dynastyId: true,
          background: true,
          agentModelId: true,
          summarizerModelId: true,
        },
      },
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: {
          speeches: {
            orderBy: { createdAt: "asc" },
            include: { character: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!sim) return NextResponse.json({ error: "未找到" }, { status: 404 });
  if (!sim.rounds.length) {
    return NextResponse.json({ error: "尚无轮次" }, { status: 400 });
  }

  const modelId =
    sim.scenario.summarizerModelId ?? sim.scenario.agentModelId;
  if (!modelId) {
    return NextResponse.json({ error: "场景未配置模型端点" }, { status: 400 });
  }

  const endpoint = await prisma.modelEndpoint.findUnique({
    where: { id: modelId },
  });
  if (!endpoint) {
    return NextResponse.json({ error: "模型端点不存在" }, { status: 400 });
  }

  const apiKey = decryptSecret(endpoint.apiKeyEncrypted);
  const transcript = buildTranscript(sim);
  const prompt = `你是一位说书人。请根据下列朝堂推演记录，写一则**章回体**收束（一回书）。

【风格宪章】
- 手法：白描、场景切换、对话引述为主；避免大段内心独白与心理分析。
- 禁用：现代网文腔（如「眼神凌厉」「心中冷哼」「破防」「内耗」「崩溃」等现代表情与网络词）、生硬堆砌生僻文言。
- 套语：开篇可用「话说……」「却说……」等，结尾可用「正是：……」「且听下回分解」等，不必每句套用。
- 长度：400–900 字；文言色彩可浓但须当代读者可读。
- 史实：勿与下列记录明显矛盾；勿凭空捏造重大事件。

【叙事要求】
1. 开篇点题；2. 中间按阵营/冲突转折；3. 结尾留余波或扣子。

【记录】
${transcript.slice(0, 28000)}`;

  try {
    const text = await chatCompletions(
      {
        apiBaseUrl: endpoint.apiBaseUrl,
        apiKey,
        modelName: endpoint.modelName,
        apiFormat: endpoint.apiFormat as "openai" | "anthropic",
        temperature: 0.65,
        maxTokens: 2500,
      },
      [{ role: "user", content: prompt }],
    );

    const chapterReport = text.trim();
    await prisma.simulation.update({
      where: { id },
      data: { chapterReport },
    });

    return NextResponse.json({ chapterReport });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
