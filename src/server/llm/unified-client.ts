export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface UnifiedLLMOptions {
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
  apiFormat?: "openai" | "anthropic";
  temperature?: number;
  maxTokens?: number;
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return `${b}/${p}`;
}

/** OpenAI 兼容：/v1/chat/completions */
export async function chatCompletions(
  opts: UnifiedLLMOptions,
  messages: ChatMessage[],
): Promise<string> {
  const format = opts.apiFormat ?? "openai";
  if (format === "anthropic") {
    const system = messages.filter((m) => m.role === "system");
    const rest = messages.filter((m) => m.role !== "system");
    const url = joinUrl(opts.apiBaseUrl, "v1/messages");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": opts.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: opts.modelName,
        max_tokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature ?? 0.7,
        system: system.map((m) => m.content).join("\n\n"),
        messages: rest.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Anthropic HTTP ${res.status}: ${t}`);
    }
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.find((c) => c.type === "text")?.text;
    if (!text) throw new Error("Anthropic 响应无文本");
    return text;
  }

  const url = joinUrl(opts.apiBaseUrl, "v1/chat/completions");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.modelName,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 4096,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI-compatible HTTP ${res.status}: ${t}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI 兼容响应无 choices[0].message.content");
  return content;
}
