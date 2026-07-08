import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    name?: string;
    apiBaseUrl?: string;
    apiKey?: string;
    modelName?: string;
    dimensions?: number | null;
  };
  const data: Record<string, unknown> = {};
  if (body.name != null) data.name = body.name;
  if (body.apiBaseUrl != null) data.apiBaseUrl = body.apiBaseUrl.replace(/\/+$/, "");
  if (body.apiKey != null) data.apiKeyEncrypted = encryptSecret(body.apiKey);
  if (body.modelName != null) data.modelName = body.modelName;
  if (body.dimensions !== undefined) data.dimensions = body.dimensions;
  try {
    const row = await prisma.embeddingEndpoint.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        apiBaseUrl: true,
        modelName: true,
        dimensions: true,
      },
    });
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
    await prisma.embeddingEndpoint.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
}
