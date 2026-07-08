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
    apiFormat?: string;
    maxContextTokens?: number | null;
    defaultTemperature?: number | null;
  };
  const data: Record<string, unknown> = {};
  if (body.name != null) data.name = body.name;
  if (body.apiBaseUrl != null) data.apiBaseUrl = body.apiBaseUrl.replace(/\/+$/, "");
  if (body.apiKey != null) data.apiKeyEncrypted = encryptSecret(body.apiKey);
  if (body.modelName != null) data.modelName = body.modelName;
  if (body.apiFormat != null) data.apiFormat = body.apiFormat;
  if (body.maxContextTokens !== undefined) data.maxContextTokens = body.maxContextTokens;
  if (body.defaultTemperature !== undefined) data.defaultTemperature = body.defaultTemperature;

  try {
    const row = await prisma.modelEndpoint.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        apiBaseUrl: true,
        modelName: true,
        apiFormat: true,
        maxContextTokens: true,
        defaultTemperature: true,
        updatedAt: true,
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
    await prisma.modelEndpoint.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
}
