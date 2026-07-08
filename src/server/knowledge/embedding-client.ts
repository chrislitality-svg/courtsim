import { joinUrl } from "@/lib/url";

export async function fetchEmbedding(
  apiBaseUrl: string,
  apiKey: string,
  modelName: string,
  input: string,
): Promise<number[]> {
  const url = joinUrl(apiBaseUrl, "v1/embeddings");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: modelName, input }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Embeddings HTTP ${res.status}: ${t}`);
  }
  const data = (await res.json()) as {
    data?: Array<{ embedding: number[] }>;
  };
  const emb = data.data?.[0]?.embedding;
  if (!emb?.length) throw new Error("Embeddings 响应无向量");
  return emb;
}
