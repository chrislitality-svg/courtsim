import { prisma } from "@/lib/prisma";

/**
 * 直接读写 SQLite 的 courtFormation 列，绕过 Prisma Client 对字段名的运行时校验。
 * 在「schema 已迁移但尚未 prisma generate / 缓存旧 client」时仍可保存编组。
 */
export async function getScenarioCourtFormationJson(
  scenarioId: string,
): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ courtFormation: string | null }>>`
    SELECT "courtFormation" FROM "Scenario" WHERE "id" = ${scenarioId} LIMIT 1
  `;
  return rows[0]?.courtFormation ?? null;
}

export async function setScenarioCourtFormationJson(
  scenarioId: string,
  formationJson: string,
): Promise<void> {
  const now = new Date();
  await prisma.$executeRaw`
    UPDATE "Scenario"
    SET "courtFormation" = ${formationJson}, "updatedAt" = ${now}
    WHERE "id" = ${scenarioId}
  `;
}
