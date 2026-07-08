/** 与 `src/data/dynasties` 注册 id 对齐，用于 data-dynasty 与主题 CSS */

export const DYNASTY_THEME_IDS = [
  "default",
  "qin",
  "han-west",
  "tang",
  "song-north",
  "wudai-shiguo",
  "ming",
  "qing",
] as const;

export type DynastyThemeId = (typeof DYNASTY_THEME_IDS)[number];

const LABELS: Record<string, string> = {
  default: "水墨·通景",
  qin: "秦·玄墨",
  "han-west": "西汉·朱漆",
  tang: "唐·青绿",
  "song-north": "北宋·天青",
  "wudai-shiguo": "五代十国·裂变",
  ming: "明·宫绛",
  qing: "清·石青",
};

export function normalizeDynastyThemeId(
  dynastyId: string | null | undefined,
): DynastyThemeId {
  if (!dynastyId) return "default";
  return (DYNASTY_THEME_IDS as readonly string[]).includes(dynastyId)
    ? (dynastyId as DynastyThemeId)
    : "default";
}

export function dynastyThemeLabel(dynastyId: string | null | undefined): string {
  return LABELS[normalizeDynastyThemeId(dynastyId)] ?? LABELS.default;
}
