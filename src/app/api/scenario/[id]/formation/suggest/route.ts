import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setScenarioCourtFormationJson } from "@/lib/scenario-court-formation-sql";
import { decryptSecret } from "@/lib/crypto";
import { humanSceneLabel } from "@/lib/scene-display";
import {
  defaultCourtFormation,
  reconcileFormation,
  type CourtFormation,
} from "@/lib/court-formation";
import { chatCompletions } from "@/server/llm/unified-client";

function parseSpeakingMode(rules: string): "hierarchical" | "free" {
  try {
    const o = JSON.parse(rules) as Record<string, unknown>;
    return o.speaking_order === "free" ? "free" : "hierarchical";
  } catch {
    return "hierarchical";
  }
}

type SuggestJson = {
  groups: { name: string; members: string[] }[];
  absent?: string[];
};

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  try {
    const scenario = await prisma.scenario.findUnique({
      where: { id },
      include: { characters: true },
    });
    if (!scenario) {
      return NextResponse.json({ error: "未找到" }, { status: 404 });
    }
    if (!scenario.agentModelId) {
      return NextResponse.json({ error: "场景未配置模型端点" }, { status: 400 });
    }
    if (scenario.characters.length === 0) {
      return NextResponse.json({ error: "无角色" }, { status: 400 });
    }

    const endpoint = await prisma.modelEndpoint.findUnique({
      where: { id: scenario.agentModelId },
    });
    if (!endpoint) {
      return NextResponse.json({ error: "模型端点不存在" }, { status: 400 });
    }

    const mode = parseSpeakingMode(scenario.rules);
    const names = scenario.characters.map((c) => {
      try {
        const idj = JSON.parse(c.identity) as Record<string, unknown>;
        const pos = idj.position != null ? String(idj.position) : "";
        return pos ? `${c.name}（${pos}）` : c.name;
      } catch {
        return c.name;
      }
    });

    const apiKey = decryptSecret(endpoint.apiKeyEncrypted);
    let raw: string;
    try {
      raw = await chatCompletions(
        {
          apiBaseUrl: endpoint.apiBaseUrl,
          apiKey,
          modelName: endpoint.modelName,
          apiFormat: endpoint.apiFormat as "openai" | "anthropic",
          temperature: 0.3,
          maxTokens: 1200,
        },
        [
          {
            role: "user",
            content: [
              "你是历史场景导演。根据下列场景与人物表，推断大朝会/议事时**合乎史实的站位与派系编组**（谁与谁一列、谁可能告病不入朝等）。",
              "只输出一个 JSON 对象，不要 Markdown 围栏，不要解释文字。结构严格为：",
              '{"groups":[{"name":"编组名（如 御座侧近臣）","members":["人物全名",...]},...],"absent":["本轮告假/不在现场的人物全名"]}',
              "members 中的名字必须与下列名单完全一致；每人最多出现一次；可全员在场 absent 为 []。",
              "",
              `场景：${humanSceneLabel(scenario.dynastyId, scenario.sceneType)}`,
              `背景摘要：${scenario.background.slice(0, 600)}`,
              "",
              "人物名单：",
              ...names.map((n) => `- ${n}`),
            ].join("\n"),
          },
        ],
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const fallback = defaultCourtFormation(scenario.characters, mode);
      await setScenarioCourtFormationJson(id, JSON.stringify(fallback));
      return NextResponse.json({
        ok: true,
        formation: fallback,
        note: `模型调用失败（${msg}），已改用默认品级编组`,
      });
    }

    let parsed: SuggestJson;
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : raw) as SuggestJson;
    } catch {
      const fallback = defaultCourtFormation(scenario.characters, mode);
      await setScenarioCourtFormationJson(id, JSON.stringify(fallback));
      return NextResponse.json({
        ok: true,
        formation: fallback,
        note: "模型输出无法解析，已用语序默认编组",
      });
    }

    const nameToId = new Map(
      scenario.characters.map((c) => [c.name.trim(), c.id] as const),
    );
    const used = new Set<string>();
    const groups: CourtFormation["groups"] = [];
    const groupMembers: Record<string, string[]> = {};
    let gid = 0;

    for (const g of parsed.groups ?? []) {
      const idg = `g${gid++}`;
      groups.push({ id: idg, name: g.name?.trim() || `编组${gid}` });
      const ids: string[] = [];
      for (const m of g.members ?? []) {
        const cid = nameToId.get(String(m).trim());
        if (cid && !used.has(cid)) {
          used.add(cid);
          ids.push(cid);
        }
      }
      groupMembers[idg] = ids;
    }

    if (groups.length === 0) {
      const fallback = defaultCourtFormation(scenario.characters, mode);
      await setScenarioCourtFormationJson(id, JSON.stringify(fallback));
      return NextResponse.json({ ok: true, formation: fallback });
    }

    const absentIds: string[] = [];
    for (const n of parsed.absent ?? []) {
      const cid = nameToId.get(String(n).trim());
      if (cid && !used.has(cid)) absentIds.push(cid);
    }

    const draft: CourtFormation = { groups, groupMembers, absentIds };
    const formation = reconcileFormation(scenario.characters, draft, mode);

    await setScenarioCourtFormationJson(id, JSON.stringify(formation));

    return NextResponse.json({ ok: true, formation });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `建议编组异常：${msg}` },
      { status: 500 },
    );
  }
}
