import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { chatCompletions } from "@/server/llm/unified-client";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const row = await prisma.modelEndpoint.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "未找到" }, { status: 404 });
  const apiKey = decryptSecret(row.apiKeyEncrypted);
  try {
    const reply = await chatCompletions(
      {
        apiBaseUrl: row.apiBaseUrl,
        apiKey,
        modelName: row.modelName,
        apiFormat: row.apiFormat as "openai" | "anthropic",
        maxTokens: 64,
        temperature: 0,
      },
      [{ role: "user", content: "Reply with exactly: OK" }],
    );
    return NextResponse.json({ ok: true, sample: reply.slice(0, 200) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
