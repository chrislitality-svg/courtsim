import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { simulationBusPublish } from "@/lib/simulation-bus";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const sim = await prisma.simulation.update({
      where: { id },
      data: { status: "paused" },
    });
    simulationBusPublish(id, { type: "status", status: "paused" });
    return NextResponse.json({ ok: true, status: sim.status });
  } catch {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
}
