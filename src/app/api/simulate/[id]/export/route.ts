import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const sim = await prisma.simulation.findUnique({
    where: { id },
    include: {
      scenario: {
        include: {
          characters: true,
        },
      },
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: {
          speeches: {
            orderBy: { createdAt: "asc" },
            include: {
              character: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (!sim) return NextResponse.json({ error: "未找到" }, { status: 404 });

  const body = JSON.stringify(sim, null, 2);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="courtsim-sim-${id}.json"`,
    },
  });
}
