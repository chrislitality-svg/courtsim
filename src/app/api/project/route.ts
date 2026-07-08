import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { scenarios: true, collections: true } },
    },
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = (await req.json()) as { name?: string; description?: string };
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "缺少 name" }, { status: 400 });
  }
  const row = await prisma.project.create({
    data: {
      name,
      description: body.description?.trim() || null,
    },
  });
  return NextResponse.json(row);
}
