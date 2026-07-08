import { NextResponse } from "next/server";
import { searchKnowledgeChunks } from "@/server/knowledge/retriever";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    query?: string;
    embeddingEndpointId?: string;
    topK?: number;
    sourceIds?: string[];
  };
  if (!body.query?.trim() || !body.embeddingEndpointId) {
    return NextResponse.json(
      { error: "缺少 query / embeddingEndpointId" },
      { status: 400 },
    );
  }
  try {
    const hits = await searchKnowledgeChunks({
      query: body.query.trim(),
      embeddingEndpointId: body.embeddingEndpointId,
      sourceIds: body.sourceIds,
      topK: body.topK ?? 5,
    });
    return NextResponse.json({ hits });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
