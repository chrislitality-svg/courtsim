import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const defaultTopic = () =>
  JSON.stringify({ title: "", context: "", type: "historical" });
const defaultProtagonist = () =>
  JSON.stringify({
    name: "",
    role: "",
    objective: "",
    constraints: [] as string[],
    allies: [] as string[],
  });
const defaultRules = () =>
  JSON.stringify({
    speaking_order: "hierarchical",
    max_rounds: 10,
    context_window_rounds: 2,
    context_max_chars: 14000,
    enable_round_summary: true,
  });

export async function GET() {
  const rows = await prisma.scenario.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      projectId: true,
      dynastyId: true,
      periodId: true,
      year: true,
      sceneType: true,
      fidelity: true,
      updatedAt: true,
    },
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    name: string;
    dynastyId: string;
    periodId?: string | null;
    year?: number | null;
    sceneType: string;
    sceneLocation?: string | null;
    sceneDescription?: string | null;
    background: string;
    topic?: unknown;
    protagonist?: unknown;
    rules?: unknown;
    rulesLayer?: unknown;
    fidelity?: string;
    agentModelId?: string | null;
    summarizerModelId?: string | null;
    embeddingModelId?: string | null;
    knowledgeSourceIds?: string[];
    projectId?: string | null;
    protagonistCharacterId?: string | null;
  };

  if (!body.name || !body.dynastyId || !body.sceneType || !body.background) {
    return NextResponse.json(
      { error: "缺少 name / dynastyId / sceneType / background" },
      { status: 400 },
    );
  }

  const row = await prisma.$transaction(async (tx) => {
    const s = await tx.scenario.create({
      data: {
        name: body.name,
        projectId: body.projectId?.trim() || null,
        dynastyId: body.dynastyId,
        periodId: body.periodId ?? null,
        year: body.year ?? null,
        sceneType: body.sceneType,
        sceneLocation: body.sceneLocation ?? null,
        sceneDescription: body.sceneDescription ?? null,
        background: body.background,
        topic: JSON.stringify(body.topic ?? JSON.parse(defaultTopic())),
        protagonist: JSON.stringify(
          body.protagonist ?? JSON.parse(defaultProtagonist()),
        ),
        rules: JSON.stringify(body.rules ?? JSON.parse(defaultRules())),
        rulesLayer:
          body.rulesLayer != null ? JSON.stringify(body.rulesLayer) : null,
        fidelity: body.fidelity ?? "moderate",
        agentModelId: body.agentModelId ?? null,
        summarizerModelId: body.summarizerModelId ?? null,
        embeddingModelId: body.embeddingModelId ?? null,
        protagonistCharacterId: body.protagonistCharacterId?.trim() || null,
      },
    });
    const kids = body.knowledgeSourceIds ?? [];
    for (const sourceId of kids) {
      await tx.scenarioKnowledge.create({
        data: { scenarioId: s.id, sourceId },
      });
    }
    return s;
  });
  return NextResponse.json(row);
}
