/** 按段落优先切分，再按硬上限拆块，带简单重叠 */
export function chunkText(
  text: string,
  maxChars = 900,
  overlap = 100,
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paras = normalized.split(/\n{2,}/).flatMap((p) =>
    p.split("\n").map((x) => x.trim()).filter(Boolean),
  );
  const chunks: string[] = [];
  let buf = "";

  const flush = () => {
    const t = buf.trim();
    if (t) chunks.push(t);
    buf = "";
  };

  for (const line of paras) {
    if (buf.length + line.length + 1 > maxChars) {
      if (buf) flush();
      if (line.length > maxChars) {
        for (let i = 0; i < line.length; i += maxChars - overlap) {
          chunks.push(line.slice(i, i + maxChars));
        }
      } else {
        buf = line;
      }
    } else {
      buf = buf ? `${buf}\n${line}` : line;
    }
  }
  flush();
  return chunks;
}
