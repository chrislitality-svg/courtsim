import { redirect } from "next/navigation";

/** 已合并至「模型设置 → Embedding」标签，保留路径以兼容书签与外链 */
export default function EmbeddingSettingsRedirectPage() {
  redirect("/settings/models?tab=embedding");
}
