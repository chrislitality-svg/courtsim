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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_KnowledgeSource" ("author", "createdAt", "dynasty", "era", "fileName", "id", "tags", "title", "totalChunks", "type") SELECT "author", "createdAt", "dynasty", "era", "fileName", "id", "tags", "title", "totalChunks", "type" FROM "KnowledgeSource";
DROP TABLE "KnowledgeSource";
ALTER TABLE "new_KnowledgeSource" RENAME TO "KnowledgeSource";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
