import type { DynastyProfile } from "@/types/dynasty";
import { chatCompletions, type ChatMessage } from "@/server/llm/unified-client";
import { resolveTemporalContext } from "@/server/dynasty/temporal-context";

export type FidelityMode = "strict" | "moderate" | "fiction";

export interface GeneratePersonnelParams {
  dynasty: DynastyProfile;
  periodId?: string;
  year?: number;
  sceneId: string;
  fidelityMode: FidelityMode;
  structureSummary: string;
  /** 已检索格式化的史料块，注入用户 Prompt */
  ragContext?: string;
  model: {
    apiBaseUrl: string;
    apiKey: string;
    modelName: string;
    apiFormat?: "openai" | "anthropic";
  };
}

export interface GeneratedPosition {
  position: string;
  character: {
    name: string;
    identity: Record<string, unknown>;
    behavior?: Record<string, unknown>;
    auto_generated: true;
    uncertain?: boolean;
  };
}

export interface GeneratedPersonnel {
  era: string;
  note?: string;
  positions: GeneratedPosition[];
}

const SYSTEM = `你是中国历史专家。根据用户给出的朝代、时期、职官架构与场景，列出该场合需要出场的职位及真实历史人物。
输出必须是合法 JSON，顶层结构为：
{"era":"string","note":"string","positions":[{"position":"职位名","character":{"name":"姓名","identity":{"title":"…","background":"…","age":数字可选},"behavior":{"personality":"…","speech_style":{}},"auto_generated":true,"uncertain":false}}]}
不确定在位者时 uncertain 为 true，note 中说明存疑。不要 Markdown，不要代码块包裹。`;

export async function generatePersonnelWithLLM(
  params: GeneratePersonnelParams,
): Promise<GeneratedPersonnel> {
  const { eraLine, detail } = resolveTemporalContext(
    params.dynasty,
    params.periodId,
    params.year,
  );
  const eraLabel = eraLine;

  const user = [
    `朝代：${params.dynasty.name}（${params.dynasty.period}）`,
    `时间定位：${eraLine}`,
    detail ? `时空与政权背景：\n${detail}` : "",
    params.year ? `用户指定公元年：${params.year}` : "",
    `场景类型 id：${params.sceneId}`,
    `真实度：${params.fidelityMode}（strict 须贴近史实；fiction 可典型化虚构）`,
    params.ragContext ? `参考史料摘录：\n${params.ragContext}` : "",
    `职官架构摘要：\n${params.structureSummary}`,
    "请仅输出 JSON。",
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await chatCompletions(params.model, [
    { role: "system", content: SYSTEM },
    { role: "user", content: user },
  ] as ChatMessage[]);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as GeneratedPersonnel;
  if (!parsed.positions || !Array.isArray(parsed.positions)) {
    throw new Error("LLM 返回格式无效：缺少 positions 数组");
  }
  return {
    era: parsed.era || eraLabel,
    note: parsed.note,
    positions: parsed.positions.map((p) => ({
      ...p,
      character: {
        ...p.character,
        auto_generated: true as const,
      },
    })),
  };
}

export function structureSummaryFromProfile(d: DynastyProfile): string {
  const lines: string[] = [d.government_structure.name];
  for (const h of d.government_structure.hierarchy) {
    const titles = (h.positions ?? []).map((x) => x.title).join("、");
    lines.push(`L${h.level} ${h.name}: ${titles}`);
  }
  return lines.join("\n");
}
