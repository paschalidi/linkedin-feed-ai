-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "ideas_per_day" INTEGER NOT NULL DEFAULT 3;
