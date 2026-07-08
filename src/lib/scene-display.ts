import { getDynasty } from "@/data/dynasties/index";
import { universalScenes } from "@/data/scenes/universal";

/** 将场景模板 id（如 grand_court）转为可读中文名（不含朝代前缀时可单独用） */
export function universalSceneTitle(sceneTypeId: string): string {
  const s = universalScenes.find((x) => x.id === sceneTypeId);
  if (!s) return "场景";
  const t = s.name_template ?? "";
  return t.replace(/\{朝代\}/g, "").replace(/^·+|·+$/g, "").trim() || s.id;
}

/**
 * 界面展示用：如「秦 · 大朝会」，避免出现 grand_court 等英文 id。
 */
export function humanSceneLabel(dynastyId: string, sceneTypeId: string): string {
  const d = getDynasty(dynastyId);
  const dn = d?.name ?? "该朝代";
  const scene = universalScenes.find((x) => x.id === sceneTypeId);
  if (!scene) return `${dn} · ${sceneTypeId}`;
  const title = scene.name_template.replace(/\{朝代\}/g, dn);
  return title;
}
