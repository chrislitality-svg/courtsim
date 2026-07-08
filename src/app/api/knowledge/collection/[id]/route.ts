import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    name?: string;
    description?: string | null;
    projectId?: string | null;
  };
  const data: {
    name?: string;
    description?: string | null;
    projectId?: string | null;
  } = {};
  if (body.name !== undefined) {
    const n = body.name.trim();
    if (!n) return NextResponse.json({ error: "name 不能为空" }, { status: 400 });
    data.name = n;
  }
  if (body.description !== undefined) {
    data.description = body.description?.trim() || null;
  }
  if (body.projectId !== undefined) {
    data.projectId = body.projectId?.trim() || null;
  }
  try {
    const row = await prisma.knowledgeCollection.update({ where: { id }, data });
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
  const count = await prisma.knowledgeSource.count({ where: { collectionId: id } });
  if (count > 0) {
    return NextResponse.json(
      { error: "分组内仍有文档，请先移动或删除文档" },
      { status: 400 },
    );
  }
  try {
    await prisma.knowledgeCollection.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
}
