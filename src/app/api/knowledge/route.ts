import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const processedOnly = searchParams.get("processed") === "1";
  const collectionId = searchParams.get("collectionId");
  const projectId = searchParams.get("projectId");

  const rows = await prisma.knowledgeSource.findMany({
    where: {
      ...(processedOnly ? { totalChunks: { gt: 0 } } : {}),
      ...(collectionId ? { collectionId } : {}),
      ...(projectId
        ? { collection: { projectId } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      collection: {
        include: {
          project: { select: { id: true, name: true } },
        },
      },
      scenarios: {
        include: {
          scenario: {
            select: { id: true, name: true, projectId: true },
          },
        },
      },
    },
  });

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      author: r.author,
      type: r.type,
      dynasty: r.dynasty,
      fileName: r.fileName,
      totalChunks: r.totalChunks,
      createdAt: r.createdAt,
      collectionId: r.collectionId,
      collection: r.collection
        ? {
            id: r.collection.id,
            name: r.collection.name,
            project: r.collection.project,
          }
        : null,
      linkedScenarios: r.scenarios.map((sk) => ({
        id: sk.scenario.id,
        name: sk.scenario.name,
        projectId: sk.scenario.projectId,
      })),
    })),
  );
}
