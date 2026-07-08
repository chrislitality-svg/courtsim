import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = (await req.json()) as { scenarioId?: string };
  if (!body.scenarioId) {
    return NextResponse.json({ error: "缺少 scenarioId" }, { status: 400 });
  }

  const scenario = await prisma.scenario.findUnique({
    where: { id: body.scenarioId },
    include: { characters: true },
  });
  if (!scenario) {
    return NextResponse.json({ error: "场景不存在" }, { status: 404 });
  }
  if (!scenario.agentModelId) {
    return NextResponse.json(
      { error: "请先在场景保存时指定「角色模型」端点（agentModelId）" },
      { status: 400 },
    );
  }
  if (scenario.characters.length === 0) {
    return NextResponse.json(
      { error: "场景中没有任何角色，请先添加人物" },
      { status: 400 },
    );
  }

  const sim = await prisma.simulation.create({
    data: {
      scenarioId: scenario.id,
      status: "idle",
      currentRound: 0,
    },
  });

  return NextResponse.json({
    id: sim.id,
    scenarioId: scenario.id,
    status: sim.status,
  });
}
