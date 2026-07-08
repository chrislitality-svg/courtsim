import { prisma } from "@/lib/prisma";
import { formatPoliticalStateForContext } from "./political-state";

function clampContext(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return "…（前文已截断）\n" + text.slice(-maxChars);
}

/** 滑动窗口：窗口外轮次优先用 Round.summary，无摘要则节录；窗口内保留发言全文 */
export async function buildPriorContextForSimulation(
  simulationId: string,
  beforeRoundNumber: number,
  maxChars: number,
  windowRounds: number,
): Promise<string> {
  if (beforeRoundNumber <= 1) return "（尚无先前轮次）";

  const rounds = await prisma.round.findMany({
    where: {
      simulationId,
      roundNumber: { lt: beforeRoundNumber },
    },
    orderBy: { roundNumber: "asc" },
    include: {
      speeches: {
        orderBy: { createdAt: "asc" },
        include: { character: { select: { name: true } } },
      },
    },
  });

  const windowStart = Math.max(1, beforeRoundNumber - windowRounds);
  const lines: string[] = [];

  for (const r of rounds) {
    if (r.roundNumber < windowStart) {
      const psi = formatPoliticalStateForContext(r.politicalState);
      if (psi) {
        lines.push(
          `\n—— 第 ${r.roundNumber} 轮（政治状态要点）——\n${psi}\n`,
        );
      }
      if (r.summary) {
        if (psi) {
          lines.push(`（综述）${r.summary.slice(0, 360)}\n`);
        } else {
          lines.push(
            `\n—— 第 ${r.roundNumber} 轮（档案摘要）——\n${r.summary}\n`,
          );
        }
      } else if (!psi) {
        const short = r.speeches
          .map((s) => {
            const t = s.publicSpeech;
            const clip = t.length > 160 ? `${t.slice(0, 160)}…` : t;
            return `【${s.character.name}】${clip}`;
          })
          .join("\n");
        lines.push(`\n—— 第 ${r.roundNumber} 轮（节录，待摘要）——\n${short}\n`);
      }
    } else {
      lines.push(`\n—— 第 ${r.roundNumber} 轮（全文）——\n`);
      for (const s of r.speeches) {
        lines.push(`【${s.character.name}】${s.publicSpeech}\n`);
      }
    }
  }

  return clampContext(lines.join(""), maxChars);
}
