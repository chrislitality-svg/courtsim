import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { chatCompletions } from "@/server/llm/unified-client";

export const maxDuration = 120;

/**
 * 主视角（穿越者）幕僚：局势建议 / 代拟公开发言草稿（不写入数据库，由用户自行采用或改写）
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { mode?: string };
  const mode = body.mode === "draft_line" ? "draft_line" : "situation";

  const sim = await prisma.simulation.findUnique({
    where: { id },
    include: {
      scenario: {
        include: { characters: true },
      },
      rounds: {
        orderBy: { roundNumber: "desc" },
        take: 1,
        include: {
          speeches: {
            orderBy: { createdAt: "asc" },
            include: { character: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!sim) return NextResponse.json({ error: "未找到推演" }, { status: 404 });

  const pid = sim.scenario.protagonistCharacterId;
  if (!pid) {
    return NextResponse.json(
      { error: "场景未设置主视角（穿越附体）人物" },
      { status: 400 },
    );
  }
  const playChar = sim.scenario.characters.find((c) => c.id === pid);
  if (!playChar) {
    return NextResponse.json({ error: "主视角人物不存在" }, { status: 400 });
  }

  if (!sim.scenario.agentModelId) {
    return NextResponse.json({ error: "场景未配置模型端点" }, { status: 400 });
  }
  const endpoint = await prisma.modelEndpoint.findUnique({
    where: { id: sim.scenario.agentModelId },
  });
  if (!endpoint) {
    return NextResponse.json({ error: "模型端点不存在" }, { status: 400 });
  }

  const lastRound = sim.rounds[0];
  const lines =
    lastRound?.speeches.map(
      (s) => `【${s.character.name}】${s.publicSpeech}`,
    ) ?? [];
  const transcript =
    lines.length > 0
      ? lines.join("\n")
      : "（尚无已完成轮次，可据场景背景给一般性提醒）";

  let identity: Record<string, unknown> = {};
  try {
    identity = JSON.parse(playChar.identity) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  const pos = String(identity.position ?? identity.title ?? "");

  const userContent =
    mode === "situation"
      ? [
          `玩家穿越附身在 **${playChar.name}**（${pos || "身份见档案"}）身上。`,
          "下列为最近一轮朝堂公开发言摘录。请用**简体中文**写幕僚式建议（不要 JSON）：",
          "1）当前争点与气氛；2）谁在拉拢或施压主角；3）主角若开口可采取的 2～3 种策略方向；4）须规避的话术风险。",
          "总字数 350 字以内。勿评判人物忠奸，从利益与局势出发。",
          "",
          "【发言摘录】",
          transcript,
        ].join("\n")
      : [
          `玩家穿越附身在 **${playChar.name}**（${pos || "身份见档案"}）身上，即将当众发言。`,
          "下列为最近一轮他人公开发言。请**代拟一段**主角可当朝说出的话（2～5 句），简体中文、可略带文言；",
          "须承接上文争点，体现其身份与私利立场，不要道德说教。只输出台词正文，不要说明。",
          "",
          "【他人发言摘录】",
          transcript,
        ].join("\n");

  try {
    const apiKey = decryptSecret(endpoint.apiKeyEncrypted);
    const text = await chatCompletions(
      {
        apiBaseUrl: endpoint.apiBaseUrl,
        apiKey,
        modelName: endpoint.modelName,
        apiFormat: endpoint.apiFormat as "openai" | "anthropic",
        temperature: mode === "draft_line" ? 0.75 : 0.45,
        maxTokens: mode === "draft_line" ? 600 : 900,
      },
      [{ role: "user", content: userContent }],
    );
    const trimmed = text.trim();
    if (!trimmed) {
      return NextResponse.json(
        {
          error:
            "模型返回了空正文（未产生可用话术）。请检查端点是否兼容、或提高 maxTokens 后重试。",
        },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      mode,
      text: trimmed,
      trace: {
        modeLabel: mode === "draft_line" ? "代拟公开发言" : "局势幕僚建议",
        protagonist: playChar.name,
        lastRoundSpeeches: lastRound?.speeches.length ?? 0,
        transcriptPreview: transcript.slice(0, 280),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
