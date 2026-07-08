import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateSpeechUserDirectiveSql } from "@/lib/speech-user-directive-sql";

/** PATCH body: { directive: string | null } — 用户批注，下一轮该角色发言时注入 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { directive?: string | null };
  const directive =
    body.directive == null || body.directive === ""
      ? null
      : String(body.directive).slice(0, 4000);

  const exists = await prisma.speech.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }

  const row = await updateSpeechUserDirectiveSql(id, directive);
  if (!row) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, speech: row });
}
