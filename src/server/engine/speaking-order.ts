import type { Character } from "@prisma/client";

export type SpeakingOrderMode = "hierarchical" | "free";

function parseIdentity(c: Character): Record<string, unknown> {
  try {
    return JSON.parse(c.identity) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function rank(c: Character): number {
  const pos = String(parseIdentity(c).position ?? "");
  const n = c.name;
  if (pos.includes("皇帝") || n.includes("帝") || pos === "皇帝") return 0;
  if (
    pos.includes("首辅") ||
    pos.includes("宰相") ||
    pos.includes("丞相") ||
    pos.includes("军机")
  )
    return 1;
  if (pos.includes("尚书") || pos.includes("大学士") || pos.includes("阁")) return 2;
  if (pos.includes("御史") || pos.includes("给事中")) return 3;
  if (pos.includes("太监") || pos.includes("宦官") || pos.includes("司礼")) return 4;
  return 10;
}

/** 按文档：hierarchical 近似品级/权力序；free 为每轮轮转起点 */
export function orderCharactersForRound(
  characters: Character[],
  mode: SpeakingOrderMode,
  roundNumber: number,
): Character[] {
  const copy = [...characters];
  if (copy.length === 0) return copy;
  if (mode === "free") {
    const n = copy.length;
    const start = ((roundNumber - 1) % n + n) % n;
    return [...copy.slice(start), ...copy.slice(0, start)];
  }
  copy.sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name, "zh-Hans-CN");
  });
  return copy;
}
