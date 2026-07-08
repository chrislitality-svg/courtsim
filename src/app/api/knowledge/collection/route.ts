import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const rows = await prisma.knowledgeCollection.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { id: true, name: true } },
      _count: { select: { sources: true } },
    },
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    name?: string;
    description?: string;
    projectId?: string | null;
  };
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "缺少 name" }, { status: 400 });
  }
  const row = await prisma.knowledgeCollection.create({
    data: {
      name,
      description: body.description?.trim() || null,
      projectId: body.projectId?.trim() || null,
    },
  });
  return NextResponse.json(row);
}
