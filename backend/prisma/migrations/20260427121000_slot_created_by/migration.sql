-- Add slot creator metadata
ALTER TABLE "Slot" ADD COLUMN "createdByRole" TEXT NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "Slot" ADD COLUMN "createdByName" TEXT;

