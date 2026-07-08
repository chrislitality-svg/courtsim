import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { fetchEmbedding } from "@/server/knowledge/embedding-client";
import {
  bufferToEmbedding,
  cosineSimilarity,
} from "@/server/knowledge/vector";

export interface RetrievedChunk {
  content: string;
  score: number;
  sourceId: string;
  sourceTitle: string;
  chunkIndex: number;
}

export async function searchKnowledgeChunks(params: {
  query: string;
  embeddingEndpointId: string;
  sourceIds?: string[];
  topK?: number;
}): Promise<RetrievedChunk[]> {
  const ep = await prisma.embeddingEndpoint.findUnique({
    where: { id: params.embeddingEndpointId },
  });
  if (!ep) throw new Error("Embedding 端点不存在");
  const apiKey = decryptSecret(ep.apiKeyEncrypted);
  const qv = await fetchEmbedding(
    ep.apiBaseUrl,
    apiKey,
    ep.modelName,
    params.query,
  );

  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      embedding: { not: null },
      ...(params.sourceIds?.length
        ? { sourceId: { in: params.sourceIds } }
        : {}),
    },
    include: {
      source: { select: { id: true, title: true } },
    },
  });

  const topK = params.topK ?? 5;
  return chunks
    .map((c) => {
      if (!c.embedding) return null;
      const v = bufferToEmbedding(Buffer.from(c.embedding));
      return {
        content: c.content,
        score: cosineSimilarity(qv, v),
        sourceId: c.source.id,
        sourceTitle: c.source.title,
        chunkIndex: c.chunkIndex,
      };
    })
    .filter((x): x is RetrievedChunk => x != null)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export function formatRagBlock(chunks: RetrievedChunk[]): string {
  if (!chunks.length) return "";
  const lines = chunks.map(
    (c, i) =>
      `[史料片段${i + 1} · ${c.sourceTitle} #${c.chunkIndex} · sim=${c.score.toFixed(3)}]\n${c.content}`,
  );
  return "下列内容与用户问题语义相近，供参证（非必然为真）：\n\n" + lines.join("\n\n---\n\n");
}
