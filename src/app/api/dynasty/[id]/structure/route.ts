import { NextResponse } from "next/server";
import { getDynastyById } from "@/server/dynasty/registry";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const d = getDynastyById(id);
  if (!d) return NextResponse.json({ error: "朝代不存在" }, { status: 404 });
  return NextResponse.json(d.government_structure);
}
