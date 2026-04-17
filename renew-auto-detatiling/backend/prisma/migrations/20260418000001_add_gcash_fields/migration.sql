-- Add GCash payment fields to BusinessSettings
ALTER TABLE "BusinessSettings" ADD COLUMN IF NOT EXISTS "gcashNumber" TEXT;
ALTER TABLE "BusinessSettings" ADD COLUMN IF NOT EXISTS "gcashName" TEXT;
