-- RedefineTable steps for SQLite: new column with default
ALTER TABLE "Slot" ADD COLUMN "offlineOccupiedSeats" INTEGER NOT NULL DEFAULT 0;
