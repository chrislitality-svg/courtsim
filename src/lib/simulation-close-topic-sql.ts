import { prisma } from "@/lib/prisma";

function rowToBool(v: unknown): boolean {
  return v === true || v === 1 || v === "1";
}

/** 读取「再下一轮收束议题」标记（绕过 Prisma Client 字段校验） */
export async function getCloseTopicNextRoundSql(
  simulationId: string,
): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ closeTopicNextRound: unknown }>>`
    SELECT "closeTopicNextRound" FROM "Simulation" WHERE "id" = ${simulationId} LIMIT 1
  `;
  return rowToBool(rows[0]?.closeTopicNextRound);
}

export async function setCloseTopicNextRoundSql(
  simulationId: string,
  value: boolean,
): Promise<void> {
  const now = new Date();
  await prisma.$executeRaw`
    UPDATE "Simulation"
    SET "closeTopicNextRound" = ${value}, "updatedAt" = ${now}
    WHERE "id" = ${simulationId}
  `;
}
