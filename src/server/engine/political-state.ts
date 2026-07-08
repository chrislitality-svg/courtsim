/** 轮次「政治状态」JSON 与上下文展示（对齐《深度需求完整版》§2.2） */

export type PoliticalStateShape = {
  factionStances?: Record<string, string>;
  emperorSignals?: string[];
  keyEvents?: string[];
  openQuestions?: string[];
};

export function formatPoliticalStateForContext(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as PoliticalStateShape;
    const lines: string[] = [];
    if (o.factionStances && typeof o.factionStances === "object") {
      const entries = Object.entries(o.factionStances);
      if (entries.length)
        lines.push(
          "派系立场：" +
            entries.map(([k, v]) => `${k}→${v}`).join("；"),
        );
    }
    if (Array.isArray(o.emperorSignals) && o.emperorSignals.length) {
      lines.push("皇权信号：" + o.emperorSignals.join("；"));
    }
    if (Array.isArray(o.keyEvents) && o.keyEvents.length) {
      lines.push("关键事件：" + o.keyEvents.join("；"));
    }
    if (Array.isArray(o.openQuestions) && o.openQuestions.length) {
      lines.push("未决问题：" + o.openQuestions.join("；"));
    }
    return lines.length ? lines.join("\n") : null;
  } catch {
    return null;
  }
}

/** 解析轮次摘要模型输出：【摘要】+【政治状态JSON】 */
export function parseRoundSummarizerOutput(full: string): {
  summary: string;
  politicalStateJson: string | null;
} {
  const text = full.trim();
  const jsonMarker = "【政治状态JSON】";
  const idx = text.indexOf(jsonMarker);
  if (idx === -1) {
    const brace = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (brace !== -1 && end > brace) {
      const slice = text.slice(brace, end + 1);
      try {
        const parsed = JSON.parse(slice) as Record<string, unknown>;
        if (
          parsed &&
          ("factionStances" in parsed ||
            "emperorSignals" in parsed ||
            "keyEvents" in parsed ||
            "openQuestions" in parsed)
        ) {
          return {
            summary: text.slice(0, brace).replace(/^【摘要】\s*/m, "").trim().slice(0, 2500),
            politicalStateJson: JSON.stringify(parsed),
          };
        }
      } catch {
        /* fall through */
      }
    }
    return { summary: text.slice(0, 2500), politicalStateJson: null };
  }
  const summaryPart = text.slice(0, idx).replace(/^【摘要】\s*/m, "").trim();
  let jsonPart = text.slice(idx + jsonMarker.length).trim();
  jsonPart = jsonPart.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const brace = jsonPart.indexOf("{");
  const end = jsonPart.lastIndexOf("}");
  if (brace === -1 || end <= brace) {
    return {
      summary: summaryPart.slice(0, 2500) || text.slice(0, 2500),
      politicalStateJson: null,
    };
  }
  const jsonSlice = jsonPart.slice(brace, end + 1);
  try {
    const parsed = JSON.parse(jsonSlice) as unknown;
    if (parsed && typeof parsed === "object") {
      return {
        summary: summaryPart.slice(0, 2500),
        politicalStateJson: JSON.stringify(parsed),
      };
    }
  } catch {
    /* ignore */
  }
  return {
    summary: summaryPart.slice(0, 2500) || text.slice(0, 2500),
    politicalStateJson: null,
  };
}
