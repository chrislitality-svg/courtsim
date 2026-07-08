/** 解析 fetch 响应体；空 body / 非 JSON 时抛出可读中文错误（避免 Unexpected end of JSON input） */
export async function readApiJson<T = Record<string, unknown>>(
  r: Response,
): Promise<T> {
  const text = await r.text();
  if (!text?.trim()) {
    const prismaHint =
      r.status >= 500
        ? " 若刚修改过 schema，请先停止 next dev，在项目根执行 npx prisma generate 后再启动。"
        : "";
    throw new Error(`服务器返回空内容（HTTP ${r.status}）。${prismaHint}`.trim());
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `无法解析 JSON（HTTP ${r.status}），前 200 字：${text.slice(0, 200)}`,
    );
  }
}
