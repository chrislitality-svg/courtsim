import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getScenarioCourtFormationJson } from "@/lib/scenario-court-formation-sql";
import {
  batchGetSpeechUserDirectives,
  collectAllSpeechIds,
  mergeUserDirectivesIntoSimulation,
} from "@/lib/speech-user-directive-sql";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const sim = await prisma.simulation.findUnique({
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
  if (!sim) return NextResponse.json({ error: "未找到" }, { status: 404 });
  const courtFormation = await getScenarioCourtFormationJson(sim.scenarioId);
  const dirMap = await batchGetSpeechUserDirectives(collectAllSpeechIds(sim));
  const merged = mergeUserDirectivesIntoSimulation(sim, dirMap);
  return NextResponse.json({
    ...merged,
    scenario: { ...merged.scenario, courtFormation },
  });
}
