import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { simulationBusPublish } from "@/lib/simulation-bus";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const cur = await prisma.simulation.findUnique({ where: { id } });
  if (!cur) return NextResponse.json({ error: "未找到" }, { status: 404 });
  if (cur.status !== "paused") {
    return NextResponse.json({ error: "当前非暂停状态" }, { status: 400 });
  }
  const sim = await prisma.simulation.update({
    where: { id },
    data: { status: "idle" },
  });
  simulationBusPublish(id, { type: "status", status: "idle" });
  return NextResponse.json({ ok: true, status: sim.status });
}
