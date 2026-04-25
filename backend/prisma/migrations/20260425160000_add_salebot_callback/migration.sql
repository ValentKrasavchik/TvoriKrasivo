-- CreateTable
CREATE TABLE IF NOT EXISTS "SalebotCallback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalLeadId" TEXT NOT NULL,
    "leadType" TEXT NOT NULL,
    "requestBody" TEXT NOT NULL,
    "responseBody" TEXT,
    "httpStatus" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SalebotCallback_externalLeadId_key" ON "SalebotCallback"("externalLeadId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SalebotCallback_status_createdAt_idx" ON "SalebotCallback"("status", "createdAt");
