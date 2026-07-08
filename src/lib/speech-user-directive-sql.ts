import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** 某角色在本推演中最近一条带批注的发言（用于下一轮注入） */
export async function findLatestSpeechWithUserDirective(
  characterId: string,
  simulationId: string,
): Promise<{ id: string; userDirective: string } | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string; userDirective: string }>>`
    SELECT s.id, s."userDirective" as userDirective
    FROM "Speech" s
    INNER JOIN "Round" r ON s."roundId" = r.id
    WHERE s."characterId" = ${characterId}
      AND r."simulationId" = ${simulationId}
      AND s."userDirective" IS NOT NULL
      AND TRIM(s."userDirective") != ''
    ORDER BY s."createdAt" DESC
    LIMIT 1
  `;
  const row = rows[0];
  if (!row?.userDirective?.trim()) return null;
  return { id: row.id, userDirective: row.userDirective };
}

export async function clearSpeechUserDirectiveSql(speechId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "Speech" SET "userDirective" = NULL WHERE "id" = ${speechId}
  `;
}

export async function updateSpeechUserDirectiveSql(
  speechId: string,
  directive: string | null,
): Promise<{ id: string; userDirective: string | null } | null> {
  await prisma.$executeRaw`
    UPDATE "Speech"
    SET "userDirective" = ${directive}
    WHERE "id" = ${speechId}
  `;
  const rows = await prisma.$queryRaw<Array<{ id: string; userDirective: string | null }>>`
    SELECT id, "userDirective" FROM "Speech" WHERE "id" = ${speechId} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function batchGetSpeechUserDirectives(
  speechIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (speechIds.length === 0) return map;
  const rows = await prisma.$queryRaw<Array<{ id: string; userDirective: string | null }>>`
    SELECT id, "userDirective" FROM "Speech" WHERE id IN (${Prisma.join(speechIds)})
  `;
  for (const r of rows) {
    map.set(r.id, r.userDirective);
  }
  return map;
}

export function collectAllSpeechIds(sim: {
  rounds: { speeches: { id: string }[] }[];
}): string[] {
  return sim.rounds.flatMap((r) => r.speeches.map((s) => s.id));
}

type SimWithRounds = {
  rounds: Array<{ speeches: Array<{ id: string } & Record<string, unknown>> }>;
};

/** 在已加载的推演 JSON 上合并批注字段（避免 Prisma select 依赖 userDirective） */
export function mergeUserDirectivesIntoSimulation<T extends SimWithRounds>(
  sim: T,
  map: Map<string, string | null>,
): T {
  return {
    ...sim,
    rounds: sim.rounds.map((round) => ({
      ...round,
      speeches: round.speeches.map((sp) => ({
        ...sp,
        userDirective: map.get(sp.id) ?? null,
      })),
    })),
  } as T;
}
