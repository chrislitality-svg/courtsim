import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { getDynastyById } from "@/server/dynasty/registry";
import {
  generatePersonnelWithLLM,
  structureSummaryFromProfile,
  type FidelityMode,
} from "@/server/dynasty/personnel-generator";
import {
  formatRagBlock,
  searchKnowledgeChunks,
} from "@/server/knowledge/retriever";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    dynastyId: string;
    periodId?: string;
    year?: number;
    sceneId: string;
    fidelityMode?: FidelityMode;
    modelEndpointId: string;
    embeddingEndpointId?: string;
    knowledgeSourceIds?: string[];
    ragQuery?: string;
  };

  if (!body.dynastyId || !body.sceneId || !body.modelEndpointId) {
    return NextResponse.json(
      { error: "缺少 dynastyId / sceneId / modelEndpointId" },
      { status: 400 },
    );
  }

  const dynasty = getDynastyById(body.dynastyId);
  if (!dynasty) {
    return NextResponse.json({ error: "朝代不存在" }, { status: 404 });
  }

  const endpoint = await prisma.modelEndpoint.findUnique({
    where: { id: body.modelEndpointId },
  });
  if (!endpoint) {
    return NextResponse.json({ error: "模型端点不存在" }, { status: 404 });
  }

  const apiKey = decryptSecret(endpoint.apiKeyEncrypted);

  let ragContext: string | undefined;
  if (
    body.embeddingEndpointId &&
    body.knowledgeSourceIds?.length &&
    body.ragQuery?.trim()
  ) {
    try {
      const hits = await searchKnowledgeChunks({
        query: body.ragQuery.trim(),
        embeddingEndpointId: body.embeddingEndpointId,
        sourceIds: body.knowledgeSourceIds,
        topK: 5,
      });
      ragContext = formatRagBlock(hits);
    } catch {
      ragContext = undefined;
    }
  }

  try {
    const result = await generatePersonnelWithLLM({
      dynasty,
      periodId: body.periodId,
      year: body.year,
      sceneId: body.sceneId,
      fidelityMode: body.fidelityMode ?? "moderate",
      structureSummary: structureSummaryFromProfile(dynasty),
      ragContext,
      model: {
        apiBaseUrl: endpoint.apiBaseUrl,
        apiKey,
        modelName: endpoint.modelName,
        apiFormat: endpoint.apiFormat as "openai" | "anthropic",
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
