/** 将人物 identity JSON（存库字符串或对象）格式化为可读中文，避免界面出现裸 JSON */

export function parseIdentityObject(
  raw: string | Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** 卡片一行：官职 · 姓名（姓名用参数，因库里有 name 字段） */
export function formatCharacterCardLine(
  identityJson: string | Record<string, unknown>,
  characterName: string,
): string {
  const id = parseIdentityObject(identityJson);
  const pos =
    id.position != null && String(id.position).trim()
      ? String(id.position).trim()
      : id.title != null && String(id.title).trim()
        ? String(id.title).trim()
        : "";
  if (pos) return `${pos} · ${characterName}`;
  return characterName;
}

/** 多行说明（背景、年龄等），用于侧栏档案 */
export function formatIdentityDetails(
  identityJson: string | Record<string, unknown>,
  characterName: string,
): string {
  const id = parseIdentityObject(identityJson);
  const lines: string[] = [];
  const pos =
    id.position != null && String(id.position).trim()
      ? String(id.position).trim()
      : "";
  const title =
    id.title != null && String(id.title).trim() ? String(id.title).trim() : "";
  if (pos) lines.push(`官职/身份：${pos}`);
  if (title && title !== pos) lines.push(`称谓/名号：${title}`);
  lines.push(`姓名：${characterName}`);
  if (id.background != null && String(id.background).trim()) {
    lines.push(`背景：${String(id.background).trim()}`);
  }
  if (id.age != null && String(id.age).trim()) {
    lines.push(`年龄：${String(id.age).trim()}`);
  }
  return lines.join("\n");
}
