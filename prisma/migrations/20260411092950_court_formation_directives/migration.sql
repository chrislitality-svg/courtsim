-- AlterTable
ALTER TABLE "Scenario" ADD COLUMN "courtFormation" TEXT;

-- AlterTable
ALTER TABLE "Speech" ADD COLUMN "userDirective" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Simulation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenarioId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "chapterReport" TEXT,
    "qualityFlags" TEXT,
    "closeTopicNextRound" BOOLEAN NOT NULL DEFAULT false,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Simulation_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Simulation" ("chapterReport", "createdAt", "currentRound", "id", "qualityFlags", "scenarioId", "status", "summary", "totalTokens", "updatedAt") SELECT "chapterReport", "createdAt", "currentRound", "id", "qualityFlags", "scenarioId", "status", "summary", "totalTokens", "updatedAt" FROM "Simulation";
DROP TABLE "Simulation";
ALTER TABLE "new_Simulation" RENAME TO "Simulation";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
