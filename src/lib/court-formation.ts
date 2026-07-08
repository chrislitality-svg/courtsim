import type { Character } from "@prisma/client";
import { orderCharactersForRound, type SpeakingOrderMode } from "@/server/engine/speaking-order";

const DEFAULT_GROUP = "court";

export type CourtFormation = {
  /** 编组（从左到右或从尊到卑可自由命名） */
  groups: { id: string; name: string }[];
  /** 每组内角色 id 顺序（仅在场且列入组内者参与发言排序） */
  groupMembers: Record<string, string[]>;
  /** 不在现场、本轮跳过发言 */
  absentIds: string[];
};

export function emptyFormation(): CourtFormation {
  return {
    groups: [{ id: DEFAULT_GROUP, name: "朝班" }],
    groupMembers: { [DEFAULT_GROUP]: [] },
    absentIds: [],
  };
}

/** 按品级序生成默认编组：全员在场、单组 */
export function defaultCourtFormation(
  characters: Character[],
  speakingMode: SpeakingOrderMode,
): CourtFormation {
  const ordered = orderCharactersForRound(characters, speakingMode, 1);
  return {
    groups: [{ id: DEFAULT_GROUP, name: "朝班" }],
    groupMembers: { [DEFAULT_GROUP]: ordered.map((c) => c.id) },
    absentIds: [],
  };
}

export function parseCourtFormation(raw: string | null | undefined): CourtFormation | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as CourtFormation;
    if (!j.groups || !Array.isArray(j.groups)) return null;
    if (!j.groupMembers || typeof j.groupMembers !== "object") return null;
    if (!Array.isArray(j.absentIds)) j.absentIds = [];
    return j as CourtFormation;
  } catch {
    return null;
  }
}

/**
 * 合并服务端已有编组与当前角色列表（新增角色进入默认组末尾，删除角色自动剔除）
 */
export function reconcileFormation(
  characters: Character[],
  existing: CourtFormation | null,
  speakingMode: SpeakingOrderMode,
): CourtFormation {
  const ids = new Set(characters.map((c) => c.id));
  const base = existing ?? defaultCourtFormation(characters, speakingMode);

  const absentIds = base.absentIds.filter((id) => ids.has(id));

  const groups = base.groups.length
    ? base.groups
    : [{ id: DEFAULT_GROUP, name: "朝班" }];

  const groupMembers: Record<string, string[]> = {};
  const seen = new Set<string>();

  for (const g of groups) {
    const list = (base.groupMembers[g.id] ?? []).filter((id) => ids.has(id));
    groupMembers[g.id] = [];
    for (const id of list) {
      if (!seen.has(id)) {
        seen.add(id);
        groupMembers[g.id].push(id);
      }
    }
  }

  const defaultGid = groups[0]!.id;
  for (const c of characters) {
    if (!seen.has(c.id) && !absentIds.includes(c.id)) {
      if (!groupMembers[defaultGid]) groupMembers[defaultGid] = [];
      groupMembers[defaultGid].push(c.id);
      seen.add(c.id);
    }
  }

  // 同名人物只保留一条（按 characters 数组先后，先创建者为准），避免编组出现两个「魏忠贤」
  const canonicalIdByName = new Map<string, string>();
  for (const c of characters) {
    const nm = c.name.trim();
    if (!canonicalIdByName.has(nm)) canonicalIdByName.set(nm, c.id);
  }
  const namePlaced = new Set<string>();
  const dedupedGm: Record<string, string[]> = {};
  for (const g of groups) {
    dedupedGm[g.id] = [];
    for (const cid of groupMembers[g.id] ?? []) {
      const c = characters.find((x) => x.id === cid);
      if (!c) continue;
      const nm = c.name.trim();
      const canon = canonicalIdByName.get(nm) ?? cid;
      if (namePlaced.has(nm)) continue;
      namePlaced.add(nm);
      dedupedGm[g.id].push(canon);
    }
  }

  return { groups, groupMembers: dedupedGm, absentIds };
}

/** 按编组顺序过滤在场角色，得到本轮发言顺序 */
export function orderCharactersByFormation(
  characters: Character[],
  formation: CourtFormation | null,
  speakingMode: SpeakingOrderMode,
  roundNumber: number,
): Character[] {
  const byId = new Map(characters.map((c) => [c.id, c] as const));
  const absent = new Set(formation?.absentIds ?? []);

  if (!formation?.groups?.length) {
    return orderCharactersForRound(
      characters.filter((c) => !absent.has(c.id)),
      speakingMode,
      roundNumber,
    );
  }

  const out: Character[] = [];
  const used = new Set<string>();

  const nameSpoken = new Set<string>();
  for (const g of formation.groups) {
    const ids = formation.groupMembers[g.id] ?? [];
    for (const id of ids) {
      if (used.has(id) || absent.has(id)) continue;
      const c = byId.get(id);
      if (c) {
        const nm = c.name.trim();
        if (nameSpoken.has(nm)) continue;
        nameSpoken.add(nm);
        out.push(c);
        used.add(id);
      }
    }
  }

  const rest = characters.filter(
    (c) => !used.has(c.id) && !absent.has(c.id),
  );
  const tail = orderCharactersForRound(rest, speakingMode, roundNumber);
  for (const c of tail) {
    const nm = c.name.trim();
    if (nameSpoken.has(nm)) continue;
    nameSpoken.add(nm);
    used.add(c.id);
    out.push(c);
  }

  return out;
}
