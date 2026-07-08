import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parseCourtFormation,
  reconcileFormation,
  type CourtFormation,
} from "@/lib/court-formation";
import {
  getScenarioCourtFormationJson,
  setScenarioCourtFormationJson,
} from "@/lib/scenario-court-formation-sql";

function parseSpeakingMode(rules: string): "hierarchical" | "free" {
  try {
    const o = JSON.parse(rules) as Record<string, unknown>;
    return o.speaking_order === "free" ? "free" : "hierarchical";
  } catch {
    return "hierarchical";
  }
}

/** GET：返回与角色对齐后的编组 JSON */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const scenario = await prisma.scenario.findUnique({
    where: { id },
    include: { characters: true },
  });
  if (!scenario) return NextResponse.json({ error: "未找到" }, { status: 404 });
  const mode = parseSpeakingMode(scenario.rules);
  const stored = await getScenarioCourtFormationJson(id);
  const formation = reconcileFormation(
    scenario.characters,
    parseCourtFormation(stored),
    mode,
  );
  return NextResponse.json({ formation });
}

/** PUT：保存编组（body: { formation: CourtFormation }） */
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { formation?: CourtFormation };
  if (!body.formation?.groups) {
    return NextResponse.json({ error: "缺少 formation" }, { status: 400 });
  }
  const scenario = await prisma.scenario.findUnique({
    where: { id },
    include: { characters: true },
  });
  if (!scenario) return NextResponse.json({ error: "未找到" }, { status: 404 });
  const mode = parseSpeakingMode(scenario.rules);
  const cleaned = reconcileFormation(scenario.characters, body.formation, mode);
  await setScenarioCourtFormationJson(id, JSON.stringify(cleaned));
  return NextResponse.json({ ok: true, formation: cleaned });
}
