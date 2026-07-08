import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseJsonField<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const row = await prisma.scenario.findUnique({
    where: { id },
    include: { characters: true },
  });
  if (!row) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json({
    ...row,
    topic: parseJsonField(row.topic, {}),
    protagonist: parseJsonField(row.protagonist, {}),
    rules: parseJsonField(row.rules, {}),
    rulesLayer: row.rulesLayer ? parseJsonField(row.rulesLayer, {}) : null,
    characters: row.characters.map((c) => ({
      ...c,
      identity: parseJsonField(c.identity, {}),
      behavior: parseJsonField(c.behavior, {}),
      relationships: parseJsonField(c.relationships, {}),
    })),
  });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  const strFields = [
    "name",
    "dynastyId",
    "periodId",
    "sceneType",
    "sceneLocation",
    "sceneDescription",
    "background",
    "fidelity",
    "agentModelId",
    "summarizerModelId",
    "embeddingModelId",
  ] as const;
  for (const k of strFields) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  if (body.projectId !== undefined) {
    const v = body.projectId;
    data.projectId =
      v === null || v === "" ? null : (v as string);
  }
  if (body.protagonistCharacterId !== undefined) {
    const v = body.protagonistCharacterId;
    data.protagonistCharacterId =
      v === null || v === "" ? null : (v as string);
  }
  if (body.year !== undefined) data.year = body.year;
  for (const k of ["topic", "protagonist", "rules", "rulesLayer"] as const) {
    if (body[k] !== undefined) {
      data[k] =
        typeof body[k] === "string" ? body[k] : JSON.stringify(body[k]);
    }
  }
  try {
    const row = await prisma.scenario.update({ where: { id }, data });
    return NextResponse.json(row);
  } catch {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    await prisma.scenario.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
}
