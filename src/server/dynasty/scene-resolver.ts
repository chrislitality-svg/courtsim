import { universalScenes } from "@/data/scenes/universal";
import type { DynastyProfile } from "@/types/dynasty";
import type { SceneFormality } from "@/types/scene";

function asFormality(v: string | undefined): SceneFormality {
  const allowed: SceneFormality[] = [
    "highest",
    "high",
    "high_military",
    "medium",
    "low",
    "informal",
  ];
  if (v && allowed.includes(v as SceneFormality)) return v as SceneFormality;
  return "medium";
}

/** 将通用场景模板与某朝代可用场景交叉，便于向导展示 */
export function resolveScenesForDynasty(profile: DynastyProfile) {
  const byId = new Map(profile.available_scenes.map((s) => [s.id, s]));
  return universalScenes
    .filter((u) => byId.has(u.id) || u.id === "custom")
    .map((u) => {
      const local = byId.get(u.id);
      const variant = u.dynasty_variants?.[profile.id];
      return {
        universalId: u.id,
        category: u.category,
        formality: u.formality,
        name: local?.name ?? variant?.name ?? u.name_template.replace("{朝代}", profile.name),
        location: local?.location ?? variant?.location,
        description: local?.description ?? u.description ?? u.description_template ?? "",
        notes: variant?.notes,
        speaking_rules: local?.speaking_rules,
        typical_attendees: local?.typical_attendees,
      };
    })
    .concat(
      profile.available_scenes
        .filter((s) => !universalScenes.some((u) => u.id === s.id))
        .map((s) => ({
          universalId: s.id,
          category: s.category ?? "custom",
          formality: asFormality(s.formality),
          name: s.name,
          location: s.location,
          description: s.description,
          notes: undefined as string | undefined,
          speaking_rules: s.speaking_rules,
          typical_attendees: s.typical_attendees,
        })),
    );
}
