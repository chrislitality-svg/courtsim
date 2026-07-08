import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { chunkText } from "@/server/knowledge/chunker";
import { fetchEmbedding } from "@/server/knowledge/embedding-client";
import { embeddingToBuffer } from "@/server/knowledge/vector";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { embeddingEndpointId?: string };
  if (!body.embeddingEndpointId) {
    return NextResponse.json({ error: "缺少 embeddingEndpointId" }, { status: 400 });
  }

  const src = await prisma.knowledgeSource.findUnique({ where: { id } });
  if (!src) return NextResponse.json({ error: "未找到" }, { status: 404 });
  if (!src.storagePath) {
    return NextResponse.json({ error: "无存储路径" }, { status: 400 });
  }

  const ep = await prisma.embeddingEndpoint.findUnique({
    where: { id: body.embeddingEndpointId },
  });
  if (!ep) {
    return NextResponse.json({ error: "Embedding 端点不存在" }, { status: 404 });
  }

  const abs = path.join(process.cwd(), src.storagePath.replace(/\//g, path.sep));
  const text = await readFile(abs, "utf-8");
  const pieces = chunkText(text, 900, 100);
  if (!pieces.length) {
    return NextResponse.json({ error: "文件为空" }, { status: 400 });
  }

  const apiKey = decryptSecret(ep.apiKeyEncrypted);

  await prisma.knowledgeChunk.deleteMany({ where: { sourceId: id } });

  let idx = 0;
  for (const content of pieces) {
    const vec = await fetchEmbedding(
      ep.apiBaseUrl,
      apiKey,
      ep.modelName,
      content.slice(0, 8000),
    );
    await prisma.knowledgeChunk.create({
      data: {
        sourceId: id,
        content,
        chunkIndex: idx++,
        embedding: embeddingToBuffer(vec),
        metadata: null,
      },
    });
  }

  await prisma.knowledgeSource.update({
    where: { id },
    data: { totalChunks: pieces.length },
  });

  return NextResponse.json({ ok: true, chunks: pieces.length });
}
