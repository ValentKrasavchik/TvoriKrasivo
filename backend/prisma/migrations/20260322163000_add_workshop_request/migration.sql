-- CreateTable
CREATE TABLE "WorkshopRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workshopId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "messenger" TEXT NOT NULL,
    "participants" INTEGER NOT NULL DEFAULT 1,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "confirmedSlotId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkshopRequest_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkshopRequest_confirmedSlotId_fkey" FOREIGN KEY ("confirmedSlotId") REFERENCES "Slot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WorkshopRequest_status_createdAt_idx" ON "WorkshopRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WorkshopRequest_date_time_idx" ON "WorkshopRequest"("date", "time");
