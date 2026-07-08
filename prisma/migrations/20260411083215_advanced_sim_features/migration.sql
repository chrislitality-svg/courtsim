-- AlterTable
ALTER TABLE "Scenario" ADD COLUMN "protagonistCharacterId" TEXT;

-- AlterTable
ALTER TABLE "Simulation" ADD COLUMN "chapterReport" TEXT;

-- AlterTable
ALTER TABLE "Speech" ADD COLUMN "dialogueMeta" TEXT;
