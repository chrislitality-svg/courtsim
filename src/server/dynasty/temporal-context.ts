import type { DynastyProfile } from "@/types/dynasty";

export const HIGHLIGHT_PERIOD_PREFIX = "evt:";

export function isHighlightPeriodId(periodId: string | undefined | null): boolean {
  return !!periodId?.startsWith(HIGHLIGHT_PERIOD_PREFIX);
}

export function stripHighlightPrefix(periodId: string): string {
  return periodId.slice(HIGHLIGHT_PERIOD_PREFIX.length);
}

/** 供 LLM 与 UI 解析：年号轴 / 大事锚点 / 旧 sub_periods */
export function resolveTemporalContext(
  d: DynastyProfile,
  periodId?: string | null,
  year?: number | null,
): { eraLine: string; detail: string } {
  const y = year != null ? `公元 ${year} 年` : "";

  if (periodId && isHighlightPeriodId(periodId)) {
    const hid = stripHighlightPrefix(periodId);
    const ev = d.highlight_events.find((h) => h.id === hid);
    if (ev) {
      return {
        eraLine: `${d.name}·大事：${ev.name}（${ev.yearsLabel}）${y ? ` · ${y}` : ""}`,
        detail: [ev.description, d.polity_context ?? ""].filter(Boolean).join("\n"),
      };
    }
  }

  if (periodId) {
    const era = d.era_segments.find((e) => e.id === periodId);
    if (era) {
      const head = [era.nianhao, era.emperor].filter(Boolean).join(" · ");
      return {
        eraLine: `${d.name}·${era.name}（${era.years}）${head ? ` · ${head}` : ""}${y ? ` · ${y}` : ""}`,
        detail: [era.notes, d.polity_context ?? ""].filter(Boolean).join("\n"),
      };
    }
    const legacy = d.sub_periods.find((p) => p.id === periodId);
    if (legacy) {
      return {
        eraLine: `${d.name}·${legacy.name}（${legacy.years}）${y ? ` · ${y}` : ""}`,
        detail: d.polity_context ?? "",
      };
    }
  }

  return {
    eraLine: `${d.name}${y ? ` · ${y}` : ""}`,
    detail: d.polity_context ?? "",
  };
}
