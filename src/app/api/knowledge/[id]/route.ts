import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const src = await prisma.knowledgeSource.findUnique({
    where: { id },
    include: {
      chunks: {
        orderBy: { chunkIndex: "asc" },
        select: {
          id: true,
          chunkIndex: true,
          content: true,
          metadata: true,
        },
      },
    },
  });
  if (!src) return NextResponse.json({ error: "未找到" }, { status: 404 });

  const preview = src.chunks.map((c) => ({
    ...c,
    content:
      c.content.length > 400 ? `${c.content.slice(0, 400)}…` : c.content,
  }));

  return NextResponse.json({ ...src, chunks: preview });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { collectionId?: string | null };
  if (body.collectionId === undefined) {
    return NextResponse.json({ error: "缺少 collectionId" }, { status: 400 });
  }
  const collectionId =
    body.collectionId === null || body.collectionId === ""
      ? null
      : body.collectionId;
  if (collectionId) {
    const col = await prisma.knowledgeCollection.findUnique({
      where: { id: collectionId },
    });
    if (!col) {
      return NextResponse.json({ error: "分组不存在" }, { status: 400 });
    }
  }
  try {
    const row = await prisma.knowledgeSource.update({
      where: { id },
      data: { collectionId },
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
  const src = await prisma.knowledgeSource.findUnique({ where: { id } });
  if (!src) return NextResponse.json({ error: "未找到" }, { status: 404 });

  if (src.storagePath) {
    try {
      await unlink(
        path.join(process.cwd(), src.storagePath.replace(/\//g, path.sep)),
      );
    } catch {
      /* ignore */
    }
  }

  await prisma.knowledgeSource.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
