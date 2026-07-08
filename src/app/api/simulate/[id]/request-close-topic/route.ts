import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setCloseTopicNextRoundSql } from "@/lib/simulation-close-topic-sql";

/** 下一轮全体收束当前议题并给出结果 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const exists = await prisma.simulation.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
  await setCloseTopicNextRoundSql(id, true);
  return NextResponse.json({ ok: true });
}
