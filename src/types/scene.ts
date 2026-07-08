export type SceneFormality =
  | "highest"
  | "high"
  | "high_military"
  | "medium"
  | "low"
  | "informal";

export type SpeakingOrder = "hierarchical" | "free" | "called";

export interface UniversalScene {
  id: string;
  name_template: string;
  category: string;
  formality: SceneFormality;
  description_template?: string;
  description?: string;
  dynasty_variants?: Record<
    string,
    { name?: string; location?: string; notes?: string }
  >;
}
