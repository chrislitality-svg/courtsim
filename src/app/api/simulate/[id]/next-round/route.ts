import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getScenarioCourtFormationJson } from "@/lib/scenario-court-formation-sql";
import {
  batchGetSpeechUserDirectives,
  collectAllSpeechIds,
  mergeUserDirectivesIntoSimulation,
} from "@/lib/speech-user-directive-sql";
import { runNextRoundLocked } from "@/server/engine/simulation-runner";

export const maxDuration = 300;

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const sim = await prisma.simulation.findUnique({ where: { id } });
    if (!sim) return NextResponse.json({ error: "未找到" }, { status: 404 });
    if (sim.status === "completed") {
      return NextResponse.json({ error: "推演已结束" }, { status: 400 });
    }
    if (sim.status === "running") {
      return NextResponse.json({ error: "正在执行中，请稍候" }, { status: 409 });
    }
    if (sim.status === "paused") {
      return NextResponse.json({ error: "已暂停" }, { status: 400 });
    }

    await runNextRoundLocked(id);

    const updated = await prisma.simulation.findUnique({
      where: { id },
      include: {
        scenario: {
          select: {
            id: true,
            name: true,
            dynastyId: true,
            sceneType: true,
            background: true,
            rules: true,
            agentModelId: true,
            protagonistCharacterId: true,
            characters: {
              orderBy: { createdAt: "asc" },
              select: { id: true, name: true, identity: true },
            },
          },
        },
        rounds: {
          orderBy: { roundNumber: "asc" },
          include: {
            speeches: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                innerMonologue: true,
                publicSpeech: true,
                strategyNote: true,
                sourceRefs: true,
              dialogueMeta: true,
              createdAt: true,
                character: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!updated) {
      return NextResponse.json({ ok: false, error: "推演记录已不存在" }, { status: 404 });
    }

    const courtFormation = await getScenarioCourtFormationJson(updated.scenarioId);
    const dirMap = await batchGetSpeechUserDirectives(collectAllSpeechIds(updated));
    const merged = mergeUserDirectivesIntoSimulation(updated, dirMap);

    return NextResponse.json({
      ok: true,
      simulation: {
        ...merged,
        scenario: { ...merged.scenario, courtFormation },
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
