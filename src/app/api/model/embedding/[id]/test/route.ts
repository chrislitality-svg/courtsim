import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { fetchEmbedding } from "@/server/knowledge/embedding-client";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const row = await prisma.embeddingEndpoint.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "未找到" }, { status: 404 });
  const apiKey = decryptSecret(row.apiKeyEncrypted);
  try {
    const vec = await fetchEmbedding(
      row.apiBaseUrl,
      apiKey,
      row.modelName,
      "测试",
    );
    return NextResponse.json({
      ok: true,
      dimensions: vec.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
