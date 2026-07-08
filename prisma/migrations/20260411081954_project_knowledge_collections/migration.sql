-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "KnowledgeCollection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeCollection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_KnowledgeSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "type" TEXT NOT NULL,
    "dynasty" TEXT,
    "era" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT,
    "mimeType" TEXT NOT NULL DEFAULT 'text/plain',
    "totalChunks" INTEGER NOT NULL DEFAULT 0,
    "collectionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeSource_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "KnowledgeCollection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_KnowledgeSource" ("author", "createdAt", "dynasty", "era", "fileName", "id", "mimeType", "storagePath", "tags", "title", "totalChunks", "type") SELECT "author", "createdAt", "dynasty", "era", "fileName", "id", "mimeType", "storagePath", "tags", "title", "totalChunks", "type" FROM "KnowledgeSource";
DROP TABLE "KnowledgeSource";
ALTER TABLE "new_KnowledgeSource" RENAME TO "KnowledgeSource";
CREATE TABLE "new_Scenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "projectId" TEXT,
    "dynastyId" TEXT NOT NULL,
    "periodId" TEXT,
    "year" INTEGER,
    "sceneType" TEXT NOT NULL,
    "sceneLocation" TEXT,
    "sceneDescription" TEXT,
    "background" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "protagonist" TEXT NOT NULL,
    "rules" TEXT NOT NULL,
    "rulesLayer" TEXT,
    "fidelity" TEXT NOT NULL DEFAULT 'moderate',
    "agentModelId" TEXT,
    "summarizerModelId" TEXT,
    "embeddingModelId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scenario_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Scenario" ("agentModelId", "background", "createdAt", "dynastyId", "embeddingModelId", "fidelity", "id", "name", "periodId", "protagonist", "rules", "rulesLayer", "sceneDescription", "sceneLocation", "sceneType", "summarizerModelId", "topic", "updatedAt", "year") SELECT "agentModelId", "background", "createdAt", "dynastyId", "embeddingModelId", "fidelity", "id", "name", "periodId", "protagonist", "rules", "rulesLayer", "sceneDescription", "sceneLocation", "sceneType", "summarizerModelId", "topic", "updatedAt", "year" FROM "Scenario";
DROP TABLE "Scenario";
ALTER TABLE "new_Scenario" RENAME TO "Scenario";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
